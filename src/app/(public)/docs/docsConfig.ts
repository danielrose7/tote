/** The help-center pages, in sidebar order. Prose: `docs` catalog area;
 * block structure (headings, lists, tips) and anchor ids: `structure.json`. */
export const DOC_SLUGS = [
  'getting-started',
  'collections',
  'slots',
  'adding-links',
  'extension',
  'ios-app',
  'selections-and-budgets',
  'sharing',
] as const;

export type DocSlug = (typeof DOC_SLUGS)[number];

export function isDocSlug(slug: string): slug is DocSlug {
  return (DOC_SLUGS as readonly string[]).includes(slug);
}
