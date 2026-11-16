import Link from 'next/link';
import { Fragment } from 'react';
import styles from '@/app/(public)/docs/docs.module.css';
import type { Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/publicPages';
import { getPublicT } from '@/i18n/server';
import { AnswerBlock } from './AnswerBlock';
import { HEROES } from './heroes';
import { PublicCollectionLinks } from './PublicCollectionLinks';
import { USE_CASES, type UseCaseSlug } from './useCasesConfig';

type Step = { lead: string; body: string };
type Faq = { q: string; a: string };
type Card = { title: string; description: string };

export async function UseCaseArticle({
  locale,
  slug,
}: {
  locale: Locale;
  slug: UseCaseSlug;
}) {
  const { t } = await getPublicT(locale, ['useCases']);
  const year = new Date().getFullYear();
  const base = `useCases.pages.${slug}`;
  // `list('collections', 'descriptions')` → useCases.pages.<slug>.collections.descriptions
  const list = <T,>(...path: string[]) =>
    t([base, ...path].join('.'), { returnObjects: true, year }) as T[];
  const { accent, collections, related } = USE_CASES[slug];
  const descriptions = list<string>('collections', 'descriptions');
  const faq = list<Faq>('faq');
  const Hero = HEROES[slug];

  return (
    <article className={styles.article}>
      <h1>{t(`${base}.title`)}</h1>
      <p className={styles.lead}>{t(`${base}.lead`)}</p>

      <Hero />

      <p>
        <a href="https://tote.tools/collections">
          {t('useCases.common.ctaStart')}
        </a>
      </p>

      <AnswerBlock
        question={t(`${base}.answer.question`)}
        answer={t(`${base}.answer.answer`)}
        accent={accent}
        steps={list<string>('answer.steps')}
      />

      <PublicCollectionLinks
        title={t(`${base}.collections.title`)}
        intro={t(`${base}.collections.intro`)}
        collections={collections.map((c, i) => ({
          ...c,
          description: descriptions[i],
        }))}
      />

      <p>{t(`${base}.intro`)}</p>

      <h2>{t(`${base}.solutionHeading`)}</h2>

      {list<Card>('cards').map((card) => (
        <div className={styles.card} key={card.title}>
          <h3 className={styles.cardTitle}>{card.title}</h3>
          <p className={styles.cardDescription}>{card.description}</p>
        </div>
      ))}

      <h2>{t('useCases.common.setupHeading')}</h2>
      <p>{t(`${base}.setupIntro`)}</p>
      <ul>
        {list<string>('setup').map(
          (item) => (
            <li key={item}>{item}</li>
          ),
        )}
      </ul>

      <h2>{t('useCases.common.howHeading')}</h2>
      <ol className={styles.stepList}>
        {list<Step>('steps').map((step) => (
          <li key={step.lead}>
            <span>
              <strong>{step.lead}</strong> {step.body}
            </span>
          </li>
        ))}
      </ol>

      <div className={styles.tip}>
        <p>
          <span className={styles.tipLabel}>{t('useCases.common.tip')}</span>
          {t(`${base}.tip`)}
        </p>
      </div>

      <h2>{t('useCases.common.faqHeading')}</h2>
      {faq.map((item) => (
        <Fragment key={item.q}>
          <h3>{item.q}</h3>
          <p>{item.a}</p>
        </Fragment>
      ))}

      <h2>{t('useCases.common.relatedHeading')}</h2>
      <ul>
        {related.map((target) => (
          <li key={target}>
            <Link href={localizedPath(locale, `/use-cases/${target}`)}>
              {t(`useCases.names.${target}`)}
            </Link>{' '}
            — {t(`${base}.related.${target}`)}
          </li>
        ))}
      </ul>

      <p>
        <a href="https://tote.tools/collections">
          {t('useCases.common.ctaTry')}
        </a>
      </p>

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
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />
    </article>
  );
}
