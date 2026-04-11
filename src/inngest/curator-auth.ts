import { auth, currentUser } from '@clerk/nextjs/server';

export async function isCurator(): Promise<boolean> {
  if (process.env.CURATOR_ENABLED === 'true') return true;
  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  return user?.publicMetadata?.curator === true;
}
