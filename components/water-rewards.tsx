'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Droplets, FlaskConical, Info, Loader2, MapPin, Navigation, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import RouteMap from './route-map';
import WaterBottle from './water-bottle';
import { machines, machineTypes, nearestMachines, type MachineType } from '../lib/machines';
import { RULES, type PilotState } from '../lib/pilot';
import { type Coordinate } from '../lib/geo';

type Props = {
  state: PilotState; signedIn: boolean; busy: boolean; reference: Coordinate; referenceLabel: string;
  selectedMachineId: string; onSelectMachine: (id: string) => void; onReserve: () => void;
  onOpenVoucher: (id: string) => void; onRules: () => void; onRefresh: () => void;
};
const distanceLabel = (metres: number) => metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
export default function WaterRewards({ state, signedIn, busy, reference, referenceLabel, selectedMachineId, onSelectMachine, onReserve, onOpenVoucher, onRules, onRefresh }: Props) {
  const [type, setType] = useState<MachineType | 'all'>('all');
  const currentType = useRef(type); currentType.current = type;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [locating, setLocating] = useState(false);
  const origin = location ?? reference;
  const ranked = useMemo(() => nearestMachines(origin, type), [origin, type]);
  const selected = machines.find(m => m.id === selectedMachineId) ?? ranked[0]?.machine;
  const available = state.wallet.points - state.wallet.reserved;
  function locate() {
    if (!navigator.geolocation) { setLocationStatus('Location is unavailable. Distances use the route reference.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      if (!mounted.current) return;
      setLocating(false);
      if (position.coords.accuracy > 100) { setLocation(null); setLocationStatus('Location accuracy is too low. Distances use the route reference.'); return; }
      const coordinate: Coordinate = [position.coords.longitude, position.coords.latitude];
      setLocation(coordinate); setLocationStatus(`Location accuracy ±${Math.round(position.coords.accuracy)} m.`);
      const nearest = nearestMachines(coordinate, currentType.current)[0]; if (nearest) onSelectMachine(nearest.machine.id);
    }, () => { if (!mounted.current) return; setLocating(false); setLocation(null); setLocationStatus('Location was unavailable or declined. Distances use the route reference.'); }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 12000 });
  }
  function filter(next: MachineType | 'all') {
    setType(next); const first = nearestMachines(origin, next)[0]; if (first) onSelectMachine(first.machine.id);
  }
  return <div className="rewards-layout">
    <section className="reward-feature"><div className="reward-feature-copy"><span className="pill light"><Droplets size={14}/>YOUR EVERYDAY REWARD</span><h2>A fresh finish<br/>to your next walk.</h2><p>Drinking water, your way.<br/>Choose a mock machine nearby.</p><div className="reward-cost"><Coins size={22}/><strong>{RULES.waterPoints}</strong><span>prototype points</span></div></div><WaterBottle/><div className="reward-feature-bottom"><ShieldCheck size={15}/>Water-only pilot · vending integration is simulated</div></section>
    <section className="wallet-card card"><div className="section-topline"><h2>Your points wallet</h2><Wallet size={21}/></div><span className="wallet-number">{available}<small>available points</small></span><div className="wallet-progress"><span style={{ width: `${Math.min(100, available / RULES.waterPoints * 100)}%` }}/></div><p className="wallet-progress-label">{available >= RULES.waterPoints ? 'Your next water reward is ready to try.' : `${Math.max(0, RULES.waterPoints - available)} more points to your next water reward.`}</p>{state.wallet.reserved > 0 && <p className="reserved-note">{state.wallet.reserved} points reserved for pending vouchers.</p>}<div className="chosen-machine"><MapPin size={17}/><span><strong>{selected?.name}</strong><small>{selected?.rewardLabel} · mock machine</small></span></div><button className="button primary full" disabled={busy || !selected || (signedIn && available < RULES.waterPoints)} onClick={onReserve}>{busy ? <Loader2 size={17} className="spin"/> : <Droplets size={17}/>} {signedIn ? 'Redeem drinking water' : 'Sign in to collect points'}</button><button className="text-button centered" onClick={onRules}>How do points work? <Info size={14}/></button><div className="wallet-footnote"><FlaskConical size={15}/><span>Mock voucher: one code and one QR for the same single use. No live machine or operator is connected.</span></div></section>
    <section className="card machine-directory" aria-label="Mock township water machines"><div className="section-topline"><div><p className="eyebrow">EXPLORE THE TOWNSHIP</p><h2>Find your water stop</h2></div><span className="pill"><FlaskConical size={13}/>MOCK LOCATIONS</span></div><p className="machine-disclosure">Illustrative Elmina locations for this prototype. These are not confirmed installed machines or walking directions.</p><div className="machine-tools"><label>Water machine type<select aria-label="Water machine type" value={type} onChange={event => filter(event.target.value as MachineType | 'all')}><option value="all">All drinking-water types</option>{machineTypes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button className="button secondary" onClick={locate} disabled={locating}><Navigation size={16}/>{locating ? 'Finding location…' : 'Use my location'}</button>{location && <button className="text-button" onClick={() => { setLocation(null); setLocationStatus(''); const nearest = nearestMachines(reference, type)[0]; if (nearest) onSelectMachine(nearest.machine.id); }}>Use route reference</button>}</div><p className="machine-reference">Straight-line distances from {location ? 'your location' : referenceLabel}. {locationStatus}</p><div className="machine-explorer"><RouteMap machines={ranked.map(item => item.machine)} selectedMachineId={selected?.id} onSelectMachine={machine => onSelectMachine(machine.id)} machineOverview referencePoint={origin}/><div className="machine-list" aria-label="Machines by distance">{ranked.map(({ machine, distanceMetres }, index) => <button key={machine.id} aria-pressed={selected?.id === machine.id} className={`machine-card ${selected?.id === machine.id ? 'selected' : ''}`} onClick={() => onSelectMachine(machine.id)}><span className="machine-card-top"><strong>{machine.name}</strong>{index === 0 && <span className="status-pill">Nearest match</span>}</span><span>{machineTypes.find(item => item.id === machine.type)?.label}</span><small>{machine.rewardLabel} · {RULES.waterPoints} pts</small><span className="machine-card-distance"><MapPin size={13}/>{distanceLabel(distanceMetres)} straight line <span>Mock</span></span></button>)}</div></div></section>
    <section className="card redemption-history"><div className="section-topline"><h2>Your water rewards</h2><button className="icon-button" aria-label="Refresh wallet" onClick={onRefresh}><RefreshCw size={16}/></button></div>{!state.redemptions.length ? <div className="empty-state"><Droplets size={26}/><h3>Your first fresh finish awaits.</h3><p>Pending vouchers and completed redemptions appear here on phone and desktop.</p></div> : state.redemptions.map(voucher => <button className="redemption-row" key={voucher.id} onClick={() => onOpenVoucher(voucher.id)}><span className="history-icon blue"><Droplets size={19}/></span><span><strong>{voucher.reward_label ?? 'Drinking water'}</strong><small>{voucher.machine_name ?? 'Earlier mock voucher'} · {voucher.cost} points · simulated</small></span><span className={`status-pill ${voucher.status}`}>{voucher.status === 'pending' ? 'Open voucher' : voucher.status === 'confirmed' ? 'Used once' : voucher.status}</span></button>)}</section>
  </div>;
}
