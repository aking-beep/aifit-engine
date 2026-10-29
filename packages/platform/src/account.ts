import type { KvStore } from './store/types.js';
import { PlatformError } from './errors.js';
import { K, createUser, getUser, publicUser, revokeAllSessions, type User } from './auth.js';
import { OK, contextFor, createOrg, listUserOrgs, removeMember, type Membership } from './orgs.js';
import { deleteAllOrgAssessments, listAssessments } from './assessments.js';
import { EK, readEntitlements } from './entitlements.js';
import { randomId } from './crypto.js';

/** Sign-up creates the account and a personal workspace the user owns. */
export async function signup(store: KvStore, input: { email: string; password: string; name: string; orgName?: string }): Promise<User> {
  const orgId = randomId('org');
  const user = await createUser(store, input, orgId);
  await createOrg(store, user.id, input.orgName?.trim() || `${user.name}'s workspace`, orgId);
  return user;
}

/** Everything stored about the user, for data portability (GDPR/CCPA-style access request). */
export async function exportAccount(store: KvStore, userId: string) {
  const user = await getUser(store, userId);
  if (!user) throw new PlatformError('not_found', 'Account not found.');
  const orgs = [];
  for (const org of await listUserOrgs(store, userId)) {
    const ctx = await contextFor(store, userId, org.id);
    orgs.push({ ...org, assessments: await listAssessments(store, ctx), entitlements: ctx.role === 'viewer' ? undefined : await readEntitlements(store, org.id) });
  }
  return { exportedAt: new Date().toISOString(), user: publicUser(user), workspaces: orgs };
}

async function deleteOrgData(store: KvStore, orgId: string) {
  await deleteAllOrgAssessments(store, orgId);
  for (const hash of await store.smembers(OK.invites(orgId))) await store.del(OK.invite(hash));
  for (const uid of await store.smembers(OK.members(orgId))) {
    await store.del(OK.member(orgId, uid));
    await store.srem(K.userOrgs(uid), orgId);
  }
  for (const key of [OK.invites(orgId), OK.members(orgId), OK.audit(orgId), EK.entitlements(orgId), `org:${orgId}:profile`, OK.org(orgId)]) await store.del(key);
}

/**
 * Deletes the account. Workspaces the user is the only member of are deleted
 * with all their data. A workspace with other members where this user is the
 * only owner blocks deletion until ownership is transferred, so a team never
 * loses its data because one person left. Billing records at Stripe are not
 * touched here; cancel the subscription first (the account page says so).
 */
export async function deleteAccount(store: KvStore, userId: string): Promise<{ deletedWorkspaces: string[]; leftWorkspaces: string[] }> {
  const user = await getUser(store, userId);
  if (!user) throw new PlatformError('not_found', 'Account not found.');
  const orgs = await listUserOrgs(store, userId);
  const plan: { orgId: string; action: 'delete' | 'leave' }[] = [];
  for (const org of orgs) {
    const members = await store.smembers(OK.members(org.id));
    if (members.length <= 1) {
      // Deleting a workspace with a live subscription would leave Stripe billing nobody.
      const ent = await readEntitlements(store, org.id);
      if (ent.subscription && ['active', 'trialing', 'past_due', 'unpaid'].includes(ent.subscription.status)) {
        throw new PlatformError('conflict', `"${org.name}" has an active team plan. Cancel it in Stripe first, then delete your account.`);
      }
      plan.push({ orgId: org.id, action: 'delete' });
      continue;
    }
    if (org.role === 'owner') {
      let otherOwner = false;
      for (const uid of members) {
        if (uid === userId) continue;
        const m = await store.get<Membership>(OK.member(org.id, uid));
        if (m?.role === 'owner') otherOwner = true;
      }
      if (!otherOwner) throw new PlatformError('conflict', `You are the only owner of "${org.name}", which has other members. Make someone else an owner first.`);
    }
    plan.push({ orgId: org.id, action: 'leave' });
  }
  for (const step of plan) {
    if (step.action === 'delete') await deleteOrgData(store, step.orgId);
    else await removeMember(store, await contextFor(store, userId, step.orgId), userId);
  }
  await revokeAllSessions(store, userId);
  await store.del(K.userOrgs(userId));
  await store.del(K.userByEmail(user.email));
  await store.del(K.user(userId));
  return {
    deletedWorkspaces: plan.filter((p) => p.action === 'delete').map((p) => p.orgId),
    leftWorkspaces: plan.filter((p) => p.action === 'leave').map((p) => p.orgId),
  };
}
