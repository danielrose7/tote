import { Fragment } from 'react';
import type { Locale } from '@/i18n/config';
import { getPublicT } from '@/i18n/server';
import { AnchorHeading } from './AnchorHeading';
import { renderInline, stripInline } from './DocsInline';
import type { DocSlug } from './docsConfig';
import styles from './docs.module.css';
import structure from './structure.json';

type Block = { t: string; id?: string; label?: string };
type Body = string | string[] | { title: string; x: string };

const FAQ_ID = 'frequently-asked-questions';

/** One help-center page: the block layout comes from `structure.json`, the
 * words (same order) from the `docs` catalog, so each language is just a list
 * of strings and the anchor ids stay identical across languages. */
export async function DocsArticle({
  locale,
  slug,
}: {
  locale: Locale;
  slug: DocSlug;
}) {
  const { t } = await getPublicT(locale, ['docs']);
  const base = `docs.pages.${slug}`;
  const blocks = (structure as Record<string, Block[]>)[slug];
  const body = t(`${base}.body`, { returnObjects: true }) as Body[];
  const inline = (s: string) => renderInline(s, locale);

  // Structured data: every question under the FAQ heading with its answer.
  const faq: { q: string; a: string[] }[] = [];
  let inFaq = false;
  blocks.forEach((b, i) => {
    const text = body[i];
    if (b.t === 'h2') inFaq = b.id === FAQ_ID;
    else if (inFaq && b.t === 'h3') faq.push({ q: stripInline(text as string), a: [] });
    else if (inFaq && b.t === 'p' && faq.length)
      faq[faq.length - 1].a.push(stripInline(text as string));
  });

  return (
    <article className={styles.article}>
      <h1>{t(`${base}.title`)}</h1>
      <p className={styles.lead}>{inline(t(`${base}.lead`))}</p>

      {blocks.map((b, i) => {
        const text = body[i];
        const key = `${i}`;
        switch (b.t) {
          case 'h2':
          case 'h3':
            return (
              <AnchorHeading key={key} as={b.t} id={b.id as string}>
                {text as string}
              </AnchorHeading>
            );
          case 'p':
            return <p key={key}>{inline(text as string)}</p>;
          case 'ol':
          case 'ul': {
            const List = b.t;
            return (
              <List key={key}>
                {(text as string[]).map((item) => (
                  <li key={item}>{inline(item)}</li>
                ))}
              </List>
            );
          }
          case 'tip':
            return (
              <div key={key} className={styles.tip}>
                <p>
                  <span className={styles.tipLabel}>
                    {t(`docs.common.labels.${b.label}`)}
                  </span>
                  {inline(text as string)}
                </p>
              </div>
            );
          case 'card': {
            const card = text as { title: string; x: string };
            return (
              <div key={key} className={styles.card}>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardDescription}>{inline(card.x)}</p>
              </div>
            );
          }
          default:
            return <Fragment key={key} />;
        }
      })}

      {faq.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              inLanguage: locale,
              mainEntity: faq.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: { '@type': 'Answer', text: item.a.join(' ') },
              })),
            }),
          }}
        />
      )}
    </article>
  );
}
