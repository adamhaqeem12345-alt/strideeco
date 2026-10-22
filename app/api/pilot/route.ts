import { randomBytes } from 'node:crypto';
import { db } from '../../../lib/database';
import { getUser } from '../../../auth';
import { coordinatesFor, length, metres, validWalk } from '../../../lib/geo';
import { RULES, type RecordedPosition } from '../../../lib/pilot';
import { getMachine } from '../../../lib/machines';
import { normalizeVoucherCode, parseVoucherPayload } from '../../../lib/vouchers';

export const runtime = 'nodejs';
const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
class VoucherError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
async function initialise(id: string) {
  const now = new Date().toISOString();
  await db().batch([
    db().prepare('INSERT OR IGNORE INTO profiles(user_id, created_at) VALUES (?, ?)').bind(id, now),
    db().prepare('INSERT OR IGNORE INTO wallets(user_id) VALUES (?)').bind(id),
    db().prepare("UPDATE redemptions SET status='expired' WHERE user_id=? AND status='pending' AND expires_at<=?").bind(id, now),
  ]);
}
async function state(id: string) {
  const result = await db().batch([
    db().prepare('SELECT points, reserved FROM wallets WHERE user_id=?').bind(id),
    db().prepare('SELECT * FROM saved_routes WHERE user_id=? ORDER BY created_at DESC LIMIT 30').bind(id),
    db().prepare('SELECT id, source, distance, duration, points, created_at FROM activities WHERE user_id=? ORDER BY created_at DESC LIMIT 30').bind(id),
    db().prepare('SELECT id, cost, token, status, expires_at, created_at, machine_id, machine_name, machine_type, reward_label, redeemed_at FROM redemptions WHERE user_id=? ORDER BY created_at DESC LIMIT 30').bind(id),
    db().prepare('SELECT id, delta, kind, created_at FROM point_events WHERE user_id=? ORDER BY created_at DESC LIMIT 30').bind(id),
    db().prepare('SELECT consent FROM profiles WHERE user_id=?').bind(id),
  ]);
  return { wallet: result[0].results[0], routes: result[1].results, activities: result[2].results, redemptions: result[3].results, events: result[4].results, consent: Boolean((result[5].results[0] as { consent?: number } | undefined)?.consent), rules: RULES };
}
async function requirePendingVoucher(voucher: Record<string, unknown>, userId: string, now: string) {
  if (voucher.status === 'expired' || (voucher.status === 'pending' && String(voucher.expires_at) <= now)) {
    // Expiry releases the existing reservation through the original trigger.
    await db().prepare("UPDATE redemptions SET status='expired' WHERE id=? AND user_id=? AND status='pending' AND expires_at<=?").bind(String(voucher.id), userId, now).run();
    throw new VoucherError('This water voucher has expired. Reserved points have been released.', 410);
  }
  if (voucher.status !== 'pending') throw new VoucherError('This water voucher has already been used or closed.', 409);
}
export async function GET(request: Request) {
  try {
    const shared = new URL(request.url).searchParams.get('shared');
    if (shared) {
      const route = await db().prepare('SELECT id, name, node_ids, settings, distance FROM saved_routes WHERE id=? AND shared=1').bind(shared).first();
      return route ? response({ route }) : response({ error: 'This shared route is unavailable.' }, 404);
    }
    const user = await getUser();
    if (!user) return response({ error: 'Sign in to save routes and access your wallet.' }, 401);
    await initialise(user.userId);
    return response(await state(user.userId));
  } catch (error) { console.error('Pilot GET', error); return response({ error: 'Account data could not be loaded. Please try again.' }, 503); }
}
export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return response({ error: 'Sign in to continue.' }, 401);
    // Browser writes must originate from this application, not a third-party page.
    const origin = request.headers.get('origin');
    // Next.js may construct request.url from its internal listening address.
    // Host represents the browser-facing destination; never use a caller's
    // x-forwarded-host as an additional allowed origin.
    const destination = new URL(request.url);
    const host = request.headers.get('host');
    if (host) destination.host = host;
    const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
    if (protocol === 'https' || protocol === 'http') destination.protocol = protocol + ':';
    if (origin && origin !== destination.origin) return response({ error: 'Invalid request origin.' }, 403);
    const id = user.userId, now = new Date().toISOString();
    await initialise(id);
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return response({ error: 'Invalid request body.' }, 400);
      body = parsed as Record<string, unknown>;
    } catch { return response({ error: 'Invalid request body.' }, 400); }
    let extra: Record<string, unknown> = {};
    if (body.action === 'save-route') {
      const ids = body.nodeIds as string[];
      if (!Array.isArray(ids) || !ids.every(n => typeof n === 'string') || !validWalk(ids)) return response({ error: 'Choose a connected route on the mapped walking network.' }, 400);
      const routeId = crypto.randomUUID();
      const name = String(body.name || 'My Elmina route').trim().slice(0, 70);
      const settings = JSON.stringify(body.settings ?? {});
      if (settings.length > 2000) return response({ error: 'Route settings are too large.' }, 400);
      await db().prepare('INSERT INTO saved_routes(id,user_id,name,node_ids,settings,distance,created_at) VALUES(?,?,?,?,?,?,?)').bind(routeId, id, name, JSON.stringify(ids), settings, Math.round(length(coordinatesFor(ids))), now).run();
      extra = { savedId: routeId };
    } else if (body.action === 'share-route') {
      const route = await db().prepare('UPDATE saved_routes SET shared=1 WHERE id=? AND user_id=? RETURNING id').bind(String(body.id), id).first();
      if (!route) return response({ error: 'Saved route not found.' }, 404);
      extra = { sharedId: route.id };
    } else if (body.action === 'delete-route') {
      await db().prepare('DELETE FROM saved_routes WHERE id=? AND user_id=?').bind(String(body.id), id).run();
    } else if (body.action === 'consent') {
      await db().prepare('UPDATE profiles SET consent=? WHERE user_id=?').bind(body.value === true ? 1 : 0, id).run();
    } else if (body.action === 'activity') {
      const key = String(body.key ?? '');
      if (!/^[\w-]{8,100}$/.test(key)) return response({ error: 'Invalid activity identifier.' }, 400);
      const existing = await db().prepare('SELECT id FROM activities WHERE user_id=? AND idempotency_key=?').bind(id, key).first();
      if (!existing) {
        let distance = 0, duration = 0;
        const source = body.source === 'demo' ? 'demo' : 'gps';
        if (source === 'demo') {
          const ids = body.nodeIds as string[];
          if (!Array.isArray(ids) || !validWalk(ids)) return response({ error: 'Invalid demonstration route.' }, 400);
          distance = length(coordinatesFor(ids)); duration = distance / 1.4;
        } else {
          const positions = body.positions as RecordedPosition[];
          if (!Array.isArray(positions) || positions.length < 2 || positions.length > 12000) return response({ error: 'There are not enough usable location samples.' }, 400);
          for (let i = 0; i < positions.length; i++) {
            const p = positions[i];
            if (![p.lon, p.lat, p.time, p.accuracy].every(Number.isFinite) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180 || p.accuracy < 0 || p.accuracy > 100 || p.time > Date.now() + 10000 || p.time < Date.now() - 86400000) return response({ error: 'Some location samples need checking.' }, 400);
            if (i) {
              const prev = positions[i - 1], seconds = (p.time - prev.time) / 1000;
              const d = metres([prev.lon, prev.lat], [p.lon, p.lat]);
              if (seconds <= 0) return response({ error: 'Location timestamps must be ordered.' }, 400);
              if ((p.segment ?? 0) !== (prev.segment ?? 0)) continue;
              if (d / seconds > 12 || seconds > 120) return response({ error: 'A location jump or recording gap needs review. This activity has not received points.' }, 400);
              distance += d; duration += seconds;
            }
          }
        }
        if (distance > 30000) return response({ error: 'This activity exceeds the prototype distance limit.' }, 400);
        const points = Math.floor(distance / RULES.metresPerPoint);
        await db().prepare('INSERT OR IGNORE INTO activities(id,user_id,source,distance,duration,points,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, source, Math.round(distance), Math.round(duration), points, key, now).run();
        extra = { earned: points };
      }
    } else if (body.action === 'reserve-water') {
      const redemptionId = String(body.key ?? '');
      if (!/^[\w-]{8,100}$/.test(redemptionId)) return response({ error: 'Invalid redemption identifier.' }, 400);
      const machine = typeof body.machineId === 'string' ? getMachine(body.machineId) : undefined;
      if (!machine?.enabled) return response({ error: 'Choose an available mock water machine.' }, 400);
      // One atomic statement checks the key before INSERT triggers run. A
      // duplicate retry therefore cannot fail a fresh balance/monthly check or
      // hold a write transaction across awaits while another request arrives.
      await db().prepare("INSERT INTO redemptions(id,user_id,cost,token,status,expires_at,created_at,machine_id,machine_name,machine_type,reward_label) SELECT ?,?,?,?,'pending',?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM redemptions WHERE id=?)")
        .bind(redemptionId, id, RULES.waterPoints, randomBytes(16).toString('hex').toUpperCase(), new Date(Date.now() + RULES.reservationMinutes * 60000).toISOString(), now, machine.id, machine.name, machine.type, machine.rewardLabel, redemptionId).run();
      const existing = await db().prepare('SELECT user_id,machine_id,machine_type FROM redemptions WHERE id=?').bind(redemptionId).first();
      if (!existing || existing.user_id !== id || existing.machine_id !== machine.id || existing.machine_type !== machine.type) throw new VoucherError('This request identifier is already assigned to another voucher.', 409);
      extra = { redemptionId };
    } else if (body.action === 'resolve-water' || body.action === 'consume-voucher') {
      if (body.result !== 'dispensed' && body.result !== 'failed') return response({ error: 'Choose a simulated dispensing success or failure.' }, 400);
      const machine = typeof body.machineId === 'string' ? getMachine(body.machineId) : undefined;
      if (!machine?.enabled) return response({ error: 'Choose an available mock water machine.' }, 400);
      const credential = body.action === 'consume-voucher' ? parseVoucherPayload(body.payload)
        : typeof body.id === 'string' && /^[\w-]{8,100}$/.test(body.id) ? { id: body.id, token: normalizeVoucherCode(body.token) } : null;
      if (!credential?.token) return response({ error: 'Enter a valid water voucher code or StrideEco QR payload.' }, 400);
      const voucher = await db().prepare('SELECT id,status,expires_at,machine_id,machine_type FROM redemptions WHERE id=? AND user_id=? AND token=?').bind(credential.id, id, credential.token).first();
      if (!voucher) return response({ error: 'Water voucher not found.' }, 404);
      if (voucher.machine_id !== machine.id) return response({ error: 'This voucher is not assigned to the selected mock machine.' }, 409);
      if (voucher.machine_type !== machine.type) return response({ error: 'The mock machine water type has changed. This voucher cannot be used here.', }, 409);
      const consumedAt = new Date().toISOString();
      await requirePendingVoucher(voucher, id, consumedAt);
      // Code and QR entry share this atomic consume. Exactly one concurrent
      // request can leave pending; the original triggers account for points.
      const consumed = await db().prepare("UPDATE redemptions SET status=?,redeemed_at=? WHERE id=? AND user_id=? AND token=? AND machine_id=? AND machine_type=? AND status='pending' AND expires_at>? RETURNING id")
        .bind(body.result === 'dispensed' ? 'confirmed' : 'failed', body.result === 'dispensed' ? consumedAt : null, credential.id, id, credential.token, machine.id, machine.type, consumedAt).first();
      if (!consumed) {
        const latest = await db().prepare('SELECT id,status,expires_at FROM redemptions WHERE id=? AND user_id=?').bind(credential.id, id).first();
        if (latest) await requirePendingVoucher(latest, id, new Date().toISOString());
        return response({ error: 'This water voucher has already been used or closed.' }, 409);
      }
      extra = { redemptionId: credential.id, simulated: true };
    } else return response({ error: 'Unknown action.' }, 400);
    return response({ ...(await state(id)), ...extra });
  } catch (error) {
    if (error instanceof VoucherError) return response({ error: error.message }, error.status);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('INSUFFICIENT_POINTS')) return response({ error: 'You need more available points for this water reward.' }, 409);
    if (message.includes('MONTHLY_LIMIT')) return response({ error: 'The illustrative limit is four water rewards per month.' }, 409);
    console.error('Pilot POST', error);
    return response({ error: 'That action could not be confirmed. Refresh your wallet before trying again.' }, 500);
  }
}
