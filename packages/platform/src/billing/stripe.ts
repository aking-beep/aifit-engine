import { PlatformError } from '../errors.js';
import type { BillingConfig } from './config.js';

export type Product = 'assessment' | 'blueprint' | 'team';

export interface CheckoutRequest {
  product: Product;
  orgId: string;
  userId: string;
  email: string;
  /** Required for an assessment or blueprint purchase: the assessment (root) it unlocks. */
  assessmentRootId?: string;
  /** Stable per attempt so a double-click does not create two sessions. */
  idempotencyKey: string;
}

function form(params: Record<string, string>): string {
  return Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

/**
 * Creates a Stripe-hosted Checkout Session over the REST API. Card details
 * never touch this app. Entitlements are NOT granted here or on the success
 * redirect: only a verified webhook grants them.
 */
export async function createCheckoutSession(cfg: BillingConfig, req: CheckoutRequest, fetchImpl: typeof fetch = fetch): Promise<{ id: string; url: string }> {
  if (!cfg.enabled || !cfg.secretKey) throw new PlatformError('unavailable', cfg.reason);
  const price = req.product === 'team' ? cfg.prices.teamMonthly : cfg.prices[req.product];
  if (!price) throw new PlatformError('unavailable', `No price is configured for ${req.product}.`);
  if (req.product !== 'team' && !req.assessmentRootId) throw new PlatformError('invalid', `An ${req.product} purchase must name an assessment.`);

  const params: Record<string, string> = {
    mode: req.product === 'team' ? 'subscription' : 'payment',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    success_url: `${cfg.appUrl}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${cfg.appUrl}/billing?status=cancelled`,
    client_reference_id: req.orgId,
    customer_email: req.email,
    'metadata[orgId]': req.orgId,
    'metadata[userId]': req.userId,
    'metadata[product]': req.product,
  };
  // The PaymentIntent carries the same metadata, so a refund event can be traced back to its purchase.
  if (req.product !== 'team') {
    params['payment_intent_data[metadata][orgId]'] = req.orgId;
    params['payment_intent_data[metadata][product]'] = req.product;
    if (req.assessmentRootId) params['payment_intent_data[metadata][assessmentRootId]'] = req.assessmentRootId;
  }
  if (req.assessmentRootId) params['metadata[assessmentRootId]'] = req.assessmentRootId;
  if (req.product === 'team') {
    params['subscription_data[metadata][orgId]'] = req.orgId;
    params['subscription_data[metadata][product]'] = 'team';
  }

  const res = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cfg.secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': req.idempotencyKey,
    },
    body: form(params),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !body.id || !body.url) {
    throw new PlatformError('unavailable', `Stripe did not create a checkout session${body.error?.message ? `: ${body.error.message}` : ''}.`);
  }
  return { id: body.id, url: body.url };
}
