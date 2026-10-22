import StrideApp from '../components/stride-app';
import { getUser } from '../auth';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getUser();
  return <StrideApp signedIn={Boolean(user)} signInPath="/signin" signOutPath="/signout" />;
}
