'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Coins, Compass, Droplets, Footprints, Map, Route, ShieldCheck, X } from 'lucide-react';
import styles from './onboarding-tour.module.css';

export type OnboardingView = 'plan' | 'activity' | 'collect' | 'rewards';
type Props = { signedIn: boolean; ready: boolean; replayRequest: number; onNavigate: (view: OnboardingView) => void };
type Choice = 'skipped' | 'completed';
type Mode = 'closed' | 'offer' | 'tour';
type Box = { left: number; top: number; width: number; height: number };

export const ONBOARDING_STORAGE_KEY = 'strideeco:onboarding:v1';
// Browser effects/events only: a tab-local fallback when both storage APIs are blocked.
let memoryChoice: Choice | null = null;

const steps = [
  { view: 'plan', target: 'route-map', label: 'Plan', title: 'Find your next little escape.', icon: Map,
    body: 'Explore the mapped paths around Elmina. Compare your route options and use the map controls to take a closer look.',
    note: 'Public map paths are suggestions. Check current access and conditions before setting out.' },
  { view: 'plan', target: 'route-controls', label: 'Make it yours', title: 'Make the route fit your day.', icon: Route,
    body: 'Choose a starting point, a round trip or destination, and your preferred distance. Departure time and optional shade settings let you explore another side of the route.',
    note: 'The building-shadow option is an assumed-height scenario, not measured shade or a temperature forecast.' },
  { view: 'activity', target: 'activity-start', label: 'Act', title: 'Move at your own pace.', icon: Footprints,
    body: 'Choose Start with location when you want to record a walk. Keep the page visible while recording. Or try the clearly labelled demo to explore the idea.',
    note: 'This guide never requests location or starts an activity. You decide when to begin.' },
  { view: 'collect', target: 'collect-progress', label: 'Collect', title: 'Watch your points add up.', icon: Coins,
    body: 'Accepted eligible activity adds prototype points to your wallet. The progress card shows your available points and how far you are from a water reward. Sign in to keep your progress.',
    note: 'Demo activity is simulated and excluded from real participation evidence.' },
  { view: 'rewards', target: 'water-rewards', label: 'Exchange', title: 'Picture a fresh finish.', icon: Droplets,
    body: 'Choose a mock water stop and explore the reward. A voucher uses one code and one QR for the same single use. This walkthrough does not reserve points or create a voucher.',
    note: 'Water stops, rewards and dispensing are simulated. No live water operator is connected.' },
] as const;

function readChoice(): Choice | null {
  if (typeof window === 'undefined') return null;
  for (const storage of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const value = storage().getItem(ONBOARDING_STORAGE_KEY);
      if (value === 'skipped' || value === 'completed') { memoryChoice = value; return value; }
    } catch { /* Private browsing and restricted storage must not block the planner. */ }
  }
  return memoryChoice;
}

function rememberChoice(choice: Choice) {
  memoryChoice = choice;
  for (const storage of [() => window.localStorage, () => window.sessionStorage]) {
    try { storage().setItem(ONBOARDING_STORAGE_KEY, choice); return; } catch { /* Try the next fallback. */ }
  }
}

function clamp(value: number, minimum: number, maximum: number) { return Math.min(Math.max(minimum, maximum), Math.max(minimum, value)); }

function spotlightBox(target: Box | null, viewport: { width: number; height: number }, panel: { width: number; height: number }): Box | null {
  if (!target || !viewport.width || !viewport.height) return null;
  const gap = 12;
  const left = Math.max(gap, target.left - 7), right = Math.min(viewport.width - gap, target.left + target.width + 7);
  const top = clamp(target.top - 7, gap, viewport.height - gap - 64);
  const beside = left >= panel.width + 28 || viewport.width - right >= panel.width + 28;
  const above = top >= panel.height + 28;
  const roomBelow = viewport.height - top - panel.height - 32;
  const maximumHeight = Math.max(32, Math.min(viewport.height * .52, beside || above ? viewport.height * .52 : roomBelow));
  const height = Math.min(target.height + 14, maximumHeight, viewport.height - top - gap);
  return right > left && height > 0 ? { left, top, width: right - left, height } : null;
}

