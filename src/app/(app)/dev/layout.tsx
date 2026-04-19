import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function DevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.CURATOR_ENABLED === 'true') {
    return <>{children}</>;
  }

  const { userId } = await auth();
  if (!userId) redirect('/');

  const user = await currentUser();
  if (user?.publicMetadata?.curator !== true) redirect('/');

  return <>{children}</>;
}
