import type { KvStore } from './store/types.js';
import { PlatformError } from './errors.js';
import { authorize, type AuthContext } from './orgs.js';
import type { BillingConfig } from './billing/config.js';

export type PurchaseProduct = 'assessment' | 'blueprint';

export interface Purchase {
  product: PurchaseProduct;
  assessmentRootId: string;
  checkoutSessionId: string;
  /** Stripe PaymentIntent, so a refund can find the purchase it reverses. */
  paymentIntentId?: string | null;
  at: string;
  /** Set when the payment was fully refunded; the purchase no longer grants anything. */
  refundedAt?: string | null;
}

/** One money event, newest first. Written only by verified webhooks. */
export interface PaymentRecord {
  id: string;
  kind: 'checkout' | 'invoice' | 'refund';
  product: PurchaseProduct | 'team';
  status: 'paid' | 'failed' | 'expired' | 'refunded' | 'partially_refunded';
  amount: number | null;
  currency: string | null;
  at: string;
  assessmentRootId?: string;
}

export interface Entitlements {
  plan: 'free' | 'team';
  subscription: {
    id: string | null;
    customerId: string | null;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd?: boolean;
  } | null;
  purchases: Purchase[];
  payments?: PaymentRecord[];
}

export const EK = { entitlements: (orgId: string) => `org:${orgId}:entitlements` };
export const MAX_PAYMENT_RECORDS = 200;

export async function readEntitlements(store: KvStore, orgId: string): Promise<Entitlements> {
  return (await store.get<Entitlements>(EK.entitlements(orgId))) ?? { plan: 'free', subscription: null, purchases: [], payments: [] };
}

/**
 * How long past `currentPeriodEnd` an active subscription keeps working
 * without a renewal webhook. Stripe sends the renewal before the period
 * ends; past this grace the subscription is treated as expired rather than
 * trusted indefinitely.
 */
export const RENEWAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export type SubscriptionState = 'none' | 'active' | 'canceling' | 'past_due' | 'canceled' | 'expired';

export function subscriptionState(ent: Entitlements, now = new Date()): SubscriptionState {
  const s = ent.subscription;
  if (!s) return 'none';
  const end = s.currentPeriodEnd ? Date.parse(s.currentPeriodEnd) : null;
  if (s.status === 'active' || s.status === 'trialing') {
    if (end !== null && now.getTime() > end + RENEWAL_GRACE_MS) return 'expired';
    return s.cancelAtPeriodEnd ? 'canceling' : 'active';
  }
  if (s.status === 'past_due') return 'past_due';
  // Canceled at period end: access lasts until the period it was paid for ends.
  if (s.status === 'canceled' && end !== null && now.getTime() < end) return 'canceling';
  return s.status === 'canceled' ? 'canceled' : 'expired';
}

export function teamPlanActive(ent: Entitlements, now = new Date()): boolean {
  const st = subscriptionState(ent, now);
  return st === 'active' || st === 'canceling';
}

/**
 * What a workspace can see of one assessment.
 *   free        verdict and build/buy/automate decision
 *   assessment  + cost, ROI, risks, security and governance (and the printable report)
 *   blueprint   + architecture, models, infrastructure, evaluation, roadmap, blueprint download
 * An active team plan is blueprint level for every assessment.
 */
export type AccessLevel = 'free' | 'assessment' | 'blueprint';
const RANK: Record<AccessLevel, number> = { free: 0, assessment: 1, blueprint: 2 };

export type Section =
  | 'verdict' | 'build-vs-buy'
  | 'cost' | 'roi' | 'risks' | 'security' | 'governance'
  | 'architecture' | 'models' | 'infrastructure' | 'evaluation' | 'roadmap' | 'blueprint';

export const SECTION_LEVEL: Record<Section, AccessLevel> = {
  verdict: 'free',
  'build-vs-buy': 'free',
  cost: 'assessment',
  roi: 'assessment',
  risks: 'assessment',
  security: 'assessment',
  governance: 'assessment',
  architecture: 'blueprint',
  models: 'blueprint',
  infrastructure: 'blueprint',
  evaluation: 'blueprint',
  roadmap: 'blueprint',
  blueprint: 'blueprint',
};

