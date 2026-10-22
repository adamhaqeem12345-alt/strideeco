'use client';
import { SignOutButton, UserButton } from '@clerk/nextjs';
import { LogIn } from 'lucide-react';

export function AccountControls({ signedIn }: { signedIn: boolean }) {
  return signedIn ? <div className="avatar" aria-label="Your account"><UserButton /></div> : <>
    <a className="sign-in" href="/sign-in"><LogIn size={15} />Sign in</a>
    <a className="sign-in" href="/sign-up">Sign up</a>
  </>;
}

export function ProfileControls({ signedIn }: { signedIn: boolean }) {
  return signedIn ? <div className="account-profile-actions">
    <UserButton />
    <SignOutButton redirectUrl="/"><button className="button secondary">Sign out</button></SignOutButton>
  </div> : <div className="account-profile-actions">
    <a className="button primary" href="/sign-up">Create account</a>
    <a className="button secondary" href="/sign-in">Sign in</a>
  </div>;
}
