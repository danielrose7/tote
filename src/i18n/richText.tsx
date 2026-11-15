import { Fragment, type ReactNode } from 'react';

/**
 * Renders a catalog string containing one `<link>…</link>` span, for server
 * components (react-i18next's <Trans> needs React context, which they don't
 * have). The translator keeps the tag; word order around it is theirs to
 * choose.
 */
export function withLink(
  text: string,
  render: (children: string) => ReactNode,
): ReactNode {
  const match = text.match(/^([\s\S]*?)<link>([\s\S]*?)<\/link>([\s\S]*)$/);
  if (!match) return text;
  const [, before, inner, after] = match;
  return (
    <Fragment>
      {before}
      {render(inner)}
      {after}
    </Fragment>
  );
}
