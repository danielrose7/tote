import type { Metadata } from "next";
import Link from "next/link";
import styles from "../docs/docs.module.css";

export const metadata: Metadata = {
  title: "Use Cases",
  description:
    "See how people use Tote to organize shopping — from holiday gift lists and home renovations to professional design sourcing.",
  alternates: { canonical: "/use-cases" },
  openGraph: {
    title: "Use Cases — Tote",
    description:
      "See how people use Tote to organize shopping — from holiday gift lists and home renovations to professional design sourcing.",
  },
};

function GiftIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="8" y="22" width="32" height="20" rx="3" fill="var(--card-accent)" opacity="0.4" />
      <rect x="6" y="16" width="36" height="8" rx="3" fill="var(--card-accent)" opacity="0.6" />
      <rect x="22" y="16" width="4" height="26" fill="var(--card-accent)" opacity="0.3" />
      <rect x="6" y="18" width="36" height="4" fill="var(--card-accent)" opacity="0.25" />
      <ellipse cx="19" cy="14" rx="6" ry="5" fill="var(--card-accent)" opacity="0.5" stroke="var(--card-accent)" strokeWidth="1.5" />
      <ellipse cx="29" cy="14" rx="6" ry="5" fill="var(--card-accent)" opacity="0.5" stroke="var(--card-accent)" strokeWidth="1.5" />
      <circle cx="24" cy="15" r="3" fill="var(--card-accent)" opacity="0.7" />
    </svg>
  );
}

function HouseIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 6 L42 22 L42 42 L6 42 L6 22 Z" fill="var(--card-accent)" opacity="0.5" />
      <rect x="14" y="16" width="8" height="8" rx="1" fill="var(--card-accent)" opacity="0.35" />
      <rect x="26" y="16" width="8" height="8" rx="1" fill="var(--card-accent)" opacity="0.35" />
      <rect x="14" y="28" width="8" height="8" rx="1" fill="var(--card-accent)" opacity="0.35" />
      <rect x="26" y="28" width="8" height="14" rx="1" fill="var(--card-accent)" opacity="0.6" />
    </svg>
  );
}

function HangerIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="10" r="4" fill="none" stroke="var(--card-accent)" strokeWidth="2.5" opacity="0.6" />
      <path d="M24 14 L24 18 L42 32 L42 36 L6 36 L6 32 L24 18" fill="var(--card-accent)" opacity="0.4" stroke="var(--card-accent)" strokeWidth="1.5" strokeOpacity="0.5" strokeLinejoin="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="18" cy="22" r="12" fill="var(--card-accent)" opacity="0.7" />
      <circle cx="30" cy="22" r="12" fill="var(--card-accent)" opacity="0.7" />
      <circle cx="18" cy="12" r="5" fill="var(--card-accent)" opacity="0.9" />
      <circle cx="30" cy="12" r="5" fill="var(--card-accent)" opacity="0.9" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="18" height="18" rx="3" fill="var(--card-accent)" opacity="0.8" />
      <rect x="26" y="4" width="18" height="18" rx="3" fill="var(--card-accent)" opacity="0.55" />
      <rect x="4" y="26" width="18" height="18" rx="3" fill="var(--card-accent)" opacity="0.55" />
      <rect x="26" y="26" width="18" height="18" rx="3" fill="var(--card-accent)" opacity="0.8" />
      <circle cx="13" cy="7" r="2" fill="var(--card-accent)" />
      <circle cx="35" cy="7" r="2" fill="var(--card-accent)" />
    </svg>
  );
}

const useCases = [
  {
    href: "/use-cases/gift-shopping",
    title: "Gift Lists & Wishlists",
    description:
      "Save gift ideas from any store, organize by occasion, and share with family so everyone knows what to get.",
    icon: GiftIcon,
    accent: "var(--color-lavender)",
  },
  {
    href: "/use-cases/home-renovation",
    title: "Home Renovation & Furnishing",
    description:
      "Organize furniture and materials room by room. Compare prices across stores and share boards with your partner or contractor.",
    icon: HouseIcon,
    accent: "var(--color-powder-blue)",
  },
  {
    href: "/use-cases/personal-style",
    title: "Wardrobe & Style Board",
    description:
      "Save clothes from any store into one style board. Organize by season, build capsule wardrobes, and watch for price drops.",
    icon: HangerIcon,
    accent: "var(--color-periwinkle)",
  },
  {
    href: "/use-cases/family-shopping",
    title: "Shared Family Shopping",
    description:
      "Save and compare options together. Stay on budget for back-to-school, new home furnishing, or any group project.",
    icon: PeopleIcon,
    accent: "var(--color-peach)",
  },
  {
    href: "/use-cases/professional-projects",
    title: "Professional Design & Client Projects",
    description:
      "Keep sourcing organized across clients. Share polished mood boards for approval and track budgets per project.",
    icon: GridIcon,
    accent: "var(--color-blush)",
  },
];

export default function UseCasesPage() {
  return (
    <article className={styles.article}>
      <h1>Use Cases</h1>
      <p className={styles.lead}>
        Tote saves products from any store into one place. Here&apos;s how people use it — from holiday gift lists to professional design sourcing.
      </p>

      {useCases.map((uc) => (
        <div key={uc.href} className={styles.card} style={{ "--card-accent": uc.accent } as React.CSSProperties}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>{uc.title}</h3>
            <uc.icon />
          </div>
          <p className={styles.cardDescription}>{uc.description}</p>
          <Link href={uc.href}>Learn more &rarr;</Link>
        </div>
      ))}
    </article>
  );
}
