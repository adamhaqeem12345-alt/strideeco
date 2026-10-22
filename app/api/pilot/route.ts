import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { coordinatesFor, length, metres, validWalk } from '../../../lib/geo';
import { RULES, type RecordedPosition } from '../../../lib/pilot';

function db() { if (!env.DB) throw new Error('Database is unavailable. Apply the local migration before using account features.'); return env.DB; }
const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
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
    db().prepare('SELECT id, cost, token, status, expires_at, created_at FROM redemptions WHERE user_id=? ORDER BY created_at DESC LIMIT 30').bind(id),
    db().prepare('SELECT id, delta, kind, created_at FROM point_events WHERE user_id=? ORDER BY created_at DESC LIMIT 30').bind(id),
    db().prepare('SELECT consent FROM profiles WHERE user_id=?').bind(id),
  ]);
  return { wallet: result[0].results[0], routes: result[1].results, activities: result[2].results, redemptions: result[3].results, events: result[4].results, consent: Boolean((result[5].results[0] as { consent?: number } | undefined)?.consent), rules: RULES };
}
export async function GET(request: Request) {
  try {
    const shared = new URL(request.url).searchParams.get('shared');
    if (shared) {
      const route = await db().prepare('SELECT id, name, node_ids, settings, distance FROM saved_routes WHERE id=? AND shared=1').bind(shared).first();
      return route ? response({ route }) : response({ error: 'This shared route is unavailable.' }, 404);
    }
    const user = await getChatGPTUser();
    if (!user) return response({ error: 'Sign in to save routes and access your wallet.' }, 401);
    await initialise(user.userId);
    return response(await state(user.userId));
  } catch (error) { console.error('Pilot GET', error); return response({ error: 'Account data could not be loaded. Please try again.' }, 503); }
}
export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return response({ error: 'Sign in to continue.' }, 401);
    // Browser writes must originate from this application, not a third-party page.
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return response({ error: 'Invalid request origin.' }, 403);
    const id = user.userId, now = new Date().toISOString();
    await initialise(id);
    const body = await request.json() as Record<string, unknown>;
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
      const existing = await db().prepare('SELECT id FROM redemptions WHERE id=? AND user_id=?').bind(redemptionId, id).first();
      if (!existing) {
        await db().prepare("INSERT INTO redemptions(id,user_id,cost,token,status,expires_at,created_at) VALUES(?,?,?,?,'pending',?,?)").bind(redemptionId, id, RULES.waterPoints, crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase(), new Date(Date.now() + RULES.reservationMinutes * 60000).toISOString(), now).run();
      }
      extra = { redemptionId };
    } else if (body.action === 'resolve-water') {
      const result = body.result === 'dispensed' ? 'confirmed' : 'failed';
      const redemption = await db().prepare('SELECT id,status,token FROM redemptions WHERE id=? AND user_id=?').bind(String(body.id), id).first();
      if (!redemption || redemption.token !== body.token) return response({ error: 'Redemption code not found.' }, 404);
      await db().prepare("UPDATE redemptions SET status=? WHERE id=? AND user_id=? AND status='pending' AND expires_at>?").bind(result, String(body.id), id, now).run();
    } else return response({ error: 'Unknown action.' }, 400);
    return response({ ...(await state(id)), ...extra });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('INSUFFICIENT_POINTS')) return response({ error: 'You need more available points for this water reward.' }, 409);
    if (message.includes('MONTHLY_LIMIT')) return response({ error: 'The illustrative limit is four water rewards per month.' }, 409);
    console.error('Pilot POST', error);
    return response({ error: 'That action could not be confirmed. Refresh your wallet before trying again.' }, 500);
  }
}
