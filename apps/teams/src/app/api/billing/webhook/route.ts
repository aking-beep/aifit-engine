import { PlatformError, handleStripeEvent, verifyStripeSignature } from '@aifit/platform';
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
    return json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
