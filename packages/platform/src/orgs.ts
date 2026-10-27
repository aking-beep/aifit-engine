import { z } from 'zod';
import type { KvStore } from './store/types.js';
import { PlatformError } from './errors.js';
import { K as UK, findUserByEmail, getUser } from './auth.js';
import { randomId, randomToken, sha256 } from './crypto.js';

export const ROLES = ['viewer', 'member', 'admin', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export type Action =
  | 'assessment:read' | 'assessment:write' | 'assessment:delete' | 'export:download'
  | 'members:read' | 'members:manage' | 'billing:manage' | 'org:delete' | 'audit:read';

/** The whole permission model in one table. Higher roles include lower ones. */
const MIN_ROLE: Record<Action, Role> = {
  'assessment:read': 'viewer',
  'members:read': 'viewer',
  'assessment:write': 'member',
  'export:download': 'member',
  'assessment:delete': 'admin',
  'members:manage': 'admin',
  'billing:manage': 'admin',
  'audit:read': 'admin',
  'org:delete': 'owner',
};

export function can(role: Role, action: Action): boolean {
  return ROLES.indexOf(role) >= ROLES.indexOf(MIN_ROLE[action]);
}

export interface Org {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
}

export interface Membership {
  orgId: string;
  userId: string;
  role: Role;
  addedAt: string;
}

/** Who is acting, in which org, as what. Every org-scoped call takes one. */
export interface AuthContext {
  userId: string;
  orgId: string;
  role: Role;
}

export const OK = {
  org: (id: string) => `org:${id}`,
  members: (id: string) => `org:${id}:members`,
  member: (orgId: string, userId: string) => `org:${orgId}:member:${userId}`,
  invite: (hash: string) => `invite:${hash}`,
  invites: (orgId: string) => `org:${orgId}:invites`,
  audit: (orgId: string) => `org:${orgId}:audit`,
};

export function authorize(ctx: AuthContext, action: Action): void {
  if (!can(ctx.role, action)) throw new PlatformError('forbidden', `Your role (${ctx.role}) cannot do that here.`);
}

export async function audit(store: KvStore, orgId: string, actor: string, event: string, detail: Record<string, unknown> = {}) {
  await store.lpush(OK.audit(orgId), { at: new Date().toISOString(), actor, event, detail }, 500);
}

export async function createOrg(store: KvStore, ownerId: string, name: string, id = randomId('org')): Promise<Org> {
  const clean = z.string().trim().min(1).max(100).safeParse(name);
  if (!clean.success) throw new PlatformError('invalid', 'Organisation name must be 1–100 characters.');
  const org: Org = { id, name: clean.data, createdAt: new Date().toISOString(), createdBy: ownerId };
  await store.set(OK.org(id), org);
  await addMembership(store, id, ownerId, 'owner');
  await audit(store, id, ownerId, 'org.created', { name: org.name });
  return org;
}

async function addMembership(store: KvStore, orgId: string, userId: string, role: Role) {
  const m: Membership = { orgId, userId, role, addedAt: new Date().toISOString() };
  await store.set(OK.member(orgId, userId), m);
  await store.sadd(OK.members(orgId), userId);
  await store.sadd(UK.userOrgs(userId), orgId);
}

export async function getOrg(store: KvStore, orgId: string): Promise<Org | null> {
  return store.get<Org>(OK.org(orgId));
}

/**
 * The only way to obtain an AuthContext: the user must hold a membership row
 * in that org. A forged or guessed org id yields not_found, never data.
 */
export async function contextFor(store: KvStore, userId: string, orgId: string): Promise<AuthContext> {
  const m = await store.get<Membership>(OK.member(orgId, userId));
  if (!m || m.userId !== userId || m.orgId !== orgId) throw new PlatformError('not_found', 'Workspace not found.');
  return { userId, orgId, role: m.role };
}

export async function listUserOrgs(store: KvStore, userId: string): Promise<(Org & { role: Role })[]> {
  const out: (Org & { role: Role })[] = [];
  for (const orgId of await store.smembers(UK.userOrgs(userId))) {
    const [org, m] = await Promise.all([getOrg(store, orgId), store.get<Membership>(OK.member(orgId, userId))]);
    if (org && m) out.push({ ...org, role: m.role });
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listMembers(store: KvStore, ctx: AuthContext) {
  authorize(ctx, 'members:read');
  const rows = [];
  for (const userId of await store.smembers(OK.members(ctx.orgId))) {
    const [m, u] = await Promise.all([store.get<Membership>(OK.member(ctx.orgId, userId)), getUser(store, userId)]);
    if (m && u) rows.push({ userId, email: u.email, name: u.name, role: m.role, addedAt: m.addedAt });
  }
  return rows.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

async function owners(store: KvStore, orgId: string): Promise<string[]> {
  const out: string[] = [];
  for (const userId of await store.smembers(OK.members(orgId))) {
    const m = await store.get<Membership>(OK.member(orgId, userId));
    if (m?.role === 'owner') out.push(userId);
  }
  return out;
}

export interface Invite {
  orgId: string;
  email: string;
  role: Exclude<Role, 'owner'>;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Creates an invite and returns its one-time token. No email is sent by this
 * build: the admin copies the link. Only the token's hash is stored.
 */
export async function createInvite(store: KvStore, ctx: AuthContext, email: string, role: Invite['role']): Promise<{ token: string; invite: Invite }> {
  authorize(ctx, 'members:manage');
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(254), role: z.enum(['viewer', 'member', 'admin']) }).safeParse({ email, role });
  if (!parsed.success) throw new PlatformError('invalid', 'Enter a valid email and role.');
  if (parsed.data.role === 'admin' && ctx.role !== 'owner' && ctx.role !== 'admin') throw new PlatformError('forbidden', 'Only admins can invite admins.');
  const token = randomToken();
  const now = new Date();
  const invite: Invite = {
    orgId: ctx.orgId,
    email: parsed.data.email,
    role: parsed.data.role,
    invitedBy: ctx.userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + INVITE_TTL_SECONDS * 1000).toISOString(),
  };
  const hash = sha256(token);
  await store.set(OK.invite(hash), invite, { ttlSeconds: INVITE_TTL_SECONDS });
  await store.sadd(OK.invites(ctx.orgId), hash);
  await audit(store, ctx.orgId, ctx.userId, 'member.invited', { email: invite.email, role: invite.role });
  return { token, invite };
}

/** The invite is bound to an email: only the account with that email can accept it. */
export async function acceptInvite(store: KvStore, userId: string, token: string): Promise<AuthContext> {
  const hash = sha256(token);
  const invite = await store.get<Invite>(OK.invite(hash));
  const user = await getUser(store, userId);
  if (!invite || !user || new Date(invite.expiresAt) <= new Date()) throw new PlatformError('not_found', 'That invite is invalid or has expired.');
  if (invite.email !== user.email) throw new PlatformError('forbidden', 'That invite was sent to a different email address.');
  const existing = await store.get<Membership>(OK.member(invite.orgId, userId));
  if (!existing) await addMembership(store, invite.orgId, userId, invite.role);
  await store.del(OK.invite(hash));
  await store.srem(OK.invites(invite.orgId), hash);
  await audit(store, invite.orgId, userId, 'member.joined', { role: existing?.role ?? invite.role });
  return contextFor(store, userId, invite.orgId);
}

export async function changeRole(store: KvStore, ctx: AuthContext, targetUserId: string, role: Role): Promise<void> {
  authorize(ctx, 'members:manage');
  const m = await store.get<Membership>(OK.member(ctx.orgId, targetUserId));
  if (!m) throw new PlatformError('not_found', 'That person is not in this workspace.');
  if ((m.role === 'owner' || role === 'owner') && ctx.role !== 'owner') throw new PlatformError('forbidden', 'Only an owner can change owners.');
  if (m.role === 'owner' && role !== 'owner' && (await owners(store, ctx.orgId)).length === 1) {
    throw new PlatformError('conflict', 'A workspace needs at least one owner.');
  }
  await store.set(OK.member(ctx.orgId, targetUserId), { ...m, role });
  await audit(store, ctx.orgId, ctx.userId, 'member.role_changed', { userId: targetUserId, from: m.role, to: role });
}

export async function removeMember(store: KvStore, ctx: AuthContext, targetUserId: string): Promise<void> {
  if (targetUserId !== ctx.userId) authorize(ctx, 'members:manage');
  const m = await store.get<Membership>(OK.member(ctx.orgId, targetUserId));
  if (!m) throw new PlatformError('not_found', 'That person is not in this workspace.');
  if (m.role === 'owner' && ctx.role !== 'owner') throw new PlatformError('forbidden', 'Only an owner can remove an owner.');
  if (m.role === 'owner' && (await owners(store, ctx.orgId)).length === 1) throw new PlatformError('conflict', 'A workspace needs at least one owner.');
  await store.del(OK.member(ctx.orgId, targetUserId));
  await store.srem(OK.members(ctx.orgId), targetUserId);
  await store.srem(UK.userOrgs(targetUserId), ctx.orgId);
  await audit(store, ctx.orgId, ctx.userId, 'member.removed', { userId: targetUserId });
}

export async function readAudit(store: KvStore, ctx: AuthContext, limit = 100) {
  authorize(ctx, 'audit:read');
  return store.lrange<{ at: string; actor: string; event: string; detail: Record<string, unknown> }>(OK.audit(ctx.orgId), 0, limit - 1);
}

export { findUserByEmail };
