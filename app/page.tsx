import StrideApp from '../components/stride-app';
import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getChatGPTUser();
  return <StrideApp signedIn={Boolean(user)} signInPath={chatGPTSignInPath('/')} signOutPath={chatGPTSignOutPath('/')} />;
}
