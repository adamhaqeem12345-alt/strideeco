'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Minus, LocateFixed, MapPin, Layers, ArrowUpRight } from 'lucide-react';
import { mapData, project, unproject, walkways, type Coordinate, type RouteOption, type XY } from '../lib/geo';

const path = (coords: Coordinate[]) => coords.map(p => project(p).join(',')).join(' ');
const xyPath = (coords: XY[]) => coords.map(p => p.join(',')).join(' ');
type Props = { routes?: RouteOption[]; route?: RouteOption; shadows?: XY[][]; picking?: string | null; onPick?: (point: Coordinate) => void; live?: Coordinate[]; compact?: boolean };
export default function RouteMap({ routes = [], route, shadows = [], picking, onPick, live = [], compact }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1), [pan, setPan] = useState<XY>([0, 0]), [context, setContext] = useState(true);
  const drag = useRef<{ x: number; y: number; pan: XY; moved: boolean } | null>(null);
  const bounds = useMemo(() => {
    const coords = route?.coordinates.length ? route.coordinates : walkways.flatMap(f => f.coordinates);
    const p = coords.map(project), xs = p.map(c => c[0]), ys = p.map(c => c[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const size = Math.max(maxX - minX, (maxY - minY) * 1.2, 400) * 1.35;
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, width: size, height: size / 1.2 };
  }, [route?.id]);
  useEffect(() => { setPan([0, 0]); setZoom(1); }, [route?.id]);
  const viewWidth = bounds.width / zoom, viewHeight = bounds.height / zoom;
  const viewBox = `${bounds.cx - viewWidth / 2 + pan[0]} ${bounds.cy - viewHeight / 2 + pan[1]} ${viewWidth} ${viewHeight}`;
  const scale = viewWidth / 800;
  const labels = useMemo(() => mapData.features.filter(f => f.tags.leisure === 'park' && f.tags.name).map(f => ({ name: f.tags.name.replace('Elmina Valley Central Park', 'CENTRAL PARK').replace('Elmina Urban Park', 'URBAN PARK'), xy: project(f.coordinates[Math.floor(f.coordinates.length / 2)]) })), []);
  const position = (event: React.PointerEvent<SVGSVGElement>): XY => {
    const rect = svg.current!.getBoundingClientRect();
    const matrix = svg.current!.getScreenCTM();
    if (matrix) { const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()); return [p.x, p.y]; }
    return [bounds.cx + (event.clientX - rect.left - rect.width / 2) / rect.width * viewWidth, bounds.cy + (event.clientY - rect.top - rect.height / 2) / rect.height * viewHeight];
  };
  return <div className={`route-map ${compact ? 'compact-map' : ''} ${picking ? 'is-picking' : ''}`}>
    <svg ref={svg} className="map-canvas" viewBox={viewBox} role="img" aria-label="Interactive map of actual OpenStreetMap walking paths around Elmina Central Park and Urban Park" onPointerDown={e => {
      if (e.pointerType === 'mouse' && !picking) { drag.current = { x: e.clientX, y: e.clientY, pan, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }
    }} onPointerMove={e => { if (!drag.current) return; const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y; if (Math.hypot(dx, dy) > 3) drag.current.moved = true; const rect = e.currentTarget.getBoundingClientRect(); setPan([drag.current.pan[0] - dx / rect.width * viewWidth, drag.current.pan[1] - dy / rect.height * viewHeight]); }} onPointerUp={e => { if (picking && onPick) onPick(unproject(position(e))); drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <defs><pattern id="park-grain" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="0.7" fill="#c8d4bc"/><circle cx="19" cy="20" r="0.7" fill="#c8d4bc"/></pattern><pattern id="shadow-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="7" height="7" fill="#355c3a" fillOpacity=".13"/><path d="M0 0V7" stroke="#355c3a" strokeOpacity=".3" strokeWidth="1"/></pattern></defs>
      <rect x="-20000" y="-20000" width="40000" height="40000" fill="#f2f2e9"/>
      {context && mapData.features.filter(f => f.tags.leisure === 'park' || f.tags.landuse).map(f => <polygon key={`park-${f.id}`} points={path(f.coordinates)} fill={f.tags.leisure === 'park' ? '#e1ead5' : '#efeee4'} stroke="#d8dfcd" strokeWidth="1"/>)}
      {context && mapData.features.filter(f => f.tags.leisure === 'park').map(f => <polygon key={`grain-${f.id}`} points={path(f.coordinates)} fill="url(#park-grain)"/>)}
      {mapData.features.filter(f => f.tags.natural === 'water').map(f => <polygon key={`water-${f.id}`} points={path(f.coordinates)} fill="#b9d9dc" stroke="#a5cdd1" strokeWidth="2"/>)}
      {mapData.features.filter(f => f.tags.waterway).map(f => <polyline key={`river-${f.id}`} points={path(f.coordinates)} stroke="#b3d4d8" strokeWidth="9" fill="none"/>)}
      {context && mapData.features.filter(f => f.tags.highway && !['footway', 'path', 'steps'].includes(f.tags.highway)).map(f => <g key={`road-${f.id}`}><polyline points={path(f.coordinates)} fill="none" stroke="#ddded3" strokeWidth={f.tags.highway.includes('motorway') ? 20 : f.tags.highway.includes('secondary') ? 14 : 9} strokeLinejoin="round"/><polyline points={path(f.coordinates)} fill="none" stroke="#fffef8" strokeWidth={f.tags.highway.includes('motorway') ? 15 : f.tags.highway.includes('secondary') ? 10 : 6} strokeLinejoin="round"/></g>)}
      {context && mapData.features.filter(f => f.tags.building).map(f => <polygon key={`building-${f.id}`} points={path(f.coordinates)} fill="#deded1" stroke="#f7f7ef" strokeWidth="1"/>)}
      {shadows.map((p, i) => <polygon key={`shadow-${i}`} points={xyPath(p)} fill="url(#shadow-hatch)"/>)}
      {walkways.map(f => <polyline key={`walk-${f.id}`} points={path(f.coordinates)} fill="none" stroke="#b6bda7" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round"/>)}
      {labels.map(l => <text key={l.name} x={l.xy[0]} y={l.xy[1]} textAnchor="middle" fontSize={14 * scale} fontFamily="Arial, sans-serif" fontWeight="600" letterSpacing={2 * scale} fill="#698259">{l.name}</text>)}
      {routes.filter(r => r.id !== route?.id).map(r => <polyline key={r.id} points={path(r.coordinates)} fill="none" stroke="#89a9a0" strokeWidth={4 * scale} strokeDasharray={`${7 * scale} ${5 * scale}`} opacity=".65" strokeLinejoin="round"/>)}
      {route && <><polyline points={path(route.coordinates)} fill="none" stroke="#ffffff" strokeWidth={11 * scale} strokeLinejoin="round" strokeLinecap="round"/><polyline points={path(route.coordinates)} fill="none" stroke="#217455" strokeWidth={6 * scale} strokeLinejoin="round" strokeLinecap="round"/>
        <g transform={`translate(${project(route.coordinates[0]).join(',')})`}><circle r={13 * scale} fill="#fff"/><circle r={9 * scale} fill="#217455"/><circle r={3 * scale} fill="#fff"/></g>
        {route.kind === 'Point to point' && <g transform={`translate(${project(route.coordinates.at(-1)!).join(',')})`}><circle r={11 * scale} fill="#fff"/><circle r={7 * scale} fill="#365d86"/></g>}
      </>}
      {live.length > 0 && <><polyline points={path(live)} fill="none" stroke="#3583ba" strokeWidth={5 * scale} strokeLinejoin="round"/>{(() => { const p = project(live.at(-1)!); return <g transform={`translate(${p.join(',')})`}><circle r={15 * scale} fill="#3a96cc" opacity=".16"/><circle r={7 * scale} fill="#328dca" stroke="white" strokeWidth={3 * scale}/></g>; })()}</>}
    </svg>
    <div className="map-area-label"><MapPin size={14}/><span>City of Elmina</span><span className="map-label-dot"/>Public map data</div>
    {picking && <div className="map-pick-hint"><MapPin size={16}/>Tap a mapped path to choose your {picking}</div>}
    <div className="map-controls"><button aria-label="Zoom in" onClick={() => setZoom(z => Math.min(4, z * 1.35))}><Plus size={18}/></button><button aria-label="Zoom out" onClick={() => setZoom(z => Math.max(.5, z / 1.35))}><Minus size={18}/></button><span/><button aria-label="Fit route on map" onClick={() => { setZoom(1); setPan([0, 0]); }}><LocateFixed size={18}/></button></div>
    <button className={`map-layers ${!context ? 'selected' : ''}`} aria-label="Toggle neighbourhood context" aria-pressed={!context} onClick={() => setContext(v => !v)}><Layers size={17}/><span>Layers</span></button>
    <div className="map-north"><ArrowUpRight size={18}/><span>N</span></div>
    <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
  </div>;
}
