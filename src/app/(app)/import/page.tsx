import { auth, currentUser } from '@clerk/nextjs/server';
import { getT } from '@/i18n/server';
import { ImportPageClient } from './ImportPageClient';
import styles from './import.module.css';

export default async function ImportPage() {
  const { t } = await getT();
  const { userId } = await auth();

  if (!userId) {
    return (
      <main className={styles.deniedMain}>
        <p>{t('import.signIn')}</p>
      </main>
    );
  }

  const user = await currentUser();
  const canImport = user?.publicMetadata?.canImport === true;

  if (!canImport) {
    return (
      <main className={styles.deniedMain}>
        <p>{t('import.restricted')}</p>
      </main>
    );
  }

  return <ImportPageClient />;
}
