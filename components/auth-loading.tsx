import styles from './auth-loading.module.css';

export function AuthNavigationStatus({ label, compact = false }: { label: string; compact?: boolean }) {
  return <span className={`${styles.navigationStatus}${compact ? ` ${styles.compact}` : ''}`} role="status" aria-live="polite" aria-atomic="true" data-auth-navigation-status>
    <span className={styles.spinner} aria-hidden="true" />
    <span className={compact ? styles.screenReaderOnly : undefined}>{label}</span>
  </span>;
}

export default function AuthLoading({ label }: { label: string }) {
  return <div className={styles.loadingCard} data-auth-loading>
    <AuthNavigationStatus label={label} />
    <p>Your form will be ready in a moment.</p>
  </div>;
}
