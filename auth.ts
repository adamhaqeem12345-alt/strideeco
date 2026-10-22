import { auth, currentUser } from '@clerk/nextjs/server';
import { cache } from 'react';
import { authConfigured } from './lib/auth-config';
import { resolveAccountIdentity } from './lib/account-identity';
import { databaseClient } from './lib/database';

export { authConfigured } from './lib/auth-config';

// Request-scoped memoization only; never share identity between requests.
export const getUser = cache(async () => {
  if (!authConfigured()) return null;
  const { userId, isAuthenticated } = await auth();
  if (!isAuthenticated || !userId) return null;
  const appUserId = await resolveAccountIdentity(databaseClient(), userId, currentUser);
  return { userId: appUserId };
});
