import { Fragment, type ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/publicPages';
import { APP_STORE_URL, CHROME_WEB_STORE_URL } from '@/lib/constants';

const TAG =
  /<(strong|em|code|store|appstore|a)(?: href="([^"]*)")?>([\s\S]*?)<\/\1>/g;

/**
 * Renders a catalog string with light inline markup: `<strong>`, `<em>`,
 * `<code>`, `<a href="…">`, plus `<store>` / `<appstore>` for the store
 * download links (their URLs are constants, not translatable). Tags don't
 * nest. Internal links are pointed at the page's version in `locale`.
 */
export function renderInline(text: string, locale: Locale): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(TAG)) {
    const [whole, tag, href, inner] = m;
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = key++;
    if (tag === 'strong') out.push(<strong key={k}>{inner}</strong>);
    else if (tag === 'em') out.push(<em key={k}>{inner}</em>);
    else if (tag === 'code') out.push(<code key={k}>{inner}</code>);
    else if (tag === 'store')
      out.push(
        <a
          key={k}
          href={CHROME_WEB_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {inner}
        </a>,
      );
    else if (tag === 'appstore')
      out.push(
        <a
          key={k}
          href={APP_STORE_URL ?? localizedPath(locale, '/ios-app')}
          target={APP_STORE_URL ? '_blank' : undefined}
          rel={APP_STORE_URL ? 'noopener noreferrer' : undefined}
        >
          {inner}
        </a>,
      );
    else out.push(<a key={k} href={localizedPath(locale, href ?? '')}>{inner}</a>);
    last = m.index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <Fragment>{out}</Fragment>;
}

/** The same string as plain text, for structured data and aria labels. */
export function stripInline(text: string): string {
  return text.replace(/<\/?[a-z]+(?: href="[^"]*")?>/g, '');
}