function coachmarkPosition(spot: Box | null, viewport: { width: number; height: number }, panel: { width: number; height: number }) {
  const gap = 16, width = Math.min(panel.width, viewport.width - gap * 2), height = Math.min(panel.height, viewport.height - gap * 2);
  if (!spot) return { left: Math.max(gap, (viewport.width - width) / 2), top: Math.max(gap, (viewport.height - height) / 2) };
  const candidates = [
    { left: spot.left, top: spot.top + spot.height + gap },
    { left: spot.left, top: spot.top - height - gap },
    { left: spot.left + spot.width + gap, top: spot.top },
    { left: spot.left - width - gap, top: spot.top },
    { left: gap, top: viewport.height - height - gap },
    { left: viewport.width - width - gap, top: gap },
  ].map(point => ({ left: clamp(point.left, gap, viewport.width - width - gap), top: clamp(point.top, gap, viewport.height - height - gap) }));
  const overlap = (point: { left: number; top: number }) => Math.max(0, Math.min(point.left + width, spot.left + spot.width) - Math.max(point.left, spot.left)) * Math.max(0, Math.min(point.top + height, spot.top + spot.height) - Math.max(point.top, spot.top));
  return candidates.reduce((best, point) => overlap(point) < overlap(best) ? point : best);
}

