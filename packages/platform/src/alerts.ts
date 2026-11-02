import type { KvStore } from './store/index.js';
import { emailConfig, sendEmail } from './email.js';

/**
 * Operator alerts: tell the owner when something that loses money or customers
 * breaks (a Stripe webhook failing, checkout or the billing portal not
 * opening, an unexpected server error) instead of learning it from a customer.
 *
 * Off until configured. ALERT_WEBHOOK_URL (HTTPS; Slack, Discord or any
 * endpoint that accepts JSON) and/or ALERT_EMAIL (sent through Resend). One
 * alert per app and kind per throttle window, so an outage does not flood the
 * inbox. Details are scrubbed of email addresses and key-shaped strings, and
 * sending never throws.
 */

export type AlertKind = 'server_error' | 'webhook_failed' | 'checkout_failed' | 'portal_failed';

export interface Alert {
  app: 'ai-fit' | 'ai-fit-teams';
  kind: AlertKind;
  /** What failed, for a person: route and reason. Never customer data. */
  detail: string;
}

export interface AlertConfig {
  enabled: boolean;
  webhookUrl: string | null;
  email: string | null;
  environment: string;
  throttleSeconds: number;
}

export const ALERT_THROTTLE_SECONDS = 15 * 60;

export function alertConfig(env: Record<string, string | undefined>): AlertConfig {
  const url = env.ALERT_WEBHOOK_URL?.trim();
  const webhookUrl = url && url.startsWith('https://') ? url : null;
  const mail = env.ALERT_EMAIL?.trim();
  const email = mail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? mail : null;
  return {
    enabled: Boolean(webhookUrl || email),
    webhookUrl,
    email,
    environment: env.VERCEL_ENV || env.NODE_ENV || 'development',
    throttleSeconds: ALERT_THROTTLE_SECONDS,
  };
}

/** Removes email addresses and anything shaped like a key, token or signature. */
export function scrubDetail(text: string): string {
  return text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]')
    .replace(/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]+/g, '[key]')
    .replace(/\bwhsec_[A-Za-z0-9]+/g, '[key]')
    .replace(/\bsk-ant-[A-Za-z0-9_-]+/g, '[key]')
    .replace(/\bre_[A-Za-z0-9_]{16,}/g, '[key]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [key]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[token]')
    .slice(0, 500);
}

const memoryThrottle = new Map<string, number>();

async function claim(store: KvStore | null, key: string, ttl: number): Promise<boolean> {
  if (store) {
    try {
      return await store.set(key, 1, { ttlSeconds: ttl, nx: true });
    } catch {
      /* fall through to the per-instance throttle */
    }
  }
  const now = Date.now();
  const until = memoryThrottle.get(key) ?? 0;
  if (until > now) return false;
  memoryThrottle.set(key, now + ttl * 1000);
  return true;
}

/** Sends one alert if configured and not throttled. Returns whether anything was sent. */
export async function raiseAlert(
  cfg: AlertConfig,
  store: KvStore | null,
  alert: Alert,
  deps: { fetchImpl?: typeof fetch; env?: Record<string, string | undefined>; now?: Date } = {},
): Promise<boolean> {
  if (!cfg.enabled) return false;
  try {
    if (!(await claim(store, `alert:${alert.app}:${alert.kind}`, cfg.throttleSeconds))) return false;
    const detail = scrubDetail(alert.detail);
    const at = (deps.now ?? new Date()).toISOString();
    const title = `[${alert.app} ${cfg.environment}] ${alert.kind.replace('_', ' ')}`;
    const text = `${title}\n${detail}\n${at}\nFurther alerts of this kind are held for ${Math.round(cfg.throttleSeconds / 60)} minutes.`;
    const fetchImpl = deps.fetchImpl ?? fetch;
    let sent = false;
    if (cfg.webhookUrl) {
      const res = await fetchImpl(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // `text` is what Slack reads, `content` what Discord reads; the rest is for anything else.
        body: JSON.stringify({ type: 'aifit.alert', app: alert.app, kind: alert.kind, environment: cfg.environment, detail, at, text, content: text }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      sent = Boolean(res?.ok);
    }
    if (cfg.email) {
      const mail = emailConfig(deps.env ?? process.env);
      sent = (await sendEmail(mail, { to: cfg.email, subject: title, text }, fetchImpl)) || sent;
    }
    return sent;
  } catch {
    return false;
  }
}
