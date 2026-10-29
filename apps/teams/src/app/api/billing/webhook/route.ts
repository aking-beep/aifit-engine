import { PlatformError, handleStripeEvent, verifyStripeSignature } from '@aifit/platform';
import { sendReceipt } from '@/server/email';
import { billing, errorResponse, json, requireStore } from '@/server/platform';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 512 * 1024;

/**
 * Stripe webhooks. The signature is checked against the raw body before
 * anything is parsed or trusted; each event is applied once. A 500 tells
 * Stripe to retry, which is safe because application is idempotent.
 */
export async function POST(req: Request) {
  try {
    const cfg = billing();
    if (!cfg.enabled || !cfg.webhookSecret) throw new PlatformError('unavailable', 'Billing is not enabled on this deployment.');
    const raw = await req.text();
    if (raw.length > MAX_BYTES) throw new PlatformError('invalid', 'Webhook body too large.');
    const event = verifyStripeSignature(raw, req.headers.get('stripe-signature'), cfg.webhookSecret);
    const result = await handleStripeEvent(requireStore(), event, { expectLivemode: cfg.mode === 'live' });
    if (result.status === 'in_progress') return json(result, { status: 409 });
    if (result.status === 'processed') await receipt(event).catch(() => false);
    return json(result);
  } catch (e) {
    return errorResponse(e);
  }
}

const ITEM: Record<string, string> = { assessment: 'AI Fit Teams assessment', blueprint: 'AI Fit Teams blueprint', team: 'AI Fit Teams workspace plan' };

/** A receipt for a confirmed payment, sent once per event (the idempotency key is the event id). */
async function receipt(event: { id: string; type: string; data: { object: Record<string, unknown> } }) {
  const o = event.data.object;
  const paid = (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && (o.payment_status === 'paid');
  if (!paid) return false;
  const details = (o.customer_details ?? {}) as { email?: unknown };
  const to = typeof details.email === 'string' ? details.email : typeof o.customer_email === 'string' ? o.customer_email : null;
  const product = typeof (o.metadata as Record<string, unknown> | undefined)?.product === 'string' ? String((o.metadata as Record<string, unknown>).product) : '';
  if (!to || !ITEM[product]) return false;
  return sendReceipt(to, ITEM[product]!, typeof o.amount_total === 'number' ? o.amount_total : null, typeof o.currency === 'string' ? o.currency : null, event.id);
}
