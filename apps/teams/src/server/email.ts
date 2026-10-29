import { emailConfig, sendEmail, templates, type Lead } from '@aifit/platform';

/** Teams email: the platform's provider-neutral sender with this app's name and URL. */
const PRODUCT = 'AI Fit Teams';

export function email() {
  return emailConfig(process.env);
}

export function sendReset(to: string, token: string) {
  const cfg = email();
  return sendEmail(cfg, { to, ...templates.passwordReset(PRODUCT, `${cfg.appUrl}/reset?token=${encodeURIComponent(token)}`, 30) });
}

export function sendPasswordChanged(to: string) {
  return sendEmail(email(), { to, ...templates.passwordChanged(PRODUCT) });
}

export function sendInvite(to: string, orgName: string, inviter: string, token: string) {
  const cfg = email();
  return sendEmail(cfg, { to, ...templates.invite(PRODUCT, orgName, inviter, `${cfg.appUrl}/invite#token=${encodeURIComponent(token)}`, 7) });
}

export function sendReceipt(to: string, item: string, amountCents: number | null, currency: string | null, eventId: string) {
  const cfg = email();
  const amount = amountCents === null ? 'see the Stripe receipt' : new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency ?? 'usd').toUpperCase() }).format(amountCents / 100);
  return sendEmail(cfg, { to, idempotencyKey: `receipt-${eventId}`, ...templates.receipt(PRODUCT, item, amount, new Date().toISOString().slice(0, 10), `${cfg.appUrl}/workspace/billing`) });
}

/** Tells the operator a lead arrived. LEAD_NOTIFY_EMAIL unset: no notice. The lead itself is stored or forwarded regardless. */
export function notifyLead(lead: Lead) {
  const to = process.env.LEAD_NOTIFY_EMAIL?.trim();
  if (!to) return Promise.resolve(false);
  const utm = lead.source.attribution?.utm ?? {};
  const summary = [
    `Email: ${lead.email}`, lead.name && `Name: ${lead.name}`, lead.company && `Company: ${lead.company}`, lead.role && `Role: ${lead.role}`,
    `Interest: ${lead.interest}`, lead.message && `Message: ${lead.message}`, `Page: ${lead.source.app}/${lead.source.page}`,
    utm.utm_source && `Campaign: ${utm.utm_source} / ${utm.utm_medium ?? '-'} / ${utm.utm_campaign ?? '-'}`,
  ].filter(Boolean).join('\n');
  return sendEmail(email(), { to, idempotencyKey: lead.id, ...templates.leadNotice(PRODUCT, summary) });
}
