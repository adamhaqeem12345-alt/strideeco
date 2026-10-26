import { CheckCircle2, Footprints, Loader2 } from 'lucide-react';
import { RULES } from '../lib/pilot';
import styles from './prototype-improvements.module.css';

type Props = {
  available: number;
  signedIn: boolean;
  status: 'loading' | 'ready' | 'unavailable';
  hasAccountData: boolean;
};

export default function PointsProgress({ available, signedIn, status, hasAccountData }: Props) {
  const known = signedIn && status === 'ready' && hasAccountData;
  const remaining = Math.max(0, RULES.waterPoints - available);
  const remainingMetres = remaining * RULES.metresPerPoint;
  const distance = remainingMetres >= 1000 ? `${Number((remainingMetres / 1000).toFixed(2))} km` : `${remainingMetres} m`;
  const rewardReady = known && remaining === 0;
  return <div className={styles.pointsProgress} aria-label="Progress to a water reward">
    <div className={styles.progressTop}>
      <strong>{!signedIn ? 'A little movement adds up.' : !known ? status === 'loading' ? 'Loading your progress…' : 'Progress unavailable' : rewardReady ? 'Your next water reward is ready.' : `${available} / ${RULES.waterPoints} points`}</strong>
      {signedIn && status === 'loading' ? <Loader2 size={20} className="spin" aria-label="Loading progress"/> : rewardReady ? <CheckCircle2 size={20} aria-hidden="true"/> : <Footprints size={20} aria-hidden="true"/>}
    </div>
    {known && <div className={styles.progressTrack} role="progressbar" aria-label="Points toward a water reward"
      aria-valuemin={0} aria-valuemax={RULES.waterPoints} aria-valuenow={Math.min(RULES.waterPoints, Math.max(0, available))}
      aria-valuetext={`${available} available points; ${remaining} more needed`}>
      <span style={{ width: `${Math.min(100, Math.max(0, available / RULES.waterPoints * 100))}%` }}/>
    </div>}
    <p>{!signedIn ? `Sign in to keep your progress. ${RULES.waterPoints * RULES.metresPerPoint / 1000} km of eligible activity earns enough prototype points for one water reward.`
      : !known ? 'Connect your account data to see how far you are from a reward.'
      : rewardReady ? `${RULES.waterPoints} points can be exchanged for one simulated water reward at your chosen mock stop.`
      : `Walk another ${distance} of eligible activity to earn the ${remaining} points for water.`}</p>
    <small>Prototype rules · 1 point per {RULES.metresPerPoint} m · up to {RULES.monthlyWaterLimit} water rewards per month</small>
  </div>;
}
