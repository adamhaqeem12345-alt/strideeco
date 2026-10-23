import type { ReactNode } from 'react';
import AuthLink from './auth-link';
import Brand from './brand';

export default function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-page">
    <AuthLink href="/" className="auth-brand" aria-label="StrideEco home" pendingLabel="Opening route planning…"><Brand variant="auth" /></AuthLink>
    <h1>A place for your progress.</h1>
    <p>Keep saved routes, activities and prototype water rewards together across devices.</p>
    {children}
    <AuthLink href="/" pendingLabel="Opening route planning…">Back to route planning</AuthLink>
  </main>;
}
