import { defineConfig, devices } from "@playwright/test";

// Pro billing against the real API in Stripe test-mode configuration. The API
// gets a fake test key (checkout calls to Stripe fail, which the suite checks)
// and a known webhook secret, so the tests can sign events the way Stripe does.
// Run after the main suite: it needs port 8472 to itself.

export const WEBHOOK_SECRET = "whsec_e2e_consumer";
const web = "http://127.0.0.1:43123";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /billing\.spec/,
  timeout: 60_000,
  use: { baseURL: web, trace: "on-first-retry" },
  projects: [{ name: "billing", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "PYTHONPATH=packages/core/src python3 -m uvicorn services.api.main:app --host 127.0.0.1 --port 8472",
      cwd: "../..",
      url: "http://127.0.0.1:8472/health",
      reuseExistingServer: false,
      env: {
        BILLING_MODE: "test",
        STRIPE_SECRET_KEY: "sk_test_e2e_not_a_real_key",
        STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
        STRIPE_PRICE_PRO: "price_e2e_pro",
        APP_URL: web,
      },
    },
    { command: "npm run start", url: web, reuseExistingServer: true },
  ],
});
