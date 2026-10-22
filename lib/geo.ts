import source from './elmina-map.json';

export type Coordinate = [number, number]; // longitude, latitude
export type XY = [number, number];
export type MapFeature = { id: string; tags: Record<string, string>; nodes: string[]; coordinates: Coordinate[] };
export type RouteOption = { id: string; name: string; nodeIds: string[]; coordinates: Coordinate[]; distance: number; kind: 'Loop' | 'Out & back' | 'Point to point'; shade: number | null; duration: number };
export type PlanSettings = { distance: number; date: string; time: string; origin: Coordinate; scenario: boolean; height: number; preference: 'balanced' | 'shortest' | 'shade'; mode?: 'loop' | 'destination'; destination?: Coordinate };
export const mapData = source as unknown as { meta: typeof source.meta; features: MapFeature[] };
export const mapMeta = mapData.meta;
export const CENTRE: Coordinate = [101.513, 3.1795];
const LAT_METRES = 111320;
const LON_METRES = LAT_METRES * Math.cos(CENTRE[1] * Math.PI / 180);
export const project = ([lon, lat]: Coordinate): XY => [(lon - CENTRE[0]) * LON_METRES, -(lat - CENTRE[1]) * LAT_METRES];
export const unproject = ([x, y]: XY): Coordinate => [x / LON_METRES + CENTRE[0], -y / LAT_METRES + CENTRE[1]];
export function metres(a: Coordinate, b: Coordinate) { const [ax, ay] = project(a); const [bx, by] = project(b); return Math.hypot(bx - ax, by - ay); }
export function length(coords: Coordinate[]) { return coords.slice(1).reduce((s, p, i) => s + metres(coords[i], p), 0); }
export function km(m: number) { return (m / 1000).toFixed(2); }

const walkTypes = new Set(['footway', 'path', 'steps', 'pedestrian', 'cycleway']);
export const walkways = mapData.features.filter(f => walkTypes.has(f.tags.highway) && !['no', 'private'].includes(f.tags.access) && f.tags.foot !== 'no');
export const buildings = mapData.features.filter(f => f.tags.building);
export const graphNodes = new Map<string, Coordinate>();
export const graph = new Map<string, Map<string, number>>();
for (const way of walkways) {
  way.nodes.forEach((id, i) => { if (way.coordinates[i]) { graphNodes.set(id, way.coordinates[i]); if (!graph.has(id)) graph.set(id, new Map()); } });
  for (let i = 1; i < way.nodes.length; i++) {
    const a = way.nodes[i - 1], b = way.nodes[i];
    if (!graphNodes.has(a) || !graphNodes.has(b)) continue;
    const distance = metres(graphNodes.get(a)!, graphNodes.get(b)!);
    graph.get(a)!.set(b, distance); graph.get(b)!.set(a, distance);
  }
}

export const places = mapData.features.filter(f => f.tags.leisure === 'park' && f.tags.name).map(f => {
  const p = f.coordinates.slice(0, -1);
  const centre: Coordinate = [p.reduce((s, x) => s + x[0], 0) / p.length, p.reduce((s, x) => s + x[1], 0) / p.length];
  return { id: f.id, name: f.tags.name, coordinate: graphNodes.get(nearestNode(centre))! };
});

export function nearestNode(point: Coordinate) {
  let id = '', minimum = Infinity;
  for (const [candidate, coordinate] of graphNodes) { const d = metres(point, coordinate); if (d < minimum) { id = candidate; minimum = d; } }
  return id;
}
export function coordinatesFor(ids: string[]) { return ids.map(id => graphNodes.get(id)!).filter(Boolean); }
export function validWalk(ids: string[]) { return ids.length > 1 && ids.length < 10000 && ids.every(id => graphNodes.has(id)) && ids.slice(1).every((id, i) => graph.get(ids[i])?.has(id)); }

