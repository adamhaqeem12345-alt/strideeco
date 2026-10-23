'use client';
import { useAuth } from '@clerk/nextjs';
import StrideApp from './stride-app';

function ConnectedApp() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  // Reset private in-memory UI whenever the active Clerk account changes.
  return <StrideApp key={userId ?? 'guest'} signedIn={isLoaded && Boolean(isSignedIn)}
    authAvailable signInPath="/sign-in" signOutPath="/signout" />;
}

export default function AccountApp({ authAvailable }: { authAvailable: boolean }) {
  return authAvailable ? <ConnectedApp /> : <StrideApp signedIn={false}
    authAvailable={false} signInPath="/sign-in" signOutPath="/signout" />;
}
