import Link from 'next/link';
import { authConfigured, signIn } from '../../auth';

export const dynamic = 'force-dynamic';

export default function SignIn() {
  const ready = authConfigured() && Boolean(process.env.TURSO_DATABASE_URL);
  return <main style={{ maxWidth: 480, margin: '12vh auto', padding: 28 }}>
    <p className="eyebrow">STRIDEECO</p>
    <h1>A place for your progress.</h1>
    <p>Keep saved routes, activities and prototype water rewards together across devices.</p>
    {ready ? <form action={async () => { 'use server'; await signIn('github', { redirectTo: '/' }); }}>
      <button className="button primary full" type="submit">Continue with GitHub</button>
    </form> : <p role="status">Route planning is available. Account features will open once this deployment has its sign-in and persistent database configured.</p>}
    <p><Link href="/">Back to route planning</Link></p>
  </main>;
}
