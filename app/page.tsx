import AccountApp from '../components/account-app';
import { authConfigured } from '../lib/auth-config';
export const dynamic = 'force-dynamic';
export default function Home() {
  return <AccountApp authAvailable={authConfigured()} />;
}
