import AuthLoading from '../../components/auth-loading';
import AuthShell from '../../components/auth-shell';

export default function Loading() {
  return <AuthShell><AuthLoading label="Loading account creation…" /></AuthShell>;
}