export function accessLevel(ent: Entitlements, assessmentRootId: string | null, now = new Date()): AccessLevel {
  if (teamPlanActive(ent, now)) return 'blueprint';
  if (!assessmentRootId) return 'free';
  let best: AccessLevel = 'free';
  for (const p of ent.purchases) {
    if (p.assessmentRootId !== assessmentRootId || p.refundedAt) continue;
    if (RANK[p.product] > RANK[best]) best = p.product;
  }
  return best;
}

export function levelAllows(level: AccessLevel, section: Section): boolean {
  return RANK[level] >= RANK[SECTION_LEVEL[section]];
}

/**
 * Access for a viewer who may have no workspace (the anonymous report). With
 * billing off everything is open, as it always has been. With billing on, the
 * anonymous report shows the free sections; the rest need a saved, paid assessment.
 */
export async function sectionAccess(
  store: KvStore | null, ctx: AuthContext | null, cfg: BillingConfig, assessmentRootId: string | null,
): Promise<{ level: AccessLevel; reason: string }> {
  if (!cfg.enabled) return { level: 'blueprint', reason: 'Billing is off on this deployment.' };
  if (!store || !ctx) return { level: 'free', reason: 'Save this assessment to a workspace to unlock the full analysis.' };
  authorize(ctx, 'assessment:read');
  const ent = await readEntitlements(store, ctx.orgId);
  const level = accessLevel(ent, assessmentRootId);
  return { level, reason: level === 'blueprint' ? (teamPlanActive(ent) ? 'Workspace plan.' : 'Blueprint purchased.') : level === 'assessment' ? 'Assessment purchased.' : 'Free sections only.' };
}

export type Feature = 'blueprint' | 'control-export';

export interface EntitlementDecision {
  allowed: boolean;
  reason: string;
}

/**
 * Server-side check, called by every route that serves a paid deliverable.
 * Reads only stored entitlements (written by verified webhooks) and the
 * billing mode, never anything in the request. With billing off, everything
 * is allowed and the response says why.
 */
export async function checkEntitlement(store: KvStore, ctx: AuthContext, cfg: BillingConfig, feature: Feature, assessmentRootId: string): Promise<EntitlementDecision> {
  authorize(ctx, 'export:download');
  if (!cfg.enabled) return { allowed: true, reason: 'Billing is off on this deployment.' };
  const ent = await readEntitlements(store, ctx.orgId);
  const state = subscriptionState(ent);
  if (teamPlanActive(ent)) return { allowed: true, reason: state === 'canceling' ? 'Workspace plan (ends at the close of the paid period).' : 'Workspace plan.' };
  if (feature === 'blueprint' && accessLevel(ent, assessmentRootId) === 'blueprint') {
    return { allowed: true, reason: 'Blueprint purchased for this assessment.' };
  }
  if (state === 'past_due') return { allowed: false, reason: 'The last payment failed. Update the card to restore access.' };
  if (state === 'expired') return { allowed: false, reason: 'The workspace plan has expired. Renew it to restore access.' };
  return { allowed: false, reason: feature === 'blueprint' ? 'Buy this blueprint or start a workspace plan to download it.' : 'Governance export needs the workspace plan.' };
}

export async function requireEntitlement(store: KvStore, ctx: AuthContext, cfg: BillingConfig, feature: Feature, assessmentRootId: string): Promise<void> {
  const d = await checkEntitlement(store, ctx, cfg, feature, assessmentRootId);
  if (!d.allowed) throw new PlatformError('payment_required', d.reason);
}

/** Payment history for the billing page. Admins only. */
export async function paymentHistory(store: KvStore, ctx: AuthContext): Promise<PaymentRecord[]> {
  authorize(ctx, 'billing:manage');
  return (await readEntitlements(store, ctx.orgId)).payments ?? [];
}

export function recordPayment(ent: Entitlements, p: PaymentRecord): void {
  const list = ent.payments ?? [];
  if (list.some((x) => x.id === p.id && x.kind === p.kind && x.status === p.status)) return;
  ent.payments = [p, ...list].slice(0, MAX_PAYMENT_RECORDS);
}
