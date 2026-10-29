import { createHmac } from 'node:crypto';
import { PlatformError } from '../errors.js';
import { safeEqual } from '../crypto.js';
import type { KvStore } from '../store/types.js';
import { getOrg, audit } from '../orgs.js';
import { EK, type Entitlements, readEntitlements, recordPayment } from '../entitlements.js';

export interface StripeEvent {
  id: string;
  type: string;
  created: number;
  livemode: boolean;
  data: { object: Record<string, unknown> };
}

/**
 * Stripe's signature scheme: header `t=<unix>,v1=<hex>[,v1=…]`, where v1 is
 * HMAC-SHA256(secret, `${t}.${rawBody}`). The raw body must be the exact
 * bytes received; parsing and re-serialising would break the signature.
 */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, opts: { toleranceSeconds?: number; now?: number } = {}): StripeEvent {
  if (!header) throw new PlatformError('invalid', 'Missing Stripe-Signature header.');
  const parts = header.split(',').map((p) => p.trim().split('=') as [string, string]);
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !/^\d+$/.test(t) || sigs.length === 0) throw new PlatformError('invalid', 'Malformed Stripe-Signature header.');
  const tolerance = opts.toleranceSeconds ?? 300;
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (Math.abs(now - Number(t)) > tolerance) throw new PlatformError('invalid', 'Stripe signature timestamp is outside the tolerance window.');
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex');
  if (!sigs.some((s) => safeEqual(s, expected))) throw new PlatformError('invalid', 'Stripe signature does not match.');
  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    throw new PlatformError('invalid', 'Webhook body is not JSON.');
  }
  if (typeof event?.id !== 'string' || typeof event?.type !== 'string' || !event.data?.object) {
    throw new PlatformError('invalid', 'Webhook body is not a Stripe event.');
  }
  return event;
}

