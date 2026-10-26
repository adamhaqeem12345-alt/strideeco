'use client';

import { useId, useState } from 'react';
import { ArrowRight, Check, ClipboardCheck, FlaskConical, Footprints, MapPin, Route, ShieldCheck, Sun, Users } from 'lucide-react';
import RouteMap from './route-map';
import { km } from '../lib/geo';
import { SAMPLE_INSIGHTS_NOTICE, sampleRouteInsights, sampleRouteUseTotal, sampleSegmentInsights } from '../lib/sample-insights';
import styles from './township-insights.module.css';

type Selection = { kind: 'route' | 'segment'; id: string };
const mappedRoutes = sampleRouteInsights.map(example => example.route);

export default function TownshipInsights() {
  const headingId = useId();
  const [selection, setSelection] = useState<Selection>({ kind: 'route', id: sampleRouteInsights[0]?.id ?? '' });
  const selectedSegment = selection.kind === 'segment' ? sampleSegmentInsights.find(example => example.id === selection.id) : undefined;
  const selected = selectedSegment ?? sampleRouteInsights.find(example => example.id === selection.id) ?? sampleRouteInsights[0];

  if (!selected) return <section className={styles.preview} aria-label="Sample township insights"><p>{SAMPLE_INSIGHTS_NOTICE}</p><p>Mapped route examples are unavailable.</p></section>;

  return <div className={styles.preview} data-township-insights="sample">
    <section className={styles.introduction} aria-labelledby={headingId}>
      <div className={styles.introCopy}>
        <span className={styles.sampleBadge}><FlaskConical size={15} aria-hidden="true"/>Sample data</span>
        <h2 id={headingId}>A little movement.<br/>A clearer next step.</h2>
        <p>Explore how a township team could turn route use into questions worth reviewing.</p>
      </div>
      <div className={styles.evidenceNote} role="note">
        <ShieldCheck size={23} aria-hidden="true"/>
        <div><strong>An illustrative preview</strong><p>{SAMPLE_INSIGHTS_NOTICE} Route use and exposure values are invented. The paths come from the public map.</p></div>
      </div>
    </section>

    <dl className={styles.metrics} aria-label="Illustrative snapshot summary">
      <div className={styles.metric}><dt><span className={styles.metricIcon}><Footprints size={18} aria-hidden="true"/></span><span>Sample route uses</span></dt><dd><strong>{sampleRouteUseTotal}</strong><span>Invented counts</span></dd></div>
      <div className={styles.metric}><dt><span className={`${styles.metricIcon} ${styles.sunIcon}`}><Sun size={18} aria-hidden="true"/></span><span>Sample review segments</span></dt><dd><strong>{sampleSegmentInsights.length}</strong><span>Illustrative exposure</span></dd></div>
      <div className={styles.metric}><dt><span className={`${styles.metricIcon} ${styles.peopleIcon}`}><Users size={18} aria-hidden="true"/></span><span>Real activities used</span></dt><dd><strong>0</strong><span>No resident data</span></dd></div>
    </dl>

    <section className={styles.explorer} aria-labelledby={`${headingId}-routes`}>
      <header className={styles.sectionHeader}><div><p className={styles.eyebrow}>A SAMPLE SNAPSHOT</p><h2 id={`${headingId}-routes`}>Popular routes, in context</h2><p>Select an example to highlight its mapped path.</p></div><span className={styles.smallBadge}>Illustrative use</span></header>
      <div className={styles.explorerBody}>
        <div className={styles.routeColumn}>
          <ol className={styles.routeList} aria-label="Sample popular routes">
            {sampleRouteInsights.map((example, index) => {
              const active = selection.kind === 'route' && selected.id === example.id;
              return <li key={example.id}><button type="button" className={styles.routeButton} aria-pressed={active} aria-label={`Show ${example.label} on map`} onClick={() => setSelection({ kind: 'route', id: example.id })}>
                <span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.routeCopy}><strong>{example.label}</strong><span>{km(example.route.distance)} km of mapped paths</span><span className={styles.useTrack} aria-hidden="true"><i style={{ width: `${example.sampleUses / sampleRouteInsights[0].sampleUses * 100}%` }}/></span><small>{example.sampleUses} sample uses · invented</small></span>
                <span className={styles.selectionIcon} aria-hidden="true">{active ? <Check size={17}/> : <ArrowRight size={17}/>}</span>
              </button></li>;
            })}
          </ol>
          <p className={styles.listNote}>These are sample route labels, not observed resident journeys. A popular path would be a starting point for review, not proof that work is needed.</p>
        </div>
        <figure className={styles.mapFigure}>
          <div className={styles.mapHeading}><div><span>{selectedSegment ? 'SELECTED SAMPLE SEGMENT' : 'SELECTED SAMPLE ROUTE'}</span><h3>{selected.label}</h3></div><MapPin size={20} aria-hidden="true"/></div>
          <div className={styles.mapFrame}><RouteMap route={selected.route} routes={mappedRoutes}/></div>
          <figcaption><span className={styles.legendMark} aria-hidden="true"/>Selected mapped path · {km(selected.route.distance)} km<span>Public map geometry; no resident tracks or measured exposure layer.</span></figcaption>
        </figure>
      </div>
    </section>

    <section className={styles.segments} aria-labelledby={`${headingId}-segments`}>
      <header className={styles.sectionHeader}><div><p className={styles.eyebrow}>QUESTIONS FOR A SITE VISIT</p><h2 id={`${headingId}-segments`}>Exposed path segments</h2><p>Hypothetical examples of where a township review could begin.</p></div><span className={styles.smallBadge}>Sample data</span></header>
      <div className={styles.segmentGrid}>
        {sampleSegmentInsights.map(example => {
          const active = selectedSegment?.id === example.id;
          return <button type="button" key={example.id} className={styles.segmentButton} aria-pressed={active} aria-label={`Show ${example.label} on map`} onClick={() => setSelection({ kind: 'segment', id: example.id })}>
            <span className={styles.segmentTop}><span className={styles.segmentLetter}>{example.label.at(-1)}</span><span className={styles.segmentType}>Illustrative exposure</span>{active && <Check size={17} aria-hidden="true"/>}</span>
            <strong>{example.label}</strong><span className={styles.segmentParent}>{example.parentLabel} · {Math.round(example.route.distance)} m mapped stretch</span>
            <span className={styles.exposure}><b>{example.sampleExposure}%</b><span>sample exposure</span></span>
            <span className={styles.exposureTrack} aria-hidden="true"><i style={{ width: `${example.sampleExposure}%` }}/></span>
            <span className={styles.segmentFooter}>{example.sampleUses} invented uses<span>View on map <ArrowRight size={14} aria-hidden="true"/></span></span>
          </button>;
        })}
      </div>
      <p className={styles.shadeNote}><Sun size={17} aria-hidden="true"/><span><strong>These percentages are not shade estimates.</strong> They are made-up exposure values for this preview. Building-height and canopy data are missing from the public map; actual cover needs suitable evidence and a site check.</span></p>
    </section>

    <section className={styles.review} aria-labelledby={`${headingId}-review`}>
      <div className={styles.reviewIntro}><span className={styles.reviewIcon}><ClipboardCheck size={24} aria-hidden="true"/></span><p className={styles.eyebrow}>NEXT REVIEW ACTION</p><h2 id={`${headingId}-review`}>{selected.reviewTitle}</h2><p>{selected.reviewQuestion}</p><span className={styles.reviewOwner}>For the township team · example brief</span></div>
      <div className={styles.reviewSteps}><span className={styles.reviewSelection}><Route size={16} aria-hidden="true"/>{selected.label}</span><ol>{selected.reviewChecks.map((check, index) => <li key={check}><span aria-hidden="true">0{index + 1}</span><p>{check}</p></li>)}</ol><p className={styles.reviewBoundary}>This is a suggested review, not a confirmed infrastructure issue or an approved improvement.</p></div>
    </section>

    <aside className={styles.dataBoundary}><ShieldCheck size={20} aria-hidden="true"/><p><strong>A future pilot would need real evidence.</strong> Use separately consented, aggregated activity; agree privacy and reporting rules; verify site conditions; then record the township team’s review. This preview does not read your activity history, wallet or location.</p></aside>
    <span className={styles.srOnly} role="status" aria-live="polite">Showing {selected.label} and its example review brief.</span>
  </div>;
}
