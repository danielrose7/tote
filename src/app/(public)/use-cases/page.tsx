import type { Metadata } from "next";
import Link from "next/link";
import styles from "../docs/docs.module.css";

export const metadata: Metadata = {
  title: "Use Cases",
  description:
    "Discover how people use Tote to organize shopping for gifts, home renovations, wardrobes, family projects, and professional sourcing.",
  alternates: { canonical: "/use-cases" },
  openGraph: {
    title: "Use Cases — Tote",
    description:
      "Discover how people use Tote to organize shopping for gifts, home renovations, wardrobes, family projects, and professional sourcing.",
  },
};

function GiftIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="6" y="22" width="36" height="20" rx="4" fill="var(--color-blush)" />
      <rect x="10" y="14" width="28" height="10" rx="3" fill="var(--color-lavender)" />
      <rect x="21" y="14" width="6" height="28" rx="1" fill="var(--color-lavender)" opacity="0.6" />
      <path d="M24 14 C24 14 18 8 14 10 C10 12 14 16 24 14" fill="var(--color-blush)" stroke="var(--color-navy)" strokeWidth="1" opacity="0.7" />
      <path d="M24 14 C24 14 30 8 34 10 C38 12 34 16 24 14" fill="var(--color-blush)" stroke="var(--color-navy)" strokeWidth="1" opacity="0.7" />
    </svg>
  );
}

function HouseIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 6 L42 22 L42 42 L6 42 L6 22 Z" fill="var(--color-powder-blue)" />
      <rect x="14" y="16" width="8" height="8" rx="1" fill="var(--color-peach)" opacity="0.8" />
      <rect x="26" y="16" width="8" height="8" rx="1" fill="var(--color-peach)" opacity="0.8" />
      <rect x="14" y="28" width="8" height="8" rx="1" fill="var(--color-peach)" opacity="0.8" />
      <rect x="26" y="28" width="8" height="14" rx="1" fill="var(--color-peach)" />
    </svg>
  );
}

function HangerIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="10" r="4" fill="none" stroke="var(--color-periwinkle)" strokeWidth="2.5" />
      <path d="M24 14 L24 18 L42 32 L42 36 L6 36 L6 32 L24 18" fill="var(--color-lavender)" stroke="var(--color-periwinkle)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="18" cy="20" r="12" fill="var(--color-peach)" opacity="0.9" />
      <circle cx="30" cy="20" r="12" fill="var(--color-blush)" opacity="0.9" />
      <circle cx="18" cy="12" r="5" fill="var(--color-peach)" />
      <circle cx="30" cy="12" r="5" fill="var(--color-blush)" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className={styles.cardIcon} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="18" height="18" rx="3" fill="var(--color-periwinkle)" />
      <rect x="26" y="4" width="18" height="18" rx="3" fill="var(--color-powder-blue)" />
      <rect x="4" y="26" width="18" height="18" rx="3" fill="var(--color-powder-blue)" />
      <rect x="26" y="26" width="18" height="18" rx="3" fill="var(--color-periwinkle)" />
      <circle cx="13" cy="7" r="2" fill="var(--color-navy)" opacity="0.3" />
      <circle cx="35" cy="7" r="2" fill="var(--color-navy)" opacity="0.3" />
    </svg>
  );
}

const useCases = [
  {
    href: "/use-cases/gift-shopping",
    title: "Gift Lists & Wishlists",
    description:
      "Build wishlists for birthdays, holidays, and special occasions. Share them with family so everyone knows what to get.",
    icon: GiftIcon,
  },
  {
    href: "/use-cases/home-renovation",
    title: "Home Renovation & Furnishing",
    description:
      "Organize furniture and materials room by room. Track prices across stores and share boards with your partner or contractor.",
    icon: HouseIcon,
  },
  {
    href: "/use-cases/personal-style",
    title: "Wardrobe & Style Board",
    description:
      "Curate seasonal wardrobes and capsule collections. Save clothes from any store and watch for sales.",
    icon: HangerIcon,
  },
  {
    href: "/use-cases/family-shopping",
    title: "Shared Family Shopping",
    description:
      "Shop together with your partner or family. One shared board for back-to-school, new home furnishing, or any group project.",
    icon: PeopleIcon,
  },
  {
    href: "/use-cases/professional-projects",
    title: "Professional Design & Client Projects",
    description:
      "Manage sourcing across multiple clients. Share curated mood boards for approval and track budgets per project.",
    icon: GridIcon,
  },
];

export default function UseCasesPage() {
  return (
    <article className={styles.article}>
      <h1>Use Cases</h1>
      <p className={styles.lead}>
        Tote is a free cross-store shopping organizer. Here&apos;s how people use it to solve real shopping problems — from holiday gift lists to professional interior design sourcing.
      </p>

      {useCases.map((uc) => (
        <div key={uc.href} className={styles.card}>
          <div className={styles.cardWithIcon}>
            <uc.icon />
            <div className={styles.cardIconBody}>
              <h3 className={styles.cardTitle}>{uc.title}</h3>
              <p className={styles.cardDescription}>{uc.description}</p>
              <Link href={uc.href}>Learn more &rarr;</Link>
            </div>
          </div>
        </div>
      ))}
    </article>
  );
}
