import type { KvStore } from './store/types.js';
import { PlatformError } from './errors.js';
import { authorize, type AuthContext } from './orgs.js';
import type { BillingConfig } from './billing/config.js';

export interface Entitlements {
  plan: 'free' | 'team';
  subscription: { id: string | null; customerId: string | null; status: string; currentPeriodEnd: string | null } | null;
  purchases: { product: 'blueprint'; assessmentRootId: string; checkoutSessionId: string; at: string }[];
}

export const EK = { entitlements: (orgId: string) => `org:${orgId}:entitlements` };

export async function readEntitlements(store: KvStore, orgId: string): Promise<Entitlements> {
  return (await store.get<Entitlements>(EK.entitlements(orgId))) ?? { plan: 'free', subscription: null, purchases: [] };
}

export type Feature = 'blueprint' | 'control-export';

export interface EntitlementDecision {
  allowed: boolean;
  reason: string;
}

/**
 * Server-side check, called by every route that serves a paid deliverable.
 * Reads only stored entitlements (written by verified webhooks) and the
 * billing mode — never anything in the request. With billing off, everything
 * is allowed and the response says why.
 */
export async function checkEntitlement(store: KvStore, ctx: AuthContext, cfg: BillingConfig, feature: Feature, assessmentRootId: string): Promise<EntitlementDecision> {
  authorize(ctx, 'export:download');
  if (!cfg.enabled) return { allowed: true, reason: 'Billing is off on this deployment.' };
  const ent = await readEntitlements(store, ctx.orgId);
  const active = ent.plan === 'team' && (ent.subscription?.status === 'active' || ent.subscription?.status === 'trialing');
  if (active) return { allowed: true, reason: 'Team plan.' };
  if (feature === 'blueprint' && ent.purchases.some((p) => p.assessmentRootId === assessmentRootId)) {
    return { allowed: true, reason: 'Blueprint purchased for this assessment.' };
  }
  if (ent.subscription?.status === 'past_due') return { allowed: false, reason: 'The last payment failed. Update the card to restore access.' };
  return { allowed: false, reason: feature === 'blueprint' ? 'Buy this blueprint or start a team plan to download it.' : 'Governance export needs the team plan.' };
}

export async function requireEntitlement(store: KvStore, ctx: AuthContext, cfg: BillingConfig, feature: Feature, assessmentRootId: string): Promise<void> {
  const d = await checkEntitlement(store, ctx, cfg, feature, assessmentRootId);
  if (!d.allowed) throw new PlatformError('payment_required', d.reason);
}
