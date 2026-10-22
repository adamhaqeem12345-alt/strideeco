import Link from 'next/link';
import { signOut } from '../../auth';

export default function SignOut() {
  return <main style={{ maxWidth: 480, margin: '12vh auto', padding: 28 }}>
    <h1>Sign out of StrideEco?</h1>
    <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }); }}>
      <button className="button primary" type="submit">Sign out</button>
    </form>
    <p><Link href="/">Keep exploring</Link></p>
  </main>;
}
