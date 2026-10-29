import { PlatformError, deleteAccount, exportAccount } from '@aifit/platform';
import { ORG_COOKIE, SESSION_COOKIE, assertSameOrigin, clearCookie, errorResponse, json, readBody, requireStore, requireViewer } from '@/server/platform';

export const dynamic = 'force-dynamic';

/** Everything stored about you, as a JSON download. */
export async function GET() {
  try {
    const v = await requireViewer();
    const data = await exportAccount(requireStore(), v.user.id);
    return json(data, { headers: { 'content-disposition': 'attachment; filename="aifit-teams-account.json"' } });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Delete the account. The body must repeat the account's email, so it cannot happen by accident. */
export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const v = await requireViewer();
    const body = await readBody(req, 1024);
    if (String(body.confirmEmail ?? '').trim().toLowerCase() !== v.user.email) {
      throw new PlatformError('invalid', 'Type your account email to confirm deletion.');
    }
    const result = await deleteAccount(requireStore(), v.user.id);
    const res = json({ deleted: true, ...result });
    res.cookies.set(clearCookie(SESSION_COOKIE));
    res.cookies.set(clearCookie(ORG_COOKIE));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
