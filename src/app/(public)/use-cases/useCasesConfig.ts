/**
 * Everything about the use-case pages that is not prose. The words live in the
 * `useCases` catalog area; this is the structure around them (which pages
 * exist, their accent color, which public collections they link to, and which
 * other use cases they point at).
 */
export const USE_CASE_SLUGS = [
  'gift-shopping',
  'home-renovation',
  'personal-style',
  'family-shopping',
  'professional-projects',
] as const;

export type UseCaseSlug = (typeof USE_CASE_SLUGS)[number];

export function isUseCaseSlug(slug: string): slug is UseCaseSlug {
  return (USE_CASE_SLUGS as readonly string[]).includes(slug);
}

type PublicCollection = { title: string; href: string };

export const USE_CASES: Record<
  UseCaseSlug,
  {
    accent: string;
    /** Public collections, in the same order as `collections.descriptions`.
     * Titles are the collections' own names (user content), so not translated. */
    collections: PublicCollection[];
    /** Other use cases to link to, in order. Blurbs: `related.<slug>`. */
    related: UseCaseSlug[];
  }
> = {
  'gift-shopping': {
    accent: 'var(--color-lavender)',
    collections: [
      {
        title: 'Baby shower gifts for the person actually having the baby',
        href: '/s/daniel/baby-shower-gifts-for-the-person-actually-having-the-baby',
      },
      {
        title: 'Kitchen gifts worth giving a regular home cook',
        href: '/s/daniel/kitchen-gifts-worth-giving-a-regular-home-cook',
      },
      {
        title: 'Practical gifts for a grandmother who visits the baby',
        href: '/s/daniel/practical-gifts-for-a-grandmother-who-visits-the-baby',
      },
    ],
    related: ['family-shopping', 'home-renovation', 'personal-style'],
  },
  'home-renovation': {
    accent: 'var(--color-powder-blue)',
    collections: [
      {
        title: "The considered gardener's kit",
        href: '/s/daniel/the-considered-gardeners-kit',
      },
      {
        title: 'A Montessori nursery for the first three months',
        href: '/s/daniel/a-montessori-nursery-for-the-first-three-months',
      },
      {
        title: 'Baby gear that earns its floor space',
        href: '/s/daniel/baby-gear-that-earns-its-floor-space',
      },
    ],
    related: ['family-shopping', 'professional-projects', 'gift-shopping'],
  },
  'personal-style': {
    accent: 'var(--color-periwinkle)',
    collections: [
      {
        title: 'US-made everyday rotation, supply-chain honest',
        href: '/s/daniel/us-made-everyday-rotation-supply-chain-honest',
      },
    ],
    related: ['gift-shopping', 'home-renovation', 'professional-projects'],
  },
  'family-shopping': {
    accent: 'var(--color-peach)',
    collections: [
      {
        title: 'A starter registry built to last past the newborn stage',
        href: '/s/daniel/a-starter-registry-built-to-last-past-the-newborn-stage',
      },
      {
        title: 'Baby gear that earns its floor space',
        href: '/s/daniel/baby-gear-that-earns-its-floor-space',
      },
      {
        title: 'Wood and open shelves: screen-free toys',
        href: '/s/daniel/wood-and-open-shelves-awesome-screen-free-toys',
      },
    ],
    related: ['gift-shopping', 'home-renovation', 'personal-style'],
  },
  'professional-projects': {
    accent: 'var(--color-blush)',
    collections: [
      {
        title: 'A Montessori nursery for the first three months',
        href: '/s/daniel/a-montessori-nursery-for-the-first-three-months',
      },
      {
        title: "The considered gardener's kit",
        href: '/s/daniel/the-considered-gardeners-kit',
      },
      {
        title: 'Kitchen gifts worth giving a regular home cook',
        href: '/s/daniel/kitchen-gifts-worth-giving-a-regular-home-cook',
      },
    ],
    related: ['home-renovation', 'personal-style', 'family-shopping'],
  },
};
