import { createHmac } from 'node:crypto';
import { PlatformError } from '../errors.js';
import { safeEqual } from '../crypto.js';
import type { KvStore } from '../store/types.js';
import { getOrg, audit } from '../orgs.js';
import { EK, type Entitlements, readEntitlements } from '../entitlements.js';

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

async function apply(store: KvStore, event: StripeEvent): Promise<HandleResult> {
  const o = event.data.object;
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
      if (product === 'blueprint') {
        const rootId = str(m.assessmentRootId);
        if (!rootId) return { status: 'ignored', detail: 'Blueprint purchase without an assessment.' };
        if (!ent.purchases.some((p) => p.checkoutSessionId === sessionId)) {
          ent.purchases.push({ product: 'blueprint', assessmentRootId: rootId, checkoutSessionId: sessionId, at: new Date(event.created * 1000).toISOString() });
        }
      } else if (product === 'team') {
        ent.plan = 'team';
        ent.subscription = {
          id: str(o.subscription) ?? null,
          customerId: str(o.customer) ?? null,
          status: 'active',
          currentPeriodEnd: ent.subscription?.currentPeriodEnd ?? null,
        };
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
      const orgId = str(meta(o).orgId) ?? str(o.client_reference_id);
      if (!sessionId) return { status: 'ignored', detail: 'No session id.' };
      await store.set(WK.checkout(sessionId), { status: event.type.endsWith('expired') ? 'expired' : 'failed', orgId: orgId ?? null });
      if (orgId) await audit(store, orgId, 'stripe', event.type.endsWith('expired') ? 'billing.checkout_expired' : 'billing.payment_failed', { sessionId });
      return { status: 'processed', detail: 'Recorded the failed or abandoned checkout. Nothing was granted.' };
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const orgId = str(meta(o).orgId);
      if (!orgId || !(await getOrg(store, orgId))) return { status: 'ignored', detail: 'Subscription does not name a known workspace.' };
      const ent = await readEntitlements(store, orgId);
      const status = event.type === 'customer.subscription.deleted' ? 'canceled' : (str(o.status) ?? 'incomplete');
      const end = typeof o.current_period_end === 'number' ? new Date(o.current_period_end * 1000).toISOString() : ent.subscription?.currentPeriodEnd ?? null;
      ent.subscription = { id: str(o.id) ?? ent.subscription?.id ?? null, customerId: str(o.customer) ?? ent.subscription?.customerId ?? null, status, currentPeriodEnd: end };
      ent.plan = status === 'active' || status === 'trialing' ? 'team' : 'free';
      await store.set(EK.entitlements(orgId), ent);
      await audit(store, orgId, 'stripe', 'billing.subscription', { status });
      return { status: 'processed', detail: `Subscription is ${status}.` };
    }
    case 'invoice.payment_failed': {
      const orgId = str(meta((o.subscription_details as Record<string, unknown>) ?? {}).orgId) ?? str(meta(o).orgId);
      if (!orgId || !(await getOrg(store, orgId))) return { status: 'ignored', detail: 'Invoice does not name a known workspace.' };
      const ent: Entitlements = await readEntitlements(store, orgId);
      if (ent.subscription) ent.subscription.status = 'past_due';
      ent.plan = 'free';
      await store.set(EK.entitlements(orgId), ent);
      await audit(store, orgId, 'stripe', 'billing.payment_failed', {});
      return { status: 'processed', detail: 'Payment failed; team features paused until the card is updated.' };
    }
    default:
      return { status: 'ignored', detail: `Event type ${event.type} is not handled.` };
  }
}
