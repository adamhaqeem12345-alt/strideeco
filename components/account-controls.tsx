'use client';
import { SignOutButton, UserButton } from '@clerk/nextjs';
import { LogIn } from 'lucide-react';
import AuthLink from './auth-link';

export function AccountControls({ signedIn }: { signedIn: boolean }) {
  return signedIn ? <div className="avatar" aria-label="Your account"><UserButton /></div> : <>
    <AuthLink className="sign-in" href="/sign-in" pendingLabel="Opening sign-in…"><LogIn size={15} />Sign in</AuthLink>
    <AuthLink className="sign-in" href="/sign-up" pendingLabel="Opening account creation…">Sign up</AuthLink>
  </>;
}

export function ProfileControls({ signedIn }: { signedIn: boolean }) {
  return signedIn ? <div className="account-profile-actions">
    <UserButton />
    <SignOutButton redirectUrl="/"><button className="button secondary">Sign out</button></SignOutButton>
  </div> : <div className="account-profile-actions">
    <AuthLink className="button primary" href="/sign-up" pendingLabel="Opening account creation…">Create account</AuthLink>
    <AuthLink className="button secondary" href="/sign-in" pendingLabel="Opening sign-in…">Sign in</AuthLink>
  </div>;
}
