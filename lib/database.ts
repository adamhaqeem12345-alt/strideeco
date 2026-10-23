import { createClient, type Client, type InValue } from '@libsql/client';

type Row = Record<string, unknown>;
let client: Client | undefined;

export class DatabaseConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = 'DatabaseConfigurationError'; }
}

export function databaseClient() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new DatabaseConfigurationError('Set TURSO_DATABASE_URL and apply npm run db:migrate before using account features.');
  if (process.env.VERCEL && url.startsWith('file:')) throw new DatabaseConfigurationError('Vercel requires a remote libSQL database, not a local file.');
  client ??= createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}

class Statement {
  constructor(readonly sql: string, readonly args: InValue[] = []) {}
  bind(...args: InValue[]) { return new Statement(this.sql, args); }
  async run() { return databaseClient().execute({ sql: this.sql, args: this.args }); }
  async first() { return (await this.run()).rows[0] as Row | undefined ?? null; }
}

// Preserve the tested parameterised SQLite statements and accounting triggers.
export function db() {
  return {
    prepare(sql: string) { return new Statement(sql); },
    async batch(statements: Statement[]) {
      const results = await databaseClient().batch(statements.map(s => ({ sql: s.sql, args: s.args })), 'write');
      return results.map(r => ({ results: r.rows as unknown as Row[] }));
    },
  };
}
