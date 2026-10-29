/**
 * Billing mode, decided from the environment and nothing else.
 *
 *   off   (default) everything is free; no checkout is offered.
 *   test  Stripe test mode; the secret key must start with sk_test_.
 *   live  real charges; needs an sk_live_ key AND BILLING_ALLOW_LIVE=1.
 *
 * Any mismatch disables billing with a reason instead of guessing. A live key
 * in test mode, or live mode without the explicit second switch, is refused.
 */
export type BillingMode = 'off' | 'test' | 'live';

export interface BillingConfig {
  mode: BillingMode;
  enabled: boolean;
  reason: string;
  secretKey?: string;
  webhookSecret?: string;
  prices: { assessment?: string; blueprint?: string; teamMonthly?: string };
  appUrl: string;
}

export function billingConfig(env: Record<string, string | undefined>): BillingConfig {
  const requested = (env.BILLING_MODE ?? 'off').trim().toLowerCase();
  const appUrl = (env.APP_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'http://localhost:3001')).replace(/\/+$/, '');
  const prices = { assessment: env.STRIPE_PRICE_ASSESSMENT || undefined, blueprint: env.STRIPE_PRICE_BLUEPRINT || undefined, teamMonthly: env.STRIPE_PRICE_TEAM_MONTHLY || undefined };
  const off = (reason: string): BillingConfig => ({ mode: 'off', enabled: false, reason, prices, appUrl });

  if (requested === 'off' || requested === '') return off('Billing is off (BILLING_MODE is not set). Every feature is available without payment.');
  if (requested !== 'test' && requested !== 'live') return off(`Unknown BILLING_MODE "${requested}"; billing stays off.`);

  const key = env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!key) return off('BILLING_MODE is set but STRIPE_SECRET_KEY is missing; billing stays off.');
  if (!webhookSecret?.startsWith('whsec_')) return off('STRIPE_WEBHOOK_SECRET is missing or malformed; without it payments cannot be fulfilled, so billing stays off.');
  if (!prices.assessment && !prices.blueprint && !prices.teamMonthly) return off('No Stripe price ids are configured (STRIPE_PRICE_ASSESSMENT, STRIPE_PRICE_BLUEPRINT, STRIPE_PRICE_TEAM_MONTHLY); billing stays off.');

  if (requested === 'test') {
    if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) return off('BILLING_MODE=test requires a Stripe test key (sk_test_…). A live key was refused.');
    return { mode: 'test', enabled: true, reason: 'Stripe test mode. No real money moves.', secretKey: key, webhookSecret, prices, appUrl };
  }
  if (!key.startsWith('sk_live_') && !key.startsWith('rk_live_')) return off('BILLING_MODE=live requires a live key; billing stays off.');
  if (env.BILLING_ALLOW_LIVE !== '1') return off('Live billing needs BILLING_ALLOW_LIVE=1 as a second, explicit switch; billing stays off.');
  return { mode: 'live', enabled: true, reason: 'Live billing is enabled.', secretKey: key, webhookSecret, prices, appUrl };
}
