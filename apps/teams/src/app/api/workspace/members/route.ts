import { sendInvite } from '@/server/email';
import { ROLES, changeRole, createInvite, listMembers, removeMember, PlatformError, type Role } from '@aifit/platform';
import { assertSameOrigin, errorResponse, json, readBody, requireStore, requireViewer } from '@/server/platform';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const v = await requireViewer();
    return json({ members: await listMembers(requireStore(), v.ctx), role: v.ctx.role });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * Invite by email. When email is set up (RESEND_API_KEY, EMAIL_FROM, APP_URL)
 * the invite is also emailed; the response always carries the link's path so
 * the admin can copy it, and the browser prefixes its own origin.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const v = await requireViewer();
    const body = await readBody(req, 2048);
    const role = String(body.role ?? 'member');
    if (role !== 'viewer' && role !== 'member' && role !== 'admin') throw new PlatformError('invalid', 'Role must be viewer, member or admin.');
    const { token, invite } = await createInvite(requireStore(), v.ctx, String(body.email ?? ''), role);
    const emailed = await sendInvite(invite.email, v.org.name, v.user.name, token).catch(() => false);
    return json({ invite: { email: invite.email, role: invite.role, expiresAt: invite.expiresAt }, path: `/invite#token=${token}`, emailed }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const v = await requireViewer();
    const body = await readBody(req, 1024);
    const role = String(body.role ?? '') as Role;
    if (!ROLES.includes(role)) throw new PlatformError('invalid', 'Unknown role.');
    await changeRole(requireStore(), v.ctx, String(body.userId ?? ''), role);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const v = await requireViewer();
    const body = await readBody(req, 1024);
    await removeMember(requireStore(), v.ctx, String(body.userId ?? ''));
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
