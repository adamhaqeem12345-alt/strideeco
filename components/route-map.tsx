'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Minus, LocateFixed, MapPin, Layers, ArrowUpRight, Sun, Snowflake, Droplets } from 'lucide-react';
import { mapData, project, unproject, walkways, type Coordinate, type RouteOption, type XY } from '../lib/geo';
import { machineTypes, type Machine, type MachineType } from '../lib/machines';
import styles from './route-map.module.css';

const path = (coords: Coordinate[]) => coords.map(p => project(p).join(',')).join(' ');
const xyPath = (coords: XY[]) => coords.map(p => p.join(',')).join(' ');
const NO_MACHINES: Machine[] = [];
const machineColors: Record<MachineType, string> = { 'bottled-ambient': '#81ff7d', 'bottled-chilled': '#42c3fe', refill: '#fe7f82' };
const machineIcons = { 'bottled-ambient': Sun, 'bottled-chilled': Snowflake, refill: Droplets };
const machineLabels: Record<MachineType, string> = { 'bottled-ambient': 'Ambient', 'bottled-chilled': 'Chilled', refill: 'Refill' };

type Props = {
  routes?: RouteOption[]; route?: RouteOption; shadows?: XY[][]; picking?: string | null;
  onPick?: (point: Coordinate) => void; live?: Coordinate[]; compact?: boolean;
  machines?: readonly Machine[]; selectedMachineId?: string | null;
  onSelectMachine?: (machine: Machine) => void; machineOverview?: boolean;
  referencePoint?: Coordinate; tourTarget?: string;
};
export default function RouteMap({ routes = [], route, shadows = [], picking, onPick, live = [], compact,
  machines = NO_MACHINES, selectedMachineId, onSelectMachine, machineOverview = false, referencePoint, tourTarget }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1), [pan, setPan] = useState<XY>([0, 0]), [context, setContext] = useState(true);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 800 / 1.2 });
  const machinePins = useMemo(() => machines.filter(machine => machine.enabled), [machines]);
  const machineKey = machinePins.map(machine => machine.id).join('|');
  const drag = useRef<{ x: number; y: number; pan: XY; moved: boolean } | null>(null);
  const bounds = useMemo(() => {
    const [west, south, east, north] = mapData.meta.bbox;
    const coverage: Coordinate[] = [[west, south], [east, north]];
    // OSM ways can extend well beyond their requested extract. Fit the declared
    // coverage, not those outlying nodes, so the mock stops stay usable together.
    const coords = machineOverview
      ? [...coverage, ...machinePins.map(machine => machine.coordinate)]
      : route?.coordinates.length ? route.coordinates : walkways.flatMap(feature => feature.coordinates);
    const p = coords.map(project), xs = p.map(c => c[0]), ys = p.map(c => c[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const size = Math.max(maxX - minX, (maxY - minY) * 1.2, 400) * (machineOverview ? 1.18 : 1.35);
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, width: size, height: size / 1.2 };
  }, [route?.coordinates, machineOverview, machinePins]);
  useEffect(() => { setPan([0, 0]); setZoom(1); }, [route?.id, machineOverview, machineKey]);
  useEffect(() => {
    if (!svg.current) return;
    const measure = () => {
      const rect = svg.current?.getBoundingClientRect();
      if (rect?.width && rect.height) setViewportSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg.current);
    return () => observer.disconnect();
  }, []);
  const viewWidth = bounds.width / zoom, viewHeight = bounds.height / zoom;
  const viewBox = `${bounds.cx - viewWidth / 2 + pan[0]} ${bounds.cy - viewHeight / 2 + pan[1]} ${viewWidth} ${viewHeight}`;
  const scale = viewWidth / 800;
  // Pins retain a 44px hit target on phone and desktop, at every zoom level.
  const markerScale = Math.max(viewWidth / viewportSize.width, viewHeight / viewportSize.height);
  const labels = useMemo(() => mapData.features.filter(f => f.tags.leisure === 'park' && f.tags.name).map(f => ({ name: f.tags.name.replace('Elmina Valley Central Park', 'CENTRAL PARK').replace('Elmina Urban Park', 'URBAN PARK'), xy: project(f.coordinates[Math.floor(f.coordinates.length / 2)]) })), []);
  const position = (event: React.PointerEvent<SVGSVGElement>): XY => {
    const rect = svg.current!.getBoundingClientRect();
    const matrix = svg.current!.getScreenCTM();
    if (matrix) { const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()); return [p.x, p.y]; }
    return [bounds.cx + (event.clientX - rect.left - rect.width / 2) / rect.width * viewWidth, bounds.cy + (event.clientY - rect.top - rect.height / 2) / rect.height * viewHeight];
  };
  return <div className={`route-map ${compact ? 'compact-map' : ''} ${picking ? 'is-picking' : ''} ${machinePins.length ? styles.withMachineKey : ''}`} data-tour={tourTarget}>
    <div className={styles.viewport}>
    <svg ref={svg} className="map-canvas" viewBox={viewBox} role={machinePins.length ? 'group' : 'img'} aria-label={`Interactive map of OpenStreetMap walking paths around Elmina Central Park and Urban Park${machinePins.length ? ' with illustrative mock water machine locations' : ''}`} onPointerDown={e => {
      if (e.pointerType === 'mouse' && !picking) { drag.current = { x: e.clientX, y: e.clientY, pan, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }
    }} onPointerMove={e => { if (!drag.current) return; const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y; if (Math.hypot(dx, dy) > 3) drag.current.moved = true; const rect = e.currentTarget.getBoundingClientRect(); setPan([drag.current.pan[0] - dx / rect.width * viewWidth, drag.current.pan[1] - dy / rect.height * viewHeight]); }} onPointerUp={e => { if (picking && onPick) onPick(unproject(position(e))); drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <defs><pattern id="park-grain" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="0.7" fill="#b5dccc"/><circle cx="19" cy="20" r="0.7" fill="#b5dccc"/></pattern><pattern id="shadow-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="7" height="7" fill="#087c80" fillOpacity=".13"/><path d="M0 0V7" stroke="#087c80" strokeOpacity=".3" strokeWidth="1"/></pattern></defs>
      <rect x="-20000" y="-20000" width="40000" height="40000" fill="#e7fbf5"/>
      {context && mapData.features.filter(f => f.tags.leisure === 'park' || f.tags.landuse).map(f => <polygon key={`park-${f.id}`} points={path(f.coordinates)} fill={f.tags.leisure === 'park' ? '#d8f6ca' : '#f5fffd'} stroke="#bedfce" strokeWidth="1"/>)}
      {context && mapData.features.filter(f => f.tags.leisure === 'park').map(f => <polygon key={`grain-${f.id}`} points={path(f.coordinates)} fill="url(#park-grain)"/>)}
      {mapData.features.filter(f => f.tags.natural === 'water').map(f => <polygon key={`water-${f.id}`} points={path(f.coordinates)} fill="#a6e8ff" stroke="#68c8e9" strokeWidth="2"/>)}
      {mapData.features.filter(f => f.tags.waterway).map(f => <polyline key={`river-${f.id}`} points={path(f.coordinates)} stroke="#9cdef6" strokeWidth="9" fill="none"/>)}
      {context && mapData.features.filter(f => f.tags.highway && !['footway', 'path', 'steps'].includes(f.tags.highway)).map(f => <g key={`road-${f.id}`}><polyline points={path(f.coordinates)} fill="none" stroke="#d1e4df" strokeWidth={f.tags.highway.includes('motorway') ? 20 : f.tags.highway.includes('secondary') ? 14 : 9} strokeLinejoin="round"/><polyline points={path(f.coordinates)} fill="none" stroke="#ffffff" strokeWidth={f.tags.highway.includes('motorway') ? 15 : f.tags.highway.includes('secondary') ? 10 : 6} strokeLinejoin="round"/></g>)}
      {context && mapData.features.filter(f => f.tags.building).map(f => <polygon key={`building-${f.id}`} points={path(f.coordinates)} fill="#d1e2e0" stroke="#ffffff" strokeWidth="1"/>)}
      {shadows.map((p, i) => <polygon key={`shadow-${i}`} points={xyPath(p)} fill="url(#shadow-hatch)"/>)}
      {walkways.map(f => <polyline key={`walk-${f.id}`} points={path(f.coordinates)} fill="none" stroke="#8aaca3" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round"/>)}
      {labels.map(l => <text key={l.name} x={l.xy[0]} y={l.xy[1]} textAnchor="middle" fontSize={14 * scale} fontFamily="Arial, sans-serif" fontWeight="600" letterSpacing={2 * scale} fill="#456a70">{l.name}</text>)}
      {routes.filter(r => r.id !== route?.id).map(r => <polyline key={r.id} points={path(r.coordinates)} fill="none" stroke="#278c98" strokeWidth={4 * scale} strokeDasharray={`${7 * scale} ${5 * scale}`} opacity=".65" strokeLinejoin="round"/>)}
      {route && <><polyline points={path(route.coordinates)} fill="none" stroke="#ffffff" strokeWidth={11 * scale} strokeLinejoin="round" strokeLinecap="round"/><polyline points={path(route.coordinates)} fill="none" stroke="#055a61" strokeWidth={6 * scale} strokeLinejoin="round" strokeLinecap="round"/>
        <g transform={`translate(${project(route.coordinates[0]).join(',')})`}><circle r={13 * scale} fill="#fff"/><circle r={9 * scale} fill="#055a61"/><circle r={3 * scale} fill="#fff"/></g>
        {route.kind === 'Point to point' && <g transform={`translate(${project(route.coordinates.at(-1)!).join(',')})`}><circle r={11 * scale} fill="#fff"/><circle r={7 * scale} fill="#1476a0"/></g>}
      </>}
      {live.length > 0 && <><polyline points={path(live)} fill="none" stroke="#1476a0" strokeWidth={5 * scale} strokeLinejoin="round"/>{(() => { const p = project(live.at(-1)!); return <g transform={`translate(${p.join(',')})`}><circle r={15 * scale} fill="#42c3fe" opacity=".16"/><circle r={7 * scale} fill="#1476a0" stroke="white" strokeWidth={3 * scale}/></g>; })()}</>}
      {referencePoint && <g transform={`translate(${project(referencePoint).join(',')}) scale(${markerScale})`} role="img" aria-label="Selected reference point" pointerEvents="none">
        <title>Selected reference point, not an automatic live location</title>
        <circle r="12" fill="#1476a0" fillOpacity=".18"/><circle r="5" fill="#1476a0" stroke="white" strokeWidth="2"/>
        <text x="15" y="4" fontSize="10" fontFamily="Arial, sans-serif" fill="#0c343c" paintOrder="stroke" stroke="white" strokeWidth="3">Reference</text>
      </g>}
      {machinePins.map(machine => {
        const selected = machine.id === selectedMachineId;
        const label = machineTypes.find(type => type.id === machine.type)!.label;
        const Icon = machineIcons[machine.type];
        return <g key={machine.id} className="machine-map-pin" data-machine-id={machine.id} data-machine-type={machine.type} data-selected={selected}
          transform={`translate(${project(machine.coordinate).join(',')}) scale(${markerScale})`}
          role={onSelectMachine ? 'button' : 'img'} tabIndex={onSelectMachine ? 0 : undefined}
          aria-label={`${onSelectMachine ? 'Select ' : ''}${machine.name}: ${label}. Mock location.`} aria-pressed={onSelectMachine ? selected : undefined}
          onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); onSelectMachine?.(machine); }}
          onKeyDown={event => { if (onSelectMachine && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); onSelectMachine(machine); } }}>
          <title>{`${machine.name} · ${machine.rewardLabel} · Mock location`}</title>
          <circle className="machine-pin-halo" r="22" fill="transparent" stroke={selected ? '#087c80' : 'transparent'} strokeWidth="2" strokeDasharray={selected ? '3 3' : undefined}/>
          <circle r="16" fill="white" stroke="#0c343c" strokeWidth={selected ? 3 : 2}/>
          <circle r="12" fill={machineColors[machine.type]}/>
          <Icon x="-10" y="-10" width="20" height="20" color="#0c343c" strokeWidth="2" aria-hidden="true" focusable="false" pointerEvents="none"/>
        </g>;
      })}
    </svg>
    <div className="map-area-label"><MapPin size={14}/><span>City of Elmina</span><span className="map-label-dot"/>Public map data</div>
    {machinePins.length > 0 && <div className="map-machine-note" role="note"><strong>{machinePins.length} mock water stops</strong><span>Illustrative locations</span></div>}
    {picking && <div className="map-pick-hint"><MapPin size={16}/>Tap a mapped path to choose your {picking}</div>}
    <div className="map-controls"><button aria-label="Zoom in" onClick={() => setZoom(z => Math.min(4, z * 1.35))}><Plus size={18}/></button><button aria-label="Zoom out" onClick={() => setZoom(z => Math.max(.5, z / 1.35))}><Minus size={18}/></button><span/><button aria-label={machineOverview ? 'Fit mock water stops on map' : 'Fit route on map'} onClick={() => { setZoom(1); setPan([0, 0]); }}><LocateFixed size={18}/></button></div>
    <button className={`map-layers ${!context ? 'selected' : ''}`} aria-label="Toggle neighbourhood context" aria-pressed={!context} onClick={() => setContext(v => !v)}><Layers size={17}/><span>Layers</span></button>
    <div className="map-north"><ArrowUpRight size={18}/><span>N</span></div>
    <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    </div>
    {machinePins.length > 0 && <div className={styles.machineKey} role="group" aria-label="Map key for mock water machine types">
      <strong>Mock water types</strong>
      <ul>{machineTypes.map(type => {
        const Icon = machineIcons[type.id];
        return <li key={type.id} title={type.label}><span className={styles.keyIcon} style={{ backgroundColor: machineColors[type.id] }}><Icon size={15} strokeWidth={2} aria-hidden="true"/></span><span>{machineLabels[type.id]}</span></li>;
      })}</ul>
    </div>}
  </div>;
}
