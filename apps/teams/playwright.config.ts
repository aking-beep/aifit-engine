import { defineConfig, devices } from '@playwright/test';

/**
 * Two production servers over the same build:
 *  - :3011 billing off (the default deployment shape)
 *  - :3012 BILLING_MODE=test with fake Stripe keys, so fulfilment can be driven
 *    by webhooks the tests sign themselves. No request reaches Stripe.
 * Each run uses fresh, throwaway file stores under .data/ (gitignored).
 */
const run = Date.now().toString(36);
const fakeStripe = {
  BILLING_MODE: 'test',
  STRIPE_SECRET_KEY: 'sk_test_e2e_not_a_real_key',
  STRIPE_WEBHOOK_SECRET: 'whsec_e2e_local_signing_only',
  STRIPE_PRICE_BLUEPRINT: 'price_e2e_blueprint',
  STRIPE_PRICE_TEAM_MONTHLY: 'price_e2e_team',
};

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3011', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /billing\.spec/ },
    { name: 'billing', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3012' }, testMatch: /billing\.spec/ },
  ],
  webServer: [
    {
      command: 'npx next start -p 3011',
      url: 'http://127.0.0.1:3011',
      env: { AIFIT_TEAMS_STORE: `.data/e2e-${run}-off` },
      reuseExistingServer: false,
    },
    {
      command: 'npx next start -p 3012',
      url: 'http://127.0.0.1:3012',
      env: { AIFIT_TEAMS_STORE: `.data/e2e-${run}-test`, ...fakeStripe },
      reuseExistingServer: false,
    },
  ],
});
