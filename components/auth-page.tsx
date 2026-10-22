import Link from 'next/link';
import { SignIn, SignUp } from '@clerk/nextjs';
import { authConfigured } from '../lib/auth-config';

export default function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <main className="auth-page">
    <p className="eyebrow">STRIDEECO</p>
    <h1>A place for your progress.</h1>
    <p>Keep saved routes, activities and prototype water rewards together across devices.</p>
    {authConfigured() ? mode === 'sign-in'
      ? <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
      : <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/" />
      : <p role="status">Account sign-in is being connected. You can explore and plan routes now.</p>}
    <Link href="/">Back to route planning</Link>
  </main>;
}
