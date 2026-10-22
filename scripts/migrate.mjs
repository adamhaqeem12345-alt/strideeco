import nextEnv from '@next/env';
import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error('Set TURSO_DATABASE_URL before running migrations.');
if (process.env.VERCEL && url.startsWith('file:')) throw new Error('Use a remote libSQL database on Vercel.');
if (url.startsWith('file:')) await mkdir(path.dirname(url.slice(5)), { recursive: true });
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  await client.execute('CREATE TABLE IF NOT EXISTS strideeco_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)');
  for (const name of ['0000_condemned_firestar.sql', '0001_wallet_accounting.sql']) {
    const sql = await readFile(new URL(`../drizzle/${name}`, import.meta.url), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const tx = await client.transaction('write');
    try {
      const previous = (await tx.execute({ sql: 'SELECT checksum FROM strideeco_migrations WHERE name=?', args: [name] })).rows[0];
      if (previous) {
        if (previous.checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
        console.log(`Already applied: ${name}`);
      } else {
        await tx.executeMultiple(sql);
        await tx.execute({ sql: 'INSERT INTO strideeco_migrations VALUES(?,?,?)', args: [name, checksum, new Date().toISOString()] });
        console.log(`Applied: ${name}`);
      }
      await tx.commit();
    } catch (error) { await tx.rollback(); throw error; }
    finally { tx.close(); }
  }
} finally { client.close(); }