// Approximate solar position from the standard Julian-date orbital equations.
// Azimuth is clockwise from north. All departure times are interpreted in MYT.
export function sunPosition(date: string, time: string) {
  const ms = Date.parse(`${date}T${time}:00+08:00`), rad = Math.PI / 180;
  if (!Number.isFinite(ms)) return { altitude: NaN, azimuth: NaN };
  const d = ms / 86400000 - 10957.5;
  const M = rad * (357.5291 + 0.98560028 * d);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI, e = rad * 23.4397;
  const dec = Math.asin(Math.sin(L) * Math.sin(e));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  const H = rad * (280.16 + 360.9856235 * d + CENTRE[0]) - ra, phi = CENTRE[1] * rad;
  return { altitude: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)), azimuth: Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI };
}
function hull(points: XY[]): XY[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: XY[] = [], upper: XY[] = [];
  for (const point of p) { while (lower.length > 1 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop(); lower.push(point); }
  for (const point of p.reverse()) { while (upper.length > 1 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop(); upper.push(point); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
export function shadowPolygons(settings: PlanSettings): XY[][] {
  if (!settings.scenario) return [];
  const sun = sunPosition(settings.date, settings.time);
  if (!Number.isFinite(sun.altitude) || sun.altitude < 5 * Math.PI / 180) return [];
  const distance = Math.min(120, settings.height / Math.tan(sun.altitude));
  const dx = -Math.sin(sun.azimuth) * distance, dy = Math.cos(sun.azimuth) * distance;
  return buildings.map(b => { const p = b.coordinates.map(project); return hull([...p, ...p.map(([x, y]): XY => [x + dx, y + dy])]); });
}
export function inside(point: XY, polygon: XY[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) result = !result;
  }
  return result;
}
export function shadeFraction(coords: Coordinate[], polygons: XY[][]): number {
  if (!coords.length || !polygons.length) return 0;
  const prepared = polygons.map(poly => ({ poly, minX: Math.min(...poly.map(p => p[0])), maxX: Math.max(...poly.map(p => p[0])), minY: Math.min(...poly.map(p => p[1])), maxY: Math.max(...poly.map(p => p[1])) }));
  let total = 0, shaded = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = project(coords[i - 1]), b = project(coords[i]), distance = metres(coords[i - 1], coords[i]);
    const n = Math.max(1, Math.ceil(distance / 8));
    for (let step = 0; step < n; step++) {
      const t = (step + 0.5) / n, point: XY = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      total += distance / n;
      if (prepared.some(p => point[0] >= p.minX && point[0] <= p.maxX && point[1] >= p.minY && point[1] <= p.maxY && inside(point, p.poly))) shaded += distance / n;
    }
  }
  return total ? shaded / total : 0;
}

function shortest(start: string, goal: string, penalties = new Set<string>()): string[] {
  const dist = new Map<string, number>([[start, 0]]), prev = new Map<string, string>(), open = new Set([start]);
  while (open.size) {
    let u = '', score = Infinity;
    for (const n of open) if (dist.get(n)! < score) { u = n; score = dist.get(n)!; }
    open.delete(u);
    if (u === goal) { const path = [u]; while (prev.has(path[0])) path.unshift(prev.get(path[0])!); return path; }
    for (const [v, d] of graph.get(u) ?? []) {
      const key = [u, v].sort().join(':'), alt = score + d * (penalties.has(key) ? 5 : 1);
      if (alt < (dist.get(v) ?? Infinity)) { dist.set(v, alt); prev.set(v, u); open.add(v); }
    }
  }
  return [];
}
export function makeRoutes(settings: PlanSettings): RouteOption[] {
  const start = nearestNode(settings.origin), origin = graphNodes.get(start)!;
  const target = settings.distance * 1000, polygons = shadowPolygons(settings);
  if (settings.mode === 'destination' && settings.destination) {
    const end = nearestNode(settings.destination);
    const out = shortest(start, end);
    if (out.length < 2) return [];
    const penalties = new Set(out.slice(1).map((id, i) => [out[i], id].sort().join(':')));
    const alternate = shortest(start, end, penalties);
    const lists = out.join() === alternate.join() ? [out] : [out, alternate];
    return lists.map((ids, i) => { const coordinates = coordinatesFor(ids), distance = length(coordinates); return { id: ids.join('-').slice(0, 100) + ':' + Math.round(distance), name: i ? 'Another way there' : 'Your direct connection', nodeIds: ids, coordinates, distance, kind: 'Point to point', shade: settings.scenario && sunPosition(settings.date, settings.time).altitude >= 5 * Math.PI / 180 ? shadeFraction(coordinates, polygons) : null, duration: Math.ceil(distance / 75) }; });
  }
  const candidates: { ids: string[]; distance: number; kind: 'Loop' | 'Out & back' }[] = [];
  const ordered = [...graphNodes.entries()].filter(([id]) => id !== start).map(([id, p]) => ({ id, p, d: metres(origin, p) })).filter(p => p.d > 100).sort((a, b) => Math.abs(a.d - target / 3) - Math.abs(b.d - target / 3));
  const sample = ordered.filter((_, i) => i % Math.max(1, Math.floor(ordered.length / 28)) === 0).slice(0, 28);
  for (const point of sample) {
    const out = shortest(start, point.id);
    if (!out.length) continue;
    const edges = new Set(out.slice(1).map((id, i) => [out[i], id].sort().join(':')));
    const back = shortest(point.id, start, edges);
    if (!back.length) continue;
    const ids = [...out, ...back.slice(1)], d = length(coordinatesFor(ids));
    const repeated = back.slice(1).filter((id, i) => edges.has([back[i], id].sort().join(':'))).length / Math.max(1, back.length - 1);
    if (d > 180 && d < target * 2.2) candidates.push({ ids, distance: d, kind: repeated > 0.7 ? 'Out & back' : 'Loop' });
  }
  if (!candidates.length && ordered.length) {
    const out = shortest(start, ordered[0].id);
    if (out.length) { const ids = [...out, ...out.slice(0, -1).reverse()]; candidates.push({ ids, distance: length(coordinatesFor(ids)), kind: 'Out & back' }); }
  }
  const unique = new Map<string, RouteOption>();
  for (const candidate of candidates.sort((a, b) => Math.abs(a.distance - target) - Math.abs(b.distance - target))) {
    const key = [...new Set(candidate.ids)].sort().join(',');
    if (unique.has(key)) continue;
    const coordinates = coordinatesFor(candidate.ids), shade = settings.scenario && sunPosition(settings.date, settings.time).altitude >= 5 * Math.PI / 180 ? shadeFraction(coordinates, polygons) : null;
    unique.set(key, { id: candidate.ids.join('-').slice(0, 100) + ':' + Math.round(candidate.distance), name: '', nodeIds: candidate.ids, coordinates, distance: candidate.distance, kind: candidate.kind, shade, duration: Math.ceil(candidate.distance / 75) });
    if (unique.size >= 10) break;
  }
  const list = [...unique.values()];
  if (settings.preference === 'shade' && settings.scenario) list.sort((a, b) => (b.shade ?? 0) - (a.shade ?? 0));
  else if (settings.preference === 'shortest') list.sort((a, b) => a.distance - b.distance);
  return list.slice(0, 3).map((r, i) => ({ ...r, name: ['Your daily escape', 'Another way to wander', 'The scenic alternative'][i] }));
}
