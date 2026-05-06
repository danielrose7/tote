import { getPublishedCollectionById } from '../../../../lib/publishedCollectionsDb';
import { PublicCollectionView } from '../../../(public)/s/[username]/[slug]/PublicCollectionView';
import styles from './page.module.css';

type Params = Promise<{ id: string }>;

export default async function PublicViewPage(props: { params: Params }) {
  const { id } = await props.params;
  const collection = await getPublishedCollectionById(id);

  if (!collection) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorIcon}>!</div>
          <h1 className={styles.title}>Not Found</h1>
          <p className={styles.description}>
            This collection doesn&apos;t exist or is no longer public.
          </p>
        </div>
      </div>
    );
  }

  return <PublicCollectionView collection={collection} />;
}