export default function OnboardingTour({ signedIn, ready, replayRequest, onNavigate }: Props) {
  const id = useId();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<Mode>('closed');
  const [stepIndex, setStepIndex] = useState(0);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [panelSize, setPanelSize] = useState({ width: 368, height: 370 });
  const [targetBox, setTargetBox] = useState<(Box & { target: string }) | null>(null);
  const [findingTarget, setFindingTarget] = useState(false);
  const layer = useRef<HTMLDivElement>(null), dialog = useRef<HTMLElement>(null);
  const navigate = useRef(onNavigate);
  const manual = useRef(false), consideredOffer = useRef(false), handledReplay = useRef(0);
  const open = ready && mode !== 'closed';
  const step = steps[stepIndex];

  const close = useCallback((choice: Choice) => {
    rememberChoice(choice);
    consideredOffer.current = true;
    manual.current = false;
    setMode('closed'); setTargetBox(null);
    navigate.current('plan');
  }, []);

  useEffect(() => { navigate.current = onNavigate; }, [onNavigate]);

  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const frame = requestAnimationFrame(() => { setHost(document.body); update(); });
    window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', update); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      if (replayRequest > 0 && replayRequest !== handledReplay.current) {
        handledReplay.current = replayRequest; manual.current = true; consideredOffer.current = true;
        setStepIndex(0); setMode('tour'); return;
      }
      if (signedIn) {
        consideredOffer.current = true;
        if (!manual.current) setMode('closed');
        return;
      }
      if (!consideredOffer.current) {
        consideredOffer.current = true;
        if (!readChoice()) setMode('offer');
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [signedIn, ready, replayRequest]);

  useEffect(() => {
    if (!open || !host || !dialog.current || !layer.current) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const body = document.body, overflow = body.style.overflow, padding = body.style.paddingRight;
    const scrollbar = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const inertElements = Array.from(body.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== layer.current).map(element => ({ element, wasInert: element.inert }));
    inertElements.forEach(({ element }) => { element.inert = true; });
    body.style.overflow = 'hidden';
    if (scrollbar) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbar}px`;
    const focusables = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])') ?? []).filter(element => element.getClientRects().length > 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close('skipped'); return; }
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
      const items = focusables(), first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); dialog.current?.focus(); return; }
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !items.includes(active as HTMLElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (active === last || !items.includes(active as HTMLElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      inertElements.forEach(({ element, wasInert }) => { element.inert = wasInert; });
      body.style.overflow = overflow; body.style.paddingRight = padding;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, host, close]);

  useEffect(() => {
    if (!open || !dialog.current) return;
    const panel = dialog.current;
    const measure = () => { const box = panel.getBoundingClientRect(); setPanelSize({ width: box.width, height: box.height }); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(panel);
    return () => observer.disconnect();
  }, [open, host]);

  useEffect(() => {
    if (!open || !host) return;
    const focusedWhenScheduled = document.activeElement;
    const frame = requestAnimationFrame(() => {
      if (document.activeElement === focusedWhenScheduled || !dialog.current?.contains(document.activeElement)) {
        dialog.current?.querySelector<HTMLElement>('[data-tour-title]')?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, host, mode, stepIndex]);

  useEffect(() => {
    if (!open || mode !== 'tour') return;
    let cancelled = false, frame = 0, retry = 0, attempts = 0;
    let target: HTMLElement | null = null, observer: ResizeObserver | null = null;
    const measure = () => {
      if (cancelled || !target?.isConnected) return;
      const box = target.getBoundingClientRect();
      setTargetBox(box.width && box.height ? { left: box.left, top: box.top, width: box.width, height: box.height, target: step.target } : null);
    };
    const queue = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const find = () => {
      if (cancelled) return;
      target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (target?.getClientRects().length) {
        const box = target.getBoundingClientRect();
        target.scrollIntoView({ behavior: 'auto', block: box.height > window.innerHeight * .55 ? 'start' : 'center', inline: 'nearest' });
        observer = new ResizeObserver(queue); observer.observe(target); setFindingTarget(false); queue();
      } else if (++attempts < 120) retry = window.setTimeout(find, 50);
      else setFindingTarget(false);
    };
    const start = requestAnimationFrame(() => { setTargetBox(null); setFindingTarget(true); navigate.current(step.view); find(); });
    window.addEventListener('resize', queue); window.addEventListener('scroll', queue, true);
    return () => { cancelled = true; cancelAnimationFrame(start); cancelAnimationFrame(frame); window.clearTimeout(retry); observer?.disconnect(); window.removeEventListener('resize', queue); window.removeEventListener('scroll', queue, true); };
  }, [open, mode, stepIndex, step.view, step.target]);

  if (!host || !open) return null;
  const spot = mode === 'tour' && targetBox?.target === step.target ? spotlightBox(targetBox, viewport, panelSize) : null;
  const position = coachmarkPosition(spot, viewport, panelSize);
  const Icon = mode === 'offer' ? Compass : step.icon;

  return createPortal(<div ref={layer} className={styles.layer} data-onboarding={mode} data-onboarding-step={mode === 'tour' ? stepIndex + 1 : undefined} onPointerDown={event => { if (!dialog.current?.contains(event.target as Node)) event.preventDefault(); }}>
    {spot ? <div className={styles.spotlight} style={spot} data-onboarding-spotlight data-onboarding-target={step.target} aria-hidden="true"/> : <div className={styles.dimmer} data-onboarding-dimmer aria-hidden="true"/>}
    <section ref={dialog} className={`${styles.coachmark} ${mode === 'offer' ? styles.offer : ''}`} style={mode === 'tour' ? position : undefined} data-onboarding-coachmark role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description ${id}-note`} tabIndex={-1}>
      <button className={styles.close} type="button" aria-label="Close guide" onClick={() => close('skipped')}><X size={19} aria-hidden="true"/></button>
      {mode === 'offer' ? <span className={styles.badge}>Optional guide</span> : <div className={styles.stepMeta} role="status" aria-live="polite" aria-atomic="true"><span>Step {stepIndex + 1} of {steps.length}</span><strong>{step.label}</strong></div>}
      {mode === 'tour' && <div className={styles.progress} aria-hidden="true">{steps.map((item, index) => <span key={item.target} data-reached={index <= stepIndex}/>)}</div>}
      <span className={styles.icon}><Icon size={25} aria-hidden="true"/></span>
      <h2 id={`${id}-title`} data-tour-title tabIndex={-1}>{mode === 'offer' ? 'Want a quick look around?' : step.title}</h2>
      <p className={styles.description} id={`${id}-description`}>{mode === 'offer' ? 'Follow five simple steps through planning, activity, points and water rewards. Or skip straight to the map and explore at your own pace.' : step.body}</p>
      {mode === 'tour' && findingTarget && <p className={styles.waiting}>Opening this screen…</p>}
      <div className={styles.note} id={`${id}-note`}><ShieldCheck size={16} aria-hidden="true"/><p>{mode === 'offer' ? 'This is a prototype. Water rewards and dispensing are simulated. The guide does not start activities or request location.' : step.note}</p></div>
      {mode === 'offer' ? <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => close('skipped')}>Skip for now</button><button type="button" className={styles.primary} onClick={() => { setStepIndex(0); setMode('tour'); }}>Show me around <ArrowRight size={16} aria-hidden="true"/></button></div>
        : <><div className={styles.actions}><button type="button" className={styles.secondary} disabled={stepIndex === 0} onClick={() => setStepIndex(index => Math.max(0, index - 1))}><ArrowLeft size={16} aria-hidden="true"/>Back</button><button type="button" className={styles.primary} onClick={() => { if (stepIndex === steps.length - 1) close('completed'); else setStepIndex(index => index + 1); }}>{stepIndex === steps.length - 1 ? 'Finish guide' : 'Next'}<ArrowRight size={16} aria-hidden="true"/></button></div><button type="button" className={styles.skip} onClick={() => close('skipped')}>Skip guide</button></>}
    </section>
  </div>, host);
}
