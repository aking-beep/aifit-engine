import { checkEntitlement, readEntitlements, WK, authorize } from '@aifit/platform';
import { billing, errorResponse, json, requireStore, requireViewer } from '@/server/platform';

export const dynamic = 'force-dynamic';

/** Billing state for the active workspace, and the status of one checkout this workspace started. */
export async function GET(req: Request) {
  try {
    const v = await requireViewer();
    const store = requireStore();
    const cfg = billing();
    const sessionId = new URL(req.url).searchParams.get('session_id');
    let checkout: { status: string } | null = null;
    if (sessionId && /^cs_[A-Za-z0-9_]{1,200}$/.test(sessionId)) {
      const rec = await store.get<{ status: string; orgId: string | null }>(WK.checkout(sessionId));
      checkout = rec && rec.orgId === v.ctx.orgId ? { status: rec.status } : null;
    }
    const canSeeBilling = (() => { try { authorize(v.ctx, 'billing:manage'); return true; } catch { return false; } })();
    const ent = await readEntitlements(store, v.ctx.orgId);
    return json({
      mode: cfg.mode,
      enabled: cfg.enabled,
      reason: cfg.reason,
      plan: ent.plan,
      subscriptionStatus: canSeeBilling ? ent.subscription?.status ?? null : undefined,
      purchases: ent.purchases.length,
      checkout,
      teamFeatures: v.ctx.role === 'viewer' ? null : await checkEntitlement(store, v.ctx, cfg, 'control-export', '').catch(() => null),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
