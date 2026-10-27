import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  PlatformError,
  SESSION_TTL_SECONDS,
  billingConfig,
  contextFor,
  listUserOrgs,
  resolveSession,
  resolveStore,
  type AuthContext,
  type KvStore,
  type Org,
  type PublicUser,
  type Role,
  type StoreResolution,
  publicUser,
} from '@aifit/platform';

/**
 * The Teams app's only door into @aifit/platform. Route handlers and server
 * components call these; nothing in a client component touches the store.
 */

export const SESSION_COOKIE = 'aifit_session';
export const ORG_COOKIE = 'aifit_org';

let resolution: StoreResolution | null = null;
export function storeResolution(): StoreResolution {
  resolution ??= resolveStore(process.env);
  return resolution;
}

export function workspacesEnabled(): boolean {
  return storeResolution().store !== null;
}

export function requireStore(): KvStore {
  const { store, reason } = storeResolution();
  if (!store) throw new PlatformError('unavailable', `Workspaces are not available on this deployment. ${reason}`);
  return store;
}

export function billing() {
  return billingConfig(process.env);
}

export interface Viewer {
  user: PublicUser;
  token: string;
  ctx: AuthContext;
  org: Org & { role: Role };
  orgs: (Org & { role: Role })[];
}

/** The signed-in person and their active workspace, or null. Never throws for "not signed in". */
export async function currentViewer(): Promise<Viewer | null> {
  const { store } = storeResolution();
  if (!store) return null;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const session = await resolveSession(store, token);
  if (!session || !token) return null;
  const orgs = await listUserOrgs(store, session.user.id);
  if (orgs.length === 0) return null;
  const wanted = jar.get(ORG_COOKIE)?.value;
  const org = orgs.find((o) => o.id === wanted) ?? orgs.find((o) => o.id === session.user.personalOrgId) ?? orgs[0]!;
  // contextFor re-reads the membership row: the cookie only names a preference.
  const ctx = await contextFor(store, session.user.id, org.id);
  return { user: publicUser(session.user), token, ctx, org, orgs };
}

export async function requireViewer(): Promise<Viewer> {
  requireStore();
  const v = await currentViewer();
  if (!v) throw new PlatformError('unauthenticated', 'Sign in to use workspaces.');
  return v;
}

/**
 * Mutating requests must come from this site. SameSite=Lax cookies already
 * stop cross-site form posts from carrying the session; this check also stops
 * cross-site fetches, and requests without an Origin header are refused.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!origin || !host) throw new PlatformError('forbidden', 'Cross-site request refused.');
  let o: URL;
  try { o = new URL(origin); } catch { throw new PlatformError('forbidden', 'Cross-site request refused.'); }
  if (o.host !== host) throw new PlatformError('forbidden', 'Cross-site request refused.');
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function clearCookie(name: string) {
  return { name, value: '', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 0 };
}

export function clientKey(req: Request): string {
  const xff = (req.headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff[xff.length - 1] || req.headers.get('x-real-ip') || 'unknown';
}

/** Uniform JSON errors. Unexpected errors are logged and answered generically. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof PlatformError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: { 'cache-control': 'no-store' } });
  }
  console.error('[teams] unexpected error', e);
  return NextResponse.json({ error: 'Something went wrong on our side.', code: 'internal' }, { status: 500 });
}

export function json(data: unknown, init: ResponseInit = {}): NextResponse {
  return NextResponse.json(data, { ...init, headers: { 'cache-control': 'no-store', ...(init.headers ?? {}) } });
}

export async function readBody(req: Request, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new PlatformError('invalid', 'Request body is too large.');
  try {
    const v = JSON.parse(text || '{}');
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error();
    return v as Record<string, unknown>;
  } catch {
    throw new PlatformError('invalid', 'Body must be a JSON object.');
  }
}
