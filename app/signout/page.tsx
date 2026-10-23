import Link from 'next/link';
import { SignOutButton } from '@clerk/nextjs';
import { authConfigured } from '../../lib/auth-config';

export const dynamic = 'force-dynamic';
export default function SignOut() {
  return <main className="auth-page"><h1>Sign out of StrideEco?</h1>
    {authConfigured() && <SignOutButton redirectUrl="/"><button className="button primary">Sign out</button></SignOutButton>}
    <Link href="/">Back to route planning</Link>
  </main>;
}