/** Test helper and documentation of the scheme: sign a body the way Stripe does. */
export function signStripePayload(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const sig = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

export type CheckoutStatus = 'pending' | 'paid' | 'expired' | 'failed';

export const WK = {
  processed: (eventId: string) => `stripe-event:${eventId}`,
  lock: (eventId: string) => `stripe-event-lock:${eventId}`,
  checkout: (sessionId: string) => `checkout:${sessionId}`,
};

export interface HandleResult {
  status: 'processed' | 'duplicate' | 'ignored' | 'in_progress';
  detail: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const meta = (o: Record<string, unknown>) => (o.metadata && typeof o.metadata === 'object' ? (o.metadata as Record<string, unknown>) : {});

/**
 * Applies a verified event exactly once.
 *
 * Idempotency: an event id is marked processed only after it has been applied.
 * A short lock keeps two concurrent deliveries of the same event from both
 * applying it; if applying throws, the lock is released and the caller answers
 * 500 so Stripe retries. Replays after success return `duplicate`.
 */
export async function handleStripeEvent(store: KvStore, event: StripeEvent, opts: { expectLivemode: boolean }): Promise<HandleResult> {
  if (await store.get(WK.processed(event.id))) return { status: 'duplicate', detail: 'Already processed.' };
  if (event.livemode !== opts.expectLivemode) return { status: 'ignored', detail: `Event livemode=${event.livemode} does not match this deployment.` };
  if (!(await store.set(WK.lock(event.id), true, { nx: true, ttlSeconds: 60 }))) return { status: 'in_progress', detail: 'Another delivery is processing this event.' };
  try {
    const result = await apply(store, event);
    await store.set(WK.processed(event.id), { type: event.type, at: new Date().toISOString(), result: result.status }, { ttlSeconds: 90 * 24 * 60 * 60 });
    return result;
  } finally {
    await store.del(WK.lock(event.id));
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const iso = (sec: number) => new Date(sec * 1000).toISOString();

async function apply(store: KvStore, event: StripeEvent): Promise<HandleResult> {
  const o = event.data.object;
  const at = iso(event.created);
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const m = meta(o);
      const orgId = str(m.orgId) ?? str(o.client_reference_id);
      const product = str(m.product);
      const sessionId = str(o.id);
      if (!orgId || !sessionId || !(await getOrg(store, orgId))) return { status: 'ignored', detail: 'Checkout session does not name a known workspace.' };
      // `payment_status` is "paid" once money has moved; "unpaid" means a
      // delayed method (bank debit) that will report async_payment_succeeded later.
      if (str(o.payment_status) !== 'paid' && str(o.payment_status) !== 'no_payment_required') {
        await store.set(WK.checkout(sessionId), { status: 'pending', orgId });
        return { status: 'processed', detail: 'Checkout completed; payment still pending.' };
      }
      const ent = await readEntitlements(store, orgId);
      if (product === 'blueprint' || product === 'assessment') {
        const rootId = str(m.assessmentRootId);
        if (!rootId) return { status: 'ignored', detail: `${product} purchase without an assessment.` };
        if (!ent.purchases.some((p) => p.checkoutSessionId === sessionId)) {
          ent.purchases.push({ product, assessmentRootId: rootId, checkoutSessionId: sessionId, paymentIntentId: str(o.payment_intent) ?? null, at });
        }
        recordPayment(ent, { id: sessionId, kind: 'checkout', product, status: 'paid', amount: num(o.amount_total), currency: str(o.currency) ?? null, at, assessmentRootId: rootId });
      } else if (product === 'team') {
        ent.plan = 'team';
        ent.subscription = {
          id: str(o.subscription) ?? null,
          customerId: str(o.customer) ?? null,
          status: 'active',
          currentPeriodEnd: ent.subscription?.currentPeriodEnd ?? null,
          cancelAtPeriodEnd: false,
        };
        recordPayment(ent, { id: sessionId, kind: 'checkout', product: 'team', status: 'paid', amount: num(o.amount_total), currency: str(o.currency) ?? null, at });
      } else {
        return { status: 'ignored', detail: `Unknown product "${product}".` };
      }
      await store.set(EK.entitlements(orgId), ent);
      await store.set(WK.checkout(sessionId), { status: 'paid', orgId });
      await audit(store, orgId, 'stripe', 'billing.paid', { product, sessionId });
      return { status: 'processed', detail: `Granted ${product}.` };
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      const sessionId = str(o.id);
      const m = meta(o);
      const orgId = str(m.orgId) ?? str(o.client_reference_id);
      if (!sessionId) return { status: 'ignored', detail: 'No session id.' };
      const expired = event.type.endsWith('expired');
      await store.set(WK.checkout(sessionId), { status: expired ? 'expired' : 'failed', orgId: orgId ?? null });
      if (orgId && (await getOrg(store, orgId))) {
        const product = str(m.product);
        if (product === 'assessment' || product === 'blueprint' || product === 'team') {
          const ent = await readEntitlements(store, orgId);
          recordPayment(ent, { id: sessionId, kind: 'checkout', product, status: expired ? 'expired' : 'failed', amount: num(o.amount_total), currency: str(o.currency) ?? null, at });
          await store.set(EK.entitlements(orgId), ent);
        }
        await audit(store, orgId, 'stripe', expired ? 'billing.checkout_expired' : 'billing.payment_failed', { sessionId });
      }
      return { status: 'processed', detail: 'Recorded the failed or abandoned checkout. Nothing was granted.' };
    }
    case 'charge.refunded': {
      const m = meta(o);
      const orgId = str(m.orgId);
      const intent = str(o.payment_intent);
      if (!orgId || !(await getOrg(store, orgId))) return { status: 'ignored', detail: 'Refund does not name a known workspace.' };
      const ent = await readEntitlements(store, orgId);
      const full = o.refunded === true;
      const purchase = intent ? ent.purchases.find((p) => p.paymentIntentId === intent) : undefined;
      if (purchase && full && !purchase.refundedAt) purchase.refundedAt = at;
      const product = purchase?.product ?? (str(m.product) === 'team' ? 'team' : str(m.product) === 'assessment' ? 'assessment' : 'blueprint');
      recordPayment(ent, { id: str(o.id) ?? intent ?? event.id, kind: 'refund', product, status: full ? 'refunded' : 'partially_refunded', amount: num(o.amount_refunded), currency: str(o.currency) ?? null, at, assessmentRootId: purchase?.assessmentRootId });
      await store.set(EK.entitlements(orgId), ent);
      await audit(store, orgId, 'stripe', 'billing.refunded', { full, product });
      return { status: 'processed', detail: full ? (purchase ? `Refunded; the ${purchase.product} purchase no longer grants access.` : 'Refund recorded; no matching purchase.') : 'Partial refund recorded; access unchanged.' };
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const orgId = str(meta(o).orgId);
      if (!orgId || !(await getOrg(store, orgId))) return { status: 'ignored', detail: 'Subscription does not name a known workspace.' };
      const ent = await readEntitlements(store, orgId);
      const deleted = event.type === 'customer.subscription.deleted';
      const status = deleted ? 'canceled' : (str(o.status) ?? 'incomplete');
      // A deleted subscription has ended: access stops when it ended, not at the old period end.
      const end = deleted
        ? iso(num(o.ended_at) ?? event.created)
        : num(o.current_period_end) !== null ? iso(num(o.current_period_end)!) : ent.subscription?.currentPeriodEnd ?? null;
      ent.subscription = {
        id: str(o.id) ?? ent.subscription?.id ?? null,
        customerId: str(o.customer) ?? ent.subscription?.customerId ?? null,
        status,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: !deleted && o.cancel_at_period_end === true,
      };
      ent.plan = status === 'active' || status === 'trialing' ? 'team' : 'free';
      await store.set(EK.entitlements(orgId), ent);
      await audit(store, orgId, 'stripe', 'billing.subscription', { status, cancelAtPeriodEnd: ent.subscription.cancelAtPeriodEnd });
      return { status: 'processed', detail: `Subscription is ${status}${ent.subscription.cancelAtPeriodEnd ? ', ending at the period end' : ''}.` };
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const orgId = str(meta((o.subscription_details as Record<string, unknown>) ?? {}).orgId) ?? str(meta(o).orgId);
      if (!orgId || !(await getOrg(store, orgId))) return { status: 'ignored', detail: 'Invoice does not name a known workspace.' };
      const ent: Entitlements = await readEntitlements(store, orgId);
      const paid = event.type === 'invoice.paid';
      recordPayment(ent, { id: str(o.id) ?? event.id, kind: 'invoice', product: 'team', status: paid ? 'paid' : 'failed', amount: num(paid ? o.amount_paid : o.amount_due), currency: str(o.currency) ?? null, at });
      if (paid) {
        const periodEnd = num((o as { period_end?: unknown }).period_end);
        if (ent.subscription && ent.subscription.status === 'past_due') ent.subscription.status = 'active';
        if (ent.subscription && periodEnd !== null && Date.parse(ent.subscription.currentPeriodEnd ?? '') < periodEnd * 1000) ent.subscription.currentPeriodEnd = iso(periodEnd);
        if (ent.subscription?.status === 'active') ent.plan = 'team';
      } else {
        if (ent.subscription) ent.subscription.status = 'past_due';
        ent.plan = 'free';
      }
      await store.set(EK.entitlements(orgId), ent);
      await audit(store, orgId, 'stripe', paid ? 'billing.invoice_paid' : 'billing.payment_failed', {});
      return { status: 'processed', detail: paid ? 'Invoice paid.' : 'Payment failed; team features paused until the card is updated.' };
    }
    default:
      return { status: 'ignored', detail: `Event type ${event.type} is not handled.` };
  }
}
