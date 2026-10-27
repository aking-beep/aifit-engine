import { authorize, createCheckoutSession, getAssessment, PlatformError, randomToken, WK } from '@aifit/platform';
import { assertSameOrigin, billing, errorResponse, json, readBody, requireStore, requireViewer } from '@/server/platform';

export const dynamic = 'force-dynamic';

/**
 * Start a Stripe-hosted Checkout. Grants nothing: entitlements are written only
 * by the verified webhook. The client is redirected to the returned URL.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const v = await requireViewer();
    const store = requireStore();
    const cfg = billing();
    if (!cfg.enabled) throw new PlatformError('unavailable', cfg.reason);
    const body = await readBody(req, 1024);
    const product = body.product === 'team' ? 'team' : body.product === 'blueprint' ? 'blueprint' : null;
    if (!product) throw new PlatformError('invalid', 'Choose a product.');
    let assessmentRootId: string | undefined;
    if (product === 'team') authorize(v.ctx, 'billing:manage');
    else {
      authorize(v.ctx, 'export:download');
      assessmentRootId = (await getAssessment(store, v.ctx, String(body.assessmentId ?? ''))).rootId;
    }
    const session = await createCheckoutSession(cfg, {
      product,
      orgId: v.ctx.orgId,
      userId: v.user.id,
      email: v.user.email,
      assessmentRootId,
      idempotencyKey: `${v.ctx.orgId}:${product}:${assessmentRootId ?? ''}:${randomToken(9)}`,
    });
    await store.set(WK.checkout(session.id), { status: 'pending', orgId: v.ctx.orgId }, { ttlSeconds: 60 * 60 * 24 * 30 });
    return json({ url: session.url });
  } catch (e) {
    return errorResponse(e);
  }
}
