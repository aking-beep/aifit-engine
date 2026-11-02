/**
 * Transactional email, provider-neutral. Resend is the first adapter (plain
 * REST, no SDK); another provider is one more `send` implementation. Off unless
 * RESEND_API_KEY and EMAIL_FROM are set, and every caller treats "off" as a
 * normal state, never an error the person sees as a crash.
 */

export interface EmailConfig {
  enabled: boolean;
  reason: string;
  apiKey?: string;
  from?: string;
  replyTo?: string;
  appUrl: string;
}

export function emailConfig(env: Record<string, string | undefined>): EmailConfig {
  const appUrl = (env.APP_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'http://localhost:3001')).replace(/\/+$/, '');
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey) return { enabled: false, reason: 'Email is off (RESEND_API_KEY is not set).', appUrl };
  if (!from || !/^[^<>@\s]+@[^<>@\s]+\.[a-z]{2,}$|^.+<[^<>@\s]+@[^<>@\s]+\.[a-z]{2,}>$/i.test(from)) {
    return { enabled: false, reason: 'Email is off (EMAIL_FROM is missing or not an address).', appUrl };
  }
  return { enabled: true, reason: 'Email is on.', apiKey, from, replyTo: env.EMAIL_REPLY_TO?.trim() || undefined, appUrl };
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Idempotency key so a retried webhook does not send the same receipt twice. */
  idempotencyKey?: string;
}

/** Plain text only: no tracking pixels, no remote images, links written out in full. */
export async function sendEmail(cfg: EmailConfig, msg: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!cfg.enabled || !cfg.apiKey || !cfg.from) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.to) || msg.to.length > 254) return false;
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${cfg.apiKey}`,
        'content-type': 'application/json',
        ...(msg.idempotencyKey ? { 'idempotency-key': msg.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({ from: cfg.from, to: [msg.to], subject: msg.subject.slice(0, 200), text: msg.text, ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const footer = (product: string) => `\n\n—\n${product} · ARC Transformation Group\nYou are receiving this because of an action on your account.`;

export const templates = {
  passwordReset(product: string, link: string, minutes: number): Pick<EmailMessage, 'subject' | 'text'> {
    return {
      subject: `Reset your ${product} password`,
      text: `Someone asked to reset the password for this email address.\n\nTo choose a new password, open this link within ${minutes} minutes:\n${link}\n\nIf it was not you, ignore this email: your password stays the same.${footer(product)}`,
    };
  },
  passwordChanged(product: string): Pick<EmailMessage, 'subject' | 'text'> {
    return {
      subject: `Your ${product} password was changed`,
      text: `The password for your ${product} account was just changed, and every other session was signed out.\n\nIf this was not you, reset your password now and reply to this email.${footer(product)}`,
    };
  },
  receipt(product: string, item: string, amount: string, when: string, manageUrl: string): Pick<EmailMessage, 'subject' | 'text'> {
    return {
      subject: `Receipt: ${item}`,
      text: `Thank you. Stripe confirmed your payment.\n\nItem: ${item}\nAmount: ${amount}\nDate: ${when}\n\nManage billing: ${manageUrl}\nStripe also sends its own receipt with the tax details.${footer(product)}`,
    };
  },
  invite(product: string, orgName: string, inviter: string, link: string, days: number): Pick<EmailMessage, 'subject' | 'text'> {
    return {
      subject: `${inviter} invited you to ${orgName} on ${product}`,
      text: `${inviter} invited you to join the "${orgName}" workspace on ${product}.\n\nAccept within ${days} days:\n${link}\n\nIf you were not expecting this, ignore it.${footer(product)}`,
    };
  },
  leadNotice(product: string, summary: string): Pick<EmailMessage, 'subject' | 'text'> {
    return { subject: `New ${product} lead`, text: `${summary}${footer(product)}` };
  },
};
