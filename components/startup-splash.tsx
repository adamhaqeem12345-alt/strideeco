'use client';

import Brand from './brand';
import { useEffect, useRef, useState } from 'react';
import styles from './startup-splash.module.css';

const MINIMUM_REVEAL_MS = 400;
const EXIT_MS = 180;
const MAXIMUM_VISIBLE_MS = 6000;

/** Shared visual for the initial client overlay and the server loading boundary. */
export function StartupSplashArtwork({ exiting = false }: { exiting?: boolean }) {
  return <div className={`${styles.splash} ${exiting ? styles.exiting : ''}`} data-startup-splash="">
    <div className={styles.disc}>
      <div className={styles.logo}><Brand variant="auth"/></div>
      <div className={styles.progress} aria-hidden="true"><span/></div>
      <p className={styles.status} role="status" aria-live="polite" aria-atomic="true">Opening StrideEco…</p>
    </div>
  </div>;
}

type Props = { ready: boolean; onComplete: () => void };

/** A brief branded reveal that always releases the app, even if auth is slow. */
export default function StartupSplash({ ready, onComplete }: Props) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const guard = useRef<HTMLDivElement>(null);
  const completed = useRef(false);
  const callback = useRef(onComplete);
  const requestExit = useRef<(() => void) | null>(null);

  useEffect(() => { callback.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const mountedAt = performance.now();
    const exitDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : EXIT_MS;
    let revealTimer: number | undefined;
    let exitTimer: number | undefined;
    let exitingNow = false;
    let stopped = false;

    const finish = () => {
      if (stopped || completed.current) return;
      completed.current = true;
      window.clearTimeout(revealTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(escapeTimer);
      requestExit.current = null;
      setVisible(false);
      callback.current();
    };
    const beginExit = () => {
      if (stopped || completed.current || exitingNow) return;
      window.clearTimeout(revealTimer);
      const remainingReveal = Math.max(0, MINIMUM_REVEAL_MS - (performance.now() - mountedAt));
      revealTimer = window.setTimeout(() => {
        if (stopped || completed.current || exitingNow) return;
        exitingNow = true;
        setExiting(true);
        exitTimer = window.setTimeout(finish, exitDuration);
      }, remainingReveal);
    };
    requestExit.current = beginExit;
    // Include the exit fade within the escape deadline, rather than after it.
    const escapeTimer = window.setTimeout(beginExit, MAXIMUM_VISIBLE_MS - exitDuration);
    return () => {
      stopped = true;
      requestExit.current = null;
      window.clearTimeout(revealTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(escapeTimer);
    };
  }, []);

  useEffect(() => { if (ready) requestExit.current?.(); }, [ready]);

  useEffect(() => {
    if (!visible) return;
    const node = guard.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    node?.focus({ preventScroll: true });
    const keepFocusOnSplash = (event: FocusEvent) => {
      if (node && event.target instanceof Node && !node.contains(event.target)) node.focus({ preventScroll: true });
    };
    document.addEventListener('focusin', keepFocusOnSplash, true);
    return () => {
      document.removeEventListener('focusin', keepFocusOnSplash, true);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousTouchAction;
      if ((document.activeElement === node || document.activeElement === document.body) && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [visible]);

  if (!visible) return null;
  return <div ref={guard} className={styles.guard} tabIndex={-1} onKeyDown={event => { if (event.key === 'Tab') event.preventDefault(); }}>
    <StartupSplashArtwork exiting={exiting}/>
  </div>;
}
