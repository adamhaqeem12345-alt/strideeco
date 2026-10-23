import { Info, Loader2, RefreshCw } from 'lucide-react';

export type AccountDataState = {
  status: 'loading' | 'ready' | 'unavailable';
  hasLoaded: boolean;
  code?: string;
};

export default function AccountDataNotice({ data, refreshing, onRetry }: {
  data: AccountDataState; refreshing: boolean; onRetry: () => void;
}) {
  if (data.status === 'ready') return null;
  const loading = data.status === 'loading';
  return <section className="account-data-notice" data-account-status={data.status}>
    {loading ? <Loader2 className="spin" size={20} aria-hidden="true" /> : <Info size={20} aria-hidden="true" />}
    <div role="status" aria-live="polite"><strong>{loading ? 'Loading your saved progress…' : data.code === 'ACCOUNT_STORAGE_NOT_CONFIGURED' ? 'You’re signed in. Saved progress and rewards are not available yet.' : 'Your saved progress is temporarily unavailable.'}</strong>
      <p>{loading ? 'Fetching your routes, points and water rewards.' : data.hasLoaded ? 'Showing your last loaded data. Saving and rewards are paused until we reconnect.' : 'You can still explore the map and plan a walk. Your balance will appear when account data is available.'}</p></div>
    {!loading && <button className="button secondary" onClick={onRetry} disabled={refreshing}>{refreshing ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}{refreshing ? 'Checking…' : 'Try again'}</button>}
  </section>;
}
