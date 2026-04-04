import type { Metadata } from "next";
import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import heroImage from "../../product-images-01.png";
import collectionImage from "../../product-images-02.png";
import { LandingAuthButtons } from "../../components/LandingAuthButtons";
import { CHROME_WEB_STORE_URL } from "../../lib/constants";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Save from any store. Decide in one place.",
  description:
    "Save products from any store, compare options in one place, refresh prices later, and keep the budget and shortlist moving.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Tote — Save from any store. Decide in one place.",
    description:
      "Save from any store, compare in one place, and move from scattered links to a clear shortlist.",
  },
};

const sourceStores = [
  "IKEA",
  "Wayfair",
  "Home Depot",
  "Zara",
  "Nike",
  "Madhappy",
  "Gardenheir",
  "Grace Rose Farm",
  "Anthropologie",
  "Etsy",
  "eBay",
  "Depop",
  "REI",
  "Patagonia",
  "Mammut",
  "Sephora",
  "Ulta",
  "Best Buy",
  "Target",
  "Article",
  "Magnolia",
  "Schoolhouse",
  "Food52",
  "West Elm",
  "Terrain",
  "Maisonette",
  "SSENSE",
  "The Sill",
  "Benjamin Moore",
  "Sherwin-Williams",
  "GE Appliances",
  "Cafe",
  "Bosch",
];

const sourceCategories = [
  "Major retailers",
  "Indie shops",
  "Anywhere online",
];

const questions = [
  {
    question: "Why not just use bookmarks or notes?",
    answer:
      "Bookmarks and notes help you save a link. Tote helps you come back later with images, pricing, collections, and a shortlist that still makes sense.",
  },
  {
    question: "Does Tote only work with big retailers?",
    answer:
      "No. Tote works across major retailers, resale sites, indie shops, and the rest of the web wherever you shop online.",
  },
  {
    question: "Can I come back later when I’m ready to decide?",
    answer:
      "That’s the point. Save now, revisit later, refresh prices when it matters, and keep the decision moving in one place.",
  },
  {
    question: "Is Tote private?",
    answer:
      "Yes. No ads, no tracking, and no selling your shopping behavior. Sharing is opt-in, and your saved links stay useful offline.",
  },
];

const principles = [
  {
    title: "Keep every option in one place",
    description:
      "You save across stores, marketplaces, and brand sites. Tote keeps the options together instead of scattering them across tabs and wishlists.",
  },
  {
    title: "Organize by the decision you’re making",
    description:
      "You organize by room, person, season, client, or event, so the collection still makes sense when you come back later.",
  },
  {
    title: "Refresh prices before you decide",
    description:
      "You can come back later and update what you saved, so you’re looking at current pricing before you buy, share, or choose.",
  },
  {
    title: "Keep the budget and shortlist together",
    description:
      "You track what makes the shortlist, set limits, and keep a running total in the same place the decision is happening.",
  },
  {
    title: "Private by design",
    description:
      "No ads. No tracking. No selling your shopping habits. Sharing is opt-in, and your saved links stay useful even when you’re offline.",
  },
];

const useCases = [
  {
    href: "/use-cases/gift-shopping",
    title: "Gift lists & wishlists",
    description:
      "Keep gift ideas from every store in one list, then share a clean board instead of forwarding a pile of links.",
    tags: ["Occasions", "Holidays", "Registries"],
    accent: "var(--color-lavender)",
  },
  {
    href: "/use-cases/home-renovation",
    title: "Home renovation",
    description:
      "Save furniture, fixtures, and materials room by room. Compare options, track budgets, and keep the shortlist clear.",
    tags: ["Rooms", "Budgets", "Approvals"],
    accent: "var(--color-powder-blue)",
  },
  {
    href: "/use-cases/personal-style",
    title: "Wardrobe & style",
    description:
      "Build a style board across boutiques, resale sites, and brand stores. Keep everything together by season or look.",
    tags: ["Capsules", "Seasonal", "Sales"],
    accent: "var(--color-periwinkle)",
  },
  {
    href: "/use-cases/family-shopping",
    title: "Family shopping",
    description:
      "Keep shared projects out of the group chat. Compare options together, track totals, and make decisions without duplicate links.",
    tags: ["Shared lists", "Budgets", "Decisions"],
    accent: "var(--color-peach)",
  },
  {
    href: "/use-cases/professional-projects",
    title: "Client sourcing",
    description:
      "Organize sourcing boards for clients, refresh pricing before reviews, and share boards people can actually open.",
    tags: ["Designers", "Stylists", "Client work"],
    accent: "var(--color-blush)",
  },
];

