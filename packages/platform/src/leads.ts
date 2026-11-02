import { createHmac } from 'node:crypto';
import { z } from 'zod';
import type { KvStore } from './store/types.js';
import { PlatformError } from './errors.js';
import { randomId, safeEqual } from './crypto.js';

/**
 * Leads from the "Get a follow-up from ARC" form. Stored for the operator,
 * not for any workspace: no organisation can read them. Optionally forwarded
 * to a CRM or automation (Zapier, Make, HubSpot) as a signed webhook.
 */

const text = (max: number) => z.string().trim().max(max);
const token = z.string().trim().max(120).regex(/^[\w.\-~ +:/@]*$/);

export const LeadSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: text(100).optional(),
  company: text(120).optional(),
  role: text(100).optional(),
  interest: z.enum(['assessment', 'blueprint', 'workspace', 'advisory', 'personal', 'other']),
  message: text(1000).optional(),
  consent: z.literal(true),
  website: z.string().max(200).optional(),
  source: z.object({
    app: z.enum(['ai-fit', 'ai-fit-teams']),
    page: z.string().trim().max(120).regex(/^[\w\-/]*$/),
    attribution: z.object({
      utm: z.partialRecord(z.enum(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']), token).default({}),
      clickIds: z.partialRecord(z.enum(['gclid', 'fbclid', 'li_fat_id', 'msclkid']), token).default({}),
      landingPath: z.string().max(200).default('/'),
      referrerHost: z.string().max(200).nullable().default(null),
      firstSeenAt: z.string().max(40),
    }).nullable(),
  }).strict(),
}).strict();

export type LeadInputData = z.input<typeof LeadSchema>;
export type Lead = Omit<z.output<typeof LeadSchema>, 'website' | 'consent'> & {
  id: string;
  receivedAt: string;
  consentAt: string;
  /** The signed-in user who sent it, when there was one. */
  userId: string | null;
};

export const LK = {
  lead: (id: string) => `lead:${id}`,
  index: 'leads:recent',
};

const MAX_INDEX = 5000;

export function parseLead(raw: unknown): { lead: z.output<typeof LeadSchema>; spam: boolean } {
  const parsed = LeadSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    throw new PlatformError('invalid', field === 'email' ? 'Enter a valid email address.' : field === 'consent' ? 'Tick the box so we may contact you about this request.' : 'Some of the details are not valid.');
  }
  return { lead: parsed.data, spam: Boolean(parsed.data.website) };
}

export async function saveLead(store: KvStore, input: z.output<typeof LeadSchema>, userId: string | null, now = new Date()): Promise<Lead> {
  const { website: _hp, consent: _c, ...rest } = input;
  const lead: Lead = { ...rest, id: randomId('lead'), receivedAt: now.toISOString(), consentAt: now.toISOString(), userId };
  await store.set(LK.lead(lead.id), lead);
  await store.lpush(LK.index, lead.id, MAX_INDEX);
  return lead;
}

export async function listLeads(store: KvStore, limit = 500): Promise<Lead[]> {
  const ids = await store.lrange<string>(LK.index, 0, Math.min(limit, MAX_INDEX) - 1);
  const rows = await Promise.all(ids.map((id) => store.get<Lead>(LK.lead(id))));
  return rows.filter((r): r is Lead => r !== null);
}

/** The operator reads leads with a bearer token from the environment. Missing token: export is off. */
export function authorizeLeadExport(header: string | null, expected: string | undefined): void {
  if (!expected || expected.length < 24) throw new PlatformError('unavailable', 'Lead export is off (set LEADS_EXPORT_TOKEN, at least 24 characters).');
  const got = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!safeEqual(got, expected)) throw new PlatformError('unauthenticated', 'Wrong or missing token.');
}

export function leadsCsv(leads: Lead[]): string {
  const cols = ['receivedAt', 'email', 'name', 'company', 'role', 'interest', 'message', 'app', 'page', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'referrerHost'] as const;
  // Spreadsheet formula injection: a cell starting with = + - @ is prefixed with a quote.
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = leads.map((l) => [
    l.receivedAt, l.email, l.name, l.company, l.role, l.interest, l.message, l.source.app, l.source.page,
    l.source.attribution?.utm.utm_source, l.source.attribution?.utm.utm_medium, l.source.attribution?.utm.utm_campaign,
    l.source.attribution?.utm.utm_content, l.source.attribution?.referrerHost,
  ].map(cell).join(','));
  return [cols.join(','), ...rows].join('\n') + '\n';
}

export interface LeadForwardConfig {
  url?: string | undefined;
  secret?: string | undefined;
}

/** `t=<unix>,v1=<hex HMAC-SHA256(secret, "t.body")>`, the same scheme Stripe uses, so receivers can verify it. */
export function signLeadPayload(body: string, secret: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`, 'utf8').digest('hex')}`;
}

/** Sends the lead to the configured webhook. Returns false (never throws) so a CRM outage does not lose the lead. */
export async function forwardLead(cfg: LeadForwardConfig, lead: Lead, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!cfg.url) return false;
  let url: URL;
  try {
    url = new URL(cfg.url);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const body = JSON.stringify({ type: 'lead.created', lead });
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cfg.secret ? { 'x-aifit-signature': signLeadPayload(body, cfg.secret) } : {}) },
      body,
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
