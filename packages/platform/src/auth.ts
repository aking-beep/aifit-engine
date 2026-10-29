import { z } from 'zod';
import type { KvStore } from './store/types.js';
import { PlatformError } from './errors.js';
import { hashPassword, randomId, randomToken, sha256, verifyPassword } from './crypto.js';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  personalOrgId: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export interface Session {
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60;

export const SignupInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12, 'Use at least 12 characters.').max(200),
  name: z.string().trim().min(1).max(100),
  orgName: z.string().trim().min(1).max(100).optional(),
}).strict();

export const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
}).strict();

export const K = {
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user-email:${sha256(email)}`,
  userSessions: (id: string) => `user:${id}:sessions`,
  userOrgs: (id: string) => `user:${id}:orgs`,
  session: (tokenHash: string) => `session:${tokenHash}`,
};

export function publicUser(u: User): PublicUser {
  const { passwordHash: _omit, ...rest } = u;
  return rest;
}

// A real hash of a throwaway password, so a login for an unknown email costs
// the same scrypt time as a wrong password and does not reveal which emails exist.
let dummyHash: Promise<string> | null = null;
const timingDecoy = () => (dummyHash ??= hashPassword(randomToken()));

export async function createUser(store: KvStore, input: z.input<typeof SignupInput>, personalOrgId: string): Promise<User> {
  const parsed = SignupInput.safeParse(input);
  if (!parsed.success) throw new PlatformError('invalid', parsed.error.issues[0]?.message ?? 'Invalid sign-up details.');
  const { email, password, name } = parsed.data;
  const id = randomId('usr');
  // Uniqueness: claim the email index first, atomically.
  const claimed = await store.set(K.userByEmail(email), id, { nx: true });
  if (!claimed) throw new PlatformError('conflict', 'An account with that email already exists. Sign in instead.');
  const user: User = { id, email, name, passwordHash: await hashPassword(password), createdAt: new Date().toISOString(), personalOrgId };
  await store.set(K.user(id), user);
  return user;
}

export async function getUser(store: KvStore, id: string): Promise<User | null> {
  return store.get<User>(K.user(id));
}

export async function findUserByEmail(store: KvStore, email: string): Promise<User | null> {
  const id = await store.get<string>(K.userByEmail(email.trim().toLowerCase()));
  return id ? getUser(store, id) : null;
}

export async function authenticate(store: KvStore, input: z.input<typeof LoginInput>): Promise<User> {
  const parsed = LoginInput.safeParse(input);
  if (!parsed.success) throw new PlatformError('invalid', 'Enter your email and password.');
  const user = await findUserByEmail(store, parsed.data.email);
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : (await verifyPassword(parsed.data.password, await timingDecoy()), false);
  if (!user || !ok) throw new PlatformError('unauthenticated', 'That email and password do not match an account.');
  return user;
}

/** Returns the raw token once. Only its SHA-256 is stored, so a store leak does not leak sessions. */
export async function createSession(store: KvStore, userId: string, now = new Date()): Promise<{ token: string; session: Session }> {
  const token = randomToken();
  const hash = sha256(token);
  const session: Session = {
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString(),
  };
  await store.set(K.session(hash), session, { ttlSeconds: SESSION_TTL_SECONDS });
  await store.sadd(K.userSessions(userId), hash);
  return { token, session };
}

export async function resolveSession(store: KvStore, token: string | undefined | null, now = new Date()): Promise<{ user: User; session: Session } | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const hash = sha256(token);
  const session = await store.get<Session>(K.session(hash));
  if (!session || new Date(session.expiresAt) <= now) return null;
  const user = await getUser(store, session.userId);
  return user ? { user, session } : null;
}

export async function revokeSession(store: KvStore, token: string): Promise<void> {
  const hash = sha256(token);
  const session = await store.get<Session>(K.session(hash));
  await store.del(K.session(hash));
  if (session) await store.srem(K.userSessions(session.userId), hash);
}

export async function revokeAllSessions(store: KvStore, userId: string): Promise<void> {
  for (const hash of await store.smembers(K.userSessions(userId))) await store.del(K.session(hash));
  await store.del(K.userSessions(userId));
}

// Password reset ---------------------------------------------------------------

export const RESET_TTL_SECONDS = 30 * 60;
const resetKey = (hash: string) => `pwreset:${hash}`;

interface ResetRecord {
  userId: string;
  expiresAt: string;
}

/**
 * A one-time reset token for this email, or null when no account has it. The
 * caller answers the same way in both cases so the form does not reveal who
 * has an account. Only the token's hash is stored.
 */
export async function createPasswordReset(store: KvStore, email: string, now = new Date()): Promise<{ token: string; user: User } | null> {
  const parsed = z.string().trim().toLowerCase().email().max(254).safeParse(email);
  if (!parsed.success) return null;
  const user = await findUserByEmail(store, parsed.data);
  if (!user) return null;
  const token = randomToken();
  const record: ResetRecord = { userId: user.id, expiresAt: new Date(now.getTime() + RESET_TTL_SECONDS * 1000).toISOString() };
  await store.set(resetKey(sha256(token)), record, { ttlSeconds: RESET_TTL_SECONDS });
  return { token, user };
}

export const ResetInput = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(12, 'Use at least 12 characters.').max(200),
}).strict();

/** Sets the new password, burns the token and signs out every existing session. */
export async function completePasswordReset(store: KvStore, input: z.input<typeof ResetInput>, now = new Date()): Promise<User> {
  const parsed = ResetInput.safeParse(input);
  if (!parsed.success) throw new PlatformError('invalid', parsed.error.issues[0]?.message ?? 'Invalid reset request.');
  const key = resetKey(sha256(parsed.data.token));
  const record = await store.get<ResetRecord>(key);
  // Delete first: a token works once even if two requests race.
  await store.del(key);
  if (!record || new Date(record.expiresAt) <= now) throw new PlatformError('invalid', 'This reset link has expired or was already used. Ask for a new one.');
  const user = await getUser(store, record.userId);
  if (!user) throw new PlatformError('invalid', 'This reset link has expired or was already used. Ask for a new one.');
  const updated: User = { ...user, passwordHash: await hashPassword(parsed.data.password) };
  await store.set(K.user(user.id), updated);
  await revokeAllSessions(store, user.id);
  return updated;
}
