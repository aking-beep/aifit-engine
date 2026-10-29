import { PlatformError, forwardLead, parseLead, rateLimit, saveLead, type Lead } from '@aifit/platform';
import { notifyLead } from './email';
import { currentViewer, storeResolution } from './platform';

/**
 * Lead intake for the Teams app. Stored when a durable store exists, and
 * forwarded to LEAD_WEBHOOK_URL when one is set. With neither, the form is
 * off and the page points people at the booking link instead.
 */
export function leadsEnabled(): { enabled: boolean; reason: string } {
  const { store } = storeResolution();
  if (store || process.env.LEAD_WEBHOOK_URL) return { enabled: true, reason: 'Lead capture is on.' };
  return { enabled: false, reason: 'Lead capture needs a durable store (Upstash) or LEAD_WEBHOOK_URL.' };
}

export async function acceptLead(raw: unknown, clientKey: string): Promise<{ stored: boolean; forwarded: boolean; spam: boolean }> {
  const { store } = storeResolution();
  const { lead, spam } = parseLead(raw);
  if (store) await rateLimit(store, 'lead', clientKey, 5, 60 * 60);
  // Bots that fill the honeypot get the same answer as people, and nothing is kept.
  if (spam) return { stored: false, forwarded: false, spam: true };
  const viewer = await currentViewer().catch(() => null);
  const now = new Date();
  const record: Lead = store
    ? await saveLead(store, lead, viewer?.user.id ?? null, now)
    : { ...withoutPrivate(lead), id: `lead_unstored_${now.getTime()}`, receivedAt: now.toISOString(), consentAt: now.toISOString(), userId: viewer?.user.id ?? null };
  const forwarded = await forwardLead({ url: process.env.LEAD_WEBHOOK_URL, secret: process.env.LEAD_WEBHOOK_SECRET }, record);
  if (!store && !forwarded) throw new PlatformError('unavailable', 'We could not record that right now. Please book a call instead.');
  await notifyLead(record).catch(() => false);
  return { stored: Boolean(store), forwarded, spam: false };
}

function withoutPrivate(lead: ReturnType<typeof parseLead>['lead']) {
  const { website: _w, consent: _c, ...rest } = lead;
  return rest;
}