const audiences = [
  {
    title: "For people who compare",
    description:
      "You research, compare, and collect ideas over time. Tote gives those saved links a real home.",
  },
  {
    title: "For couples and families",
    description:
      "Keep shared projects out of the group chat. Compare options together, agree on picks, and stay inside the budget.",
    },
  {
    title: "For stylists and designers",
    description:
      "Turn scattered sourcing into boards that feel presentable, current, and easy to approve.",
  },
  {
    title: "For anyone tired of spreadsheets",
    description:
      "Still flexible, but visual. Still organized, but far less manual. Tote keeps structure, shortlists, and totals without the busywork.",
  },
];

const comparisonColumns = [
  { key: "spreadsheets", label: "Spreadsheets" },
  { key: "wishlists", label: "Store wishlists" },
  { key: "groupChats", label: "Group chats" },
  { key: "bookmarks", label: "Bookmarks" },
  { key: "tote", label: "Tote", highlight: true },
] as const;

const comparisonRows = [
  {
    feature: "Easy to save a link fast",
    values: {
      bookmarks: true,
      wishlists: true,
      spreadsheets: false,
      groupChats: true,
      tote: true,
    },
  },
  {
    feature: "Works across stores",
    values: {
      bookmarks: false,
      wishlists: false,
      spreadsheets: true,
      groupChats: false,
      tote: true,
    },
  },
  {
    feature: "Refresh pricing later",
    values: {
      bookmarks: false,
      wishlists: false,
      spreadsheets: false,
      groupChats: false,
      tote: true,
    },
  },
  {
    feature: "Budgets built in",
    values: {
      bookmarks: false,
      wishlists: false,
      spreadsheets: true,
      groupChats: false,
      tote: true,
    },
  },
  {
    feature: "Selections and shortlists",
    values: {
      bookmarks: false,
      wishlists: false,
      spreadsheets: false,
      groupChats: false,
      tote: true,
    },
  },
  {
    feature: "Easy to share with someone else",
    values: {
      bookmarks: false,
      wishlists: true,
      spreadsheets: false,
      groupChats: true,
      tote: true,
    },
  },
  {
    feature: "Private by design + offline",
    values: {
      bookmarks: true,
      wishlists: false,
      spreadsheets: false,
      groupChats: false,
      tote: true,
    },
  },
];

const footerGroups = [
  {
    title: "Use cases",
    links: [
      { href: "/use-cases/gift-shopping", label: "Gift lists & wishlists" },
      { href: "/use-cases/home-renovation", label: "Home renovation" },
      { href: "/use-cases/personal-style", label: "Wardrobe & style" },
      { href: "/use-cases/family-shopping", label: "Family shopping" },
      { href: "/use-cases/professional-projects", label: "Client sourcing" },
    ],
  },
  {
    title: "Why Tote",
    links: [
      { href: "#comparison", label: "Tote vs bookmarks" },
      { href: "#comparison", label: "Tote vs store wishlists" },
      { href: "#comparison", label: "Tote vs spreadsheets" },
      { href: "#privacy", label: "Private by design" },
    ],
  },
  {
    title: "Product",
    links: [
      { href: "/docs", label: "Help docs" },
      { href: "/docs/getting-started", label: "Getting started" },
      { href: "/privacy", label: "Privacy" },
      { href: CHROME_WEB_STORE_URL, label: "Chrome extension", external: true },
    ],
  },
];

