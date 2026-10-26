import { ArrowRight } from 'lucide-react';
import styles from './prototype-improvements.module.css';

export type PaceStep = 'plan' | 'act' | 'collect' | 'exchange';
const steps = [
  { id: 'plan', letter: 'P', label: 'Plan' },
  { id: 'act', letter: 'A', label: 'Act' },
  { id: 'collect', letter: 'C', label: 'Collect' },
  { id: 'exchange', letter: 'E', label: 'Exchange' },
] as const;

type Props = {
  current: PaceStep;
  detail: string;
  nextLabel?: string;
  disabled?: boolean;
  onChoose: (step: PaceStep) => void;
  onNext?: () => void;
};

export default function PaceJourney({ current, detail, nextLabel, disabled, onChoose, onNext }: Props) {
  return <section className={styles.journey} aria-label="Your PACE journey">
    <nav aria-label="PACE journey" className={styles.steps}>
      {steps.map(step => <button key={step.id} type="button" aria-label={step.label}
        aria-current={current === step.id ? 'step' : undefined}
        className={`${styles.step} ${current === step.id ? styles.current : ''}`}
        onClick={() => onChoose(step.id)}>
        <span className={styles.letter} data-step={step.id} aria-hidden="true">{step.letter}</span>
        <span>{step.label}</span>
      </button>)}
    </nav>
    <div className={styles.nextStep}>
      <p><strong>Next up</strong>{detail}</p>
      {nextLabel && onNext && <button className="button secondary" type="button" disabled={disabled} onClick={onNext}>
        {nextLabel}<ArrowRight size={16} aria-hidden="true"/>
      </button>}
    </div>
  </section>;
}
