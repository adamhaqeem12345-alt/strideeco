import { sign } from 'node:crypto';

export const testIssuer = 'https://strideeco-test.invalid';
export const testPublishableKey = 'pk_live_' + Buffer.from('strideeco-test.invalid$').toString('base64');
export const testSecretKey = 'sk_live_local_verification_only';

export function requireIsolatedVerification() {
  const target = new URL(process.env.STRIDEECO_TEST_URL || 'http://localhost:5187');
  if (!process.env.STRIDEECO_TEST_PRIVATE_KEY || !process.env.CLERK_JWT_KEY ||
      process.env.CLERK_SECRET_KEY !== testSecretKey ||
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== testPublishableKey ||
      !process.env.TURSO_DATABASE_URL?.startsWith('file:') ||
      target.origin !== 'http://localhost:5187') {
    throw new Error('Use the isolated local verification harness with synthetic Clerk keys.');
  }
}

// Only imported by verification scripts, never application code. These tokens
// work solely against the ephemeral public key supplied to the local server.
export function testSession(subject, overrides = {}) {
  requireIsolatedVerification();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'local-verification' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: testIssuer,
    sub: subject, sid: 'sess_local_' + subject, iat: now, nbf: now - 5, exp: now + 900,
    azp: process.env.STRIDEECO_TEST_URL || 'http://localhost:5187', v: 2, sts: 'active', ...overrides })).toString('base64url');
  const data = header + '.' + payload;
  return data + '.' + sign('RSA-SHA256', Buffer.from(data), process.env.STRIDEECO_TEST_PRIVATE_KEY).toString('base64url');
}
