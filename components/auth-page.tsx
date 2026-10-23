import { SignIn, SignUp } from '@clerk/nextjs';
import { authConfigured } from '../lib/auth-config';
import AuthLoading from './auth-loading';
import AuthShell from './auth-shell';

export default function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <AuthShell>
    {authConfigured() ? mode === 'sign-in'
      ? <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/" fallback={<AuthLoading label="Loading sign-in…" />} />
      : <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/" fallback={<AuthLoading label="Loading account creation…" />} />
      : <p role="status">Account sign-in is being connected. You can explore and plan routes now.</p>}
  </AuthShell>;
}
