import styles from '@/app/(public)/docs/docs.module.css';

// Decorative hero art for each use-case page; no text, so nothing to translate.

function GiftShoppingHero() {
  return (
    <div className={styles.heroIllustration} aria-hidden="true">
      <svg viewBox="0 0 160 160">
        <rect
          x="30"
          y="65"
          width="100"
          height="70"
          rx="8"
          fill="var(--color-lavender)"
          opacity="0.4"
        />
        <rect
          x="25"
          y="55"
          width="110"
          height="16"
          rx="4"
          fill="var(--color-lavender)"
          opacity="0.6"
        />
        <rect
          x="72"
          y="55"
          width="16"
          height="80"
          rx="2"
          fill="var(--color-lavender)"
          opacity="0.3"
        />
        <rect
          x="25"
          y="60"
          width="110"
          height="6"
          fill="var(--color-lavender)"
          opacity="0.25"
        />
        <ellipse
          cx="65"
          cy="48"
          rx="18"
          ry="15"
          fill="var(--color-lavender)"
          opacity="0.5"
          stroke="var(--color-lavender)"
          strokeWidth="2"
        />
        <ellipse
          cx="95"
          cy="48"
          rx="18"
          ry="15"
          fill="var(--color-lavender)"
          opacity="0.5"
          stroke="var(--color-lavender)"
          strokeWidth="2"
        />
        <circle
          cx="80"
          cy="50"
          r="8"
          fill="var(--color-lavender)"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}

function HomeRenovationHero() {
  return (
    <div className={styles.heroIllustration} aria-hidden="true">
      <svg viewBox="0 0 160 160">
        <path
          d="M80 20 L140 60 L140 140 L20 140 L20 60 Z"
          fill="var(--color-powder-blue)"
          opacity="0.5"
        />
        <rect
          x="40"
          y="65"
          width="25"
          height="25"
          rx="2"
          fill="var(--color-powder-blue)"
          opacity="0.35"
        />
        <rect
          x="95"
          y="65"
          width="25"
          height="25"
          rx="2"
          fill="var(--color-powder-blue)"
          opacity="0.35"
        />
        <rect
          x="40"
          y="100"
          width="25"
          height="25"
          rx="2"
          fill="var(--color-powder-blue)"
          opacity="0.35"
        />
        <rect
          x="60"
          y="100"
          width="40"
          height="40"
          rx="3"
          fill="var(--color-powder-blue)"
          opacity="0.6"
        />
      </svg>
    </div>
  );
}

function PersonalStyleHero() {
  return (
    <div className={styles.heroIllustration} aria-hidden="true">
      <svg viewBox="0 0 160 160">
        <circle
          cx="80"
          cy="18"
          r="8"
          fill="none"
          stroke="var(--color-periwinkle)"
          strokeWidth="3"
          opacity="0.6"
        />
        <path
          d="M80 26 L80 42 L120 70 L120 78 L40 78 L40 70 L80 42"
          fill="var(--color-periwinkle)"
          opacity="0.4"
          stroke="var(--color-periwinkle)"
          strokeWidth="2"
          strokeOpacity="0.5"
          strokeLinejoin="round"
        />
        <path
          d="M60 78 L55 140 L105 140 L100 78"
          fill="var(--color-periwinkle)"
          opacity="0.3"
        />
        <ellipse
          cx="80"
          cy="140"
          rx="30"
          ry="4"
          fill="var(--color-periwinkle)"
          opacity="0.2"
        />
      </svg>
    </div>
  );
}

function FamilyShoppingHero() {
  return (
    <div className={styles.heroIllustration} aria-hidden="true">
      <svg viewBox="0 0 160 160">
        <circle
          cx="60"
          cy="90"
          r="35"
          fill="var(--color-peach)"
          opacity="0.7"
        />
        <circle
          cx="100"
          cy="90"
          r="35"
          fill="var(--color-peach)"
          opacity="0.7"
        />
        <circle
          cx="60"
          cy="55"
          r="14"
          fill="var(--color-peach)"
          opacity="0.9"
        />
        <circle
          cx="100"
          cy="55"
          r="14"
          fill="var(--color-peach)"
          opacity="0.9"
        />
      </svg>
    </div>
  );
}

function ProfessionalProjectsHero() {
  return (
    <div className={styles.heroIllustration} aria-hidden="true">
      <svg viewBox="0 0 160 160">
        <rect
          x="10"
          y="10"
          width="60"
          height="60"
          rx="6"
          fill="var(--color-blush)"
          opacity="0.8"
        />
        <rect
          x="80"
          y="10"
          width="60"
          height="60"
          rx="6"
          fill="var(--color-blush)"
          opacity="0.55"
        />
        <rect
          x="10"
          y="80"
          width="60"
          height="60"
          rx="6"
          fill="var(--color-blush)"
          opacity="0.55"
        />
        <rect
          x="80"
          y="80"
          width="60"
          height="60"
          rx="6"
          fill="var(--color-blush)"
          opacity="0.8"
        />
        <circle cx="30" cy="18" r="5" fill="var(--color-blush)" />
        <circle cx="100" cy="18" r="5" fill="var(--color-blush)" />
        <circle cx="30" cy="88" r="5" fill="var(--color-blush)" />
        <circle cx="100" cy="88" r="5" fill="var(--color-blush)" />
      </svg>
    </div>
  );
}

export const HEROES: Record<string, () => React.JSX.Element> = {
  'gift-shopping': GiftShoppingHero,
  'home-renovation': HomeRenovationHero,
  'personal-style': PersonalStyleHero,
  'family-shopping': FamilyShoppingHero,
  'professional-projects': ProfessionalProjectsHero,
};
