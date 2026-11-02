import { authorize, createPortalSession, PlatformError, readEntitlements } from '@aifit/platform';
import { assertSameOrigin, billing, errorResponse, json, requireStore, requireViewer } from '@/server/platform';

export const dynamic = 'force-dynamic';

/**
 * Open the Stripe customer portal for this workspace's plan: update the card,
 * download invoices, cancel. Admins and owners only. Nothing changes here;
 * whatever happens in the portal reaches the app through verified webhooks.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const v = await requireViewer();
    const store = requireStore();
    const cfg = billing();
    if (!cfg.enabled) throw new PlatformError('unavailable', cfg.reason);
    authorize(v.ctx, 'billing:manage');
    const customerId = (await readEntitlements(store, v.ctx.orgId)).subscription?.customerId;
    if (!customerId) throw new PlatformError('not_found', 'This workspace has no Stripe subscription yet.');
    return json(await createPortalSession(cfg, customerId));
  } catch (e) {
    return errorResponse(e);
  }
}