export default function HomePage() {
  return (
    <div className={styles.page}>
      <div className={styles.backgroundGlow} aria-hidden="true" />

      <header className={styles.header}>
        <nav className={styles.nav}>
          <Link href="/" className={styles.wordmark}>tote</Link>
          <div className={`${styles.navLinks} ${styles.desktopOnly}`}>
            <a href="#use-cases" className={styles.navLink}>Use cases</a>
            <a href="#audiences" className={styles.navLink}>Who it&apos;s for</a>
            <a href="#comparison" className={styles.navLink}>Why Tote</a>
            <Link href="/docs" className={styles.navLink}>Docs</Link>
          </div>
          <div className={`${styles.navActions} ${styles.desktopOnly}`}>
            <a
              href={CHROME_WEB_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.chromeLink}
            >
              Add to Chrome
            </a>
            <LandingAuthButtons />
          </div>
          <details className={styles.mobileMenu}>
            <summary className={styles.mobileMenuButton} aria-label="Open menu">
              <span className={styles.mobileMenuIcon} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </summary>
            <div className={styles.mobileMenuPanel}>
              <div className={styles.mobileMenuLinks}>
                <a href="#use-cases" className={styles.mobileMenuLink}>Use cases</a>
                <a href="#audiences" className={styles.mobileMenuLink}>Who it&apos;s for</a>
                <a href="#comparison" className={styles.mobileMenuLink}>Why Tote</a>
                <Link href="/docs" className={styles.mobileMenuLink}>Docs</Link>
              </div>
              <div className={styles.mobileMenuActions}>
                <a
                  href={CHROME_WEB_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.mobileChromeLink}
                >
                  Add to Chrome
                </a>
                <div className={styles.mobileMenuAuth}>
                  <LandingAuthButtons />
                </div>
              </div>
            </div>
          </details>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>A cart that doesn&apos;t belong to a store</p>
            <h1 className={styles.heroTitle}>Save anything you might buy — from any store.</h1>
            <p className={styles.heroSubtitle}>
              Organize it once. Revisit it when you&apos;re ready to decide.
            </p>
            <div className={styles.heroActions}>
              <LandingAuthButtons
                showSignIn={false}
                signUpLabel="Save your first item"
                signedInLabel="Save your next item"
              />
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.secondaryButton}
              >
                Add to Chrome
              </a>
            </div>
            <p className={styles.heroNote}>
              Save what you find now. Come back with fewer tabs, a clearer budget, and a shortlist you can actually use.
            </p>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.floatingBadgeTop}>One collection across every store</div>
            <div className={styles.floatingBadgeBottom}>Refresh prices, track budgets, and narrow the shortlist</div>
            <div className={styles.heroCard}>
              <Image
                src={heroImage}
                alt="Tote browser extension saving a product from a store page"
                priority
                className={styles.heroImage}
              />
            </div>
          </div>
        </section>

        <section className={styles.sourceSection} aria-labelledby="source-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>Save from anywhere</p>
            <h2 id="source-heading" className={styles.sectionTitle}>
              Big retailers, indie shops, and the rest of the internet.
            </h2>
            <p className={styles.sectionBody}>
              If you can shop it online, you can save it to Tote.
            </p>
          </div>
          <div className={styles.sourceCategories}>
            {sourceCategories.map((category) => (
              <span key={category} className={styles.sourceCategory}>{category}</span>
            ))}
          </div>
          <div className={styles.sourcePills}>
            {sourceStores.map((store) => (
              <span key={store} className={styles.sourcePill}>{store}</span>
            ))}
          </div>
        </section>

        <section id="use-cases" className={styles.showcaseSection}>
          <div className={styles.showcaseCopy}>
            <p className={styles.sectionLabel}>Use cases</p>
            <h2 className={styles.sectionTitle}>One place to compare, shortlist, and decide.</h2>
            <p className={styles.sectionBody}>
              When a project spans five stores, saving links is the easy part. Keeping them useful
              later is harder. Tote gives you one place to compare, share, and decide.
            </p>
            <div className={styles.useCaseGrid}>
              {useCases.map((useCase) => (
                <Link
                  key={useCase.href}
                  href={useCase.href}
                  className={styles.useCaseCard}
                  style={{ "--use-case-accent": useCase.accent } as React.CSSProperties}
                >
                  <div className={styles.useCaseTags}>
                    {useCase.tags.map((tag) => (
                      <span key={tag} className={styles.useCaseTag}>{tag}</span>
                    ))}
                  </div>
                  <h3>{useCase.title}</h3>
                  <p>{useCase.description}</p>
                  <span className={styles.inlineCta}>Explore use case</span>
                </Link>
              ))}
            </div>
          </div>

          <div className={styles.showcaseVisual}>
            <div className={styles.collectionFrame}>
              <Image
                src={collectionImage}
                alt="A Tote collection showing saved products with prices"
                className={styles.collectionImage}
              />
            </div>
            <div className={styles.checklistCard}>
              <p className={styles.checklistTitle}>What Tote keeps together</p>
              <ul className={styles.checklist}>
                <li>Products from different stores</li>
                <li>Pricing you can refresh later</li>
                <li>Collections for every project</li>
                <li>Budgets and selections that keep decisions moving</li>
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.principlesSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>Why people switch</p>
            <h2 className={styles.sectionTitle}>
              Built for the messy middle between finding something and buying it.
            </h2>
          </div>
          <div className={styles.principlesGrid}>
            {principles.map((principle) => (
              <article key={principle.title} className={styles.principleCard}>
                <h3>{principle.title}</h3>
                <p>{principle.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="comparison" className={styles.comparisonSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>Us vs. the usual workaround</p>
            <h2 className={styles.sectionTitle}>Most tools help you save. Tote helps you finish the decision.</h2>
            <p className={styles.sectionBody}>
              Bookmarks, store wishlists, spreadsheets, and group chats each help with one piece of
              the job. Tote keeps the options, price checks, budget, shortlist, and sharing in the
              same place.
            </p>
          </div>
          <div className={styles.comparisonScroller}>
            <div className={styles.comparisonMatrix}>
              <div className={`${styles.matrixCell} ${styles.matrixCorner}`} aria-hidden="true" />
              {comparisonColumns.map((column) => (
                <div
                  key={column.key}
                  className={`${styles.matrixCell} ${styles.matrixHeader} ${column.highlight ? styles.matrixHeaderHighlight : ""}`}
                >
                  {column.label}
                </div>
              ))}

              {comparisonRows.map((row) => (
                <Fragment key={row.feature}>
                  <div className={`${styles.matrixCell} ${styles.matrixFeature}`}>{row.feature}</div>
                  {comparisonColumns.map((column) => {
                    const value = row.values[column.key];
                    return (
                      <div
                        key={column.key}
                        className={`${styles.matrixCell} ${styles.matrixValue} ${column.highlight ? styles.matrixValueHighlight : ""}`}
                        aria-label={`${column.label}: ${value ? "included" : "not included"}`}
                      >
                        <span className={value ? styles.matrixCheck : styles.matrixOmission}>
                          {value ? "✓" : "—"}
                        </span>
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </section>

        <section id="audiences" className={styles.audienceSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>Who it&apos;s for</p>
            <h2 className={styles.sectionTitle}>Built for the way you save before you buy.</h2>
          </div>
          <div className={styles.audienceGrid}>
            {audiences.map((audience) => (
              <article key={audience.title} className={styles.audienceCard}>
                <h3>{audience.title}</h3>
                <p>{audience.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.questionsSection}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>Questions</p>
            <h2 className={styles.sectionTitle}>What people usually want to know first.</h2>
          </div>
          <div className={styles.questionsGrid}>
            {questions.map((item) => (
              <article key={item.question} className={styles.questionCard}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="privacy" className={styles.privacySection}>
          <div className={styles.privacyPanel}>
            <p className={styles.sectionLabel}>Private by design</p>
            <h2 className={styles.sectionTitle}>Tote respects the fact that your shopping life is yours.</h2>
            <p className={styles.sectionBody}>
              No tracking, no ads, and no selling your behavior to someone else. Save privately,
              share when you choose, and keep your saved links useful even when you&apos;re offline.
            </p>
          </div>
        </section>

        <section className={styles.finalCta}>
          <p className={styles.sectionLabel}>Start here</p>
          <h2 className={styles.finalTitle}>From scattered links to a clear shortlist.</h2>
          <p className={styles.finalBody}>
            Use Tote the next time you start a gift list, plan a room, save outfit ideas, or source
            options for someone else.
          </p>
          <div className={styles.heroActions}>
            <LandingAuthButtons
              showSignIn={false}
              signUpLabel="Save your first item"
              signedInLabel="Save your next item"
            />
            <a
              href={CHROME_WEB_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.secondaryButton}
            >
              Add to Chrome
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <span className={styles.wordmark}>tote</span>
            <p>
              Save from any store. Organize in one place. Built for people who save now and decide
              later.
            </p>
          </div>

          <div className={styles.footerGroups}>
            {footerGroups.map((group) => (
              <div key={group.title} className={styles.footerGroup}>
                <h3>{group.title}</h3>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
                      ) : (
                        <Link href={link.href}>{link.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footerBottom}>
          <span>&copy; {new Date().getFullYear()} Tote</span>
          <a
            href="https://gobloom.io"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.mountainLink}
          >
            Made in Silverton, CO
          </a>
        </div>
      </footer>
    </div>
  );
}
