import { sign } from 'node:crypto';

// Only imported by verification scripts, never application code. These tokens
// work solely against the ephemeral public key supplied to the local server.
export function testSession(subject, overrides = {}) {
  if (!process.env.STRIDEECO_TEST_PRIVATE_KEY || !process.env.TURSO_DATABASE_URL?.startsWith('file:')) {
    throw new Error('Use the isolated local verification harness.');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'local-verification' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'https://strideeco-test.invalid',
    sub: subject, sid: 'sess_local_' + subject, iat: now, nbf: now - 5, exp: now + 900,
    azp: process.env.STRIDEECO_TEST_URL || 'http://127.0.0.1:5187', v: 2, sts: 'active', ...overrides })).toString('base64url');
  const data = header + '.' + payload;
  return data + '.' + sign('RSA-SHA256', Buffer.from(data), process.env.STRIDEECO_TEST_PRIVATE_KEY).toString('base64url');
}
