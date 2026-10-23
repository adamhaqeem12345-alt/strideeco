import type { Client } from '@libsql/client';

type ClerkIdentity = {
  id: string;
  externalAccounts: {
    provider: string;
    providerUserId: string;
    verification: { status: string | null } | null;
  }[];
};

export class AccountIdentityConflict extends Error {
  constructor() { super('Existing account ownership needs review. No records have been moved.'); }
}

/** Input must come from Clerk's server SDK, never a request body or user metadata. */
export async function resolveAccountIdentity(
  client: Pick<Client, 'execute'>,
  clerkUserId: string,
  loadIdentity: () => Promise<ClerkIdentity | null>,
) {
  const lookup = async () => (await client.execute({
    sql: 'SELECT app_user_id FROM auth_identities WHERE clerk_user_id=?', args: [clerkUserId],
  })).rows[0]?.app_user_id;

  const existing = await lookup();
  if (typeof existing === 'string') return existing;

  const user = await loadIdentity();
  if (!user || user.id !== clerkUserId) throw new Error('The signed-in identity could not be verified.');

  // A provider's immutable numeric ID is ownership evidence; email, username,
  // externalId and editable metadata are deliberately never used for matching.
  const candidates = [...new Set(user.externalAccounts.filter(account =>
    (account.provider === 'github' || account.provider === 'oauth_github') &&
    account.verification?.status === 'verified' && /^[1-9]\d*$/.test(account.providerUserId)
  ).map(account => `github:${account.providerUserId}`))];
  const legacy: string[] = [];
  for (const id of candidates) {
    const found = await client.execute({ sql: 'SELECT user_id FROM profiles WHERE user_id=?', args: [id] });
    if (found.rows.length) legacy.push(id);
  }
  if (legacy.length > 1) throw new AccountIdentityConflict();
  const appUserId = legacy[0] ?? `clerk:${clerkUserId}`;

  // Both columns are unique. A racing repeat is harmless, but another Clerk
  // account cannot claim the same legacy wallet. Existing records stay in place.
  try {
    await client.execute({
      sql: 'INSERT INTO auth_identities(clerk_user_id,app_user_id,created_at) VALUES(?,?,?) ON CONFLICT(clerk_user_id) DO NOTHING',
      args: [clerkUserId, appUserId, new Date().toISOString()],
    });
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed: auth_identities.app_user_id')) throw new AccountIdentityConflict();
    throw error;
  }
  const resolved = await lookup();
  if (typeof resolved !== 'string') throw new Error('Account identity could not be saved.');
  return resolved;
}
