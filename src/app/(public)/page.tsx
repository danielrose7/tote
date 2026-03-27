import type { Metadata } from "next";
import Link from "next/link";
import { LandingAuthButtons } from "../../components/LandingAuthButtons";
import { CHROME_WEB_STORE_URL } from "../../lib/constants";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "A cart that doesn't belong to a store",
  description:
    "Save products from any online store in one place. Organize with collections, track prices, and share wishlists — all with complete privacy.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Tote — A cart that doesn't belong to a store",
    description:
      "Save products from any online store in one place. Organize with collections, track prices, and share wishlists.",
  },
};

const useCases = [
  {
    href: "/use-cases/gift-shopping",
    title: "Gift Lists & Wishlists",
    description: "Save gift ideas from any store, organized by occasion, ready to share.",
    accent: "var(--color-lavender)",
  },
  {
    href: "/use-cases/home-renovation",
    title: "Home Renovation",
    description: "Organize furniture and materials room by room. Compare prices across stores.",
    accent: "var(--color-powder-blue)",
  },
  {
    href: "/use-cases/personal-style",
    title: "Wardrobe & Style",
    description: "Save clothes from any store into one style board. Watch for price drops.",
    accent: "var(--color-periwinkle)",
  },
  {
    href: "/use-cases/family-shopping",
    title: "Family Shopping",
    description: "Save and compare options together for back-to-school, new home, and more.",
    accent: "var(--color-peach)",
  },
];

const featureCallouts = [
  {
    title: "Organize your way",
    description: "Collections for any project, season, or goal.",
    accent: "var(--color-blush)",
  },
  {
    title: "Prices that update",
    description: "Refresh any saved product to see the current price.",
    accent: "var(--color-peach)",
  },
  {
    title: "Private by design",
    description: "No tracking, no ads, no selling your shopping habits.",
    accent: "var(--color-powder-blue)",
  },
];

export default function HomePage() {
  return (
    <div className={styles.container}>
      {/* Gradient blobs */}
      <div className={styles.gradients} aria-hidden="true">
        <div className={styles.gradient1} />
        <div className={styles.gradient2} />
        <div className={styles.gradient3} />
        <div className={styles.gradient4} />
      </div>

      <header className={styles.header}>
        <nav className={styles.nav}>
          <span className={styles.logo}>tote</span>
          <span className={styles.divider} aria-hidden="true" />
          <div className={styles.navLinks}>
            <a href="#how-it-works" className={styles.navLink}>How it works</a>
            <a href="#features" className={styles.navLink}>Features</a>
          </div>
          <LandingAuthButtons />
        </nav>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.title}>
          A cart that doesn't<br />belong to a store
        </h1>
        <p className={styles.subtitle}>
          Save anything from any store. One place to find it when you're ready to buy.
        </p>
        <div className={styles.cta}>
          <LandingAuthButtons />
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

      {/* How it works */}
      <section id="how-it-works" className={styles.section}>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={styles.stepNumber}>1</span>
            <h3>Save with one click</h3>
            <p><a href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer" className={styles.inlineLink}>Install the browser extension</a> to save any product page instantly. No copying URLs or filling out forms.</p>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>2</span>
            <h3>Stay organized</h3>
            <p>Products are automatically organized with images, prices, and details. Group them into collections.</p>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>3</span>
            <h3>Come back anytime</h3>
            <p>Your saved products sync across all your devices. Find that perfect item when you're ready to buy.</p>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="features" className={styles.section}>
        <h2 className={styles.sectionTitle}>Built for how you actually shop</h2>
        <div className={styles.useCaseGrid}>
          {useCases.map((uc) => (
            <Link
              key={uc.href}
              href={uc.href}
              className={styles.useCaseCard}
              style={{ "--uc-accent": uc.accent } as React.CSSProperties}
            >
              <h3 className={styles.useCaseTitle}>{uc.title}</h3>
              <p className={styles.useCaseDesc}>{uc.description}</p>
              <span className={styles.useCaseLink}>Learn more →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Feature callouts */}
      <section className={styles.section}>
        <div className={styles.featureCallouts}>
          {featureCallouts.map((f) => (
            <div
              key={f.title}
              className={styles.featureCallout}
              style={{ "--fc-accent": f.accent } as React.CSSProperties}
            >
              <div className={styles.featureCalloutAccent} aria-hidden="true" />
              <h3 className={styles.featureCalloutTitle}>{f.title}</h3>
              <p className={styles.featureCalloutDesc}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.finalCta}>
        <h2 className={styles.finalCtaTitle}>Ready to stop shopping in spreadsheets?</h2>
        <p className={styles.finalCtaSubtitle}>Try Tote today. It's free to get started.</p>
        <div className={styles.cta}>
          <LandingAuthButtons />
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <span className={styles.footerCopyright}>&copy; {new Date().getFullYear()} Tote</span>
          <a
            href="https://gobloom.io"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.mountainLink}
          >
            <span className={styles.mountainLabel}>Made in Silverton, CO</span>
          </a>
          <nav className={styles.footerLinks}>
            <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer">Chrome Extension</a>
            <a href="/privacy">Privacy</a>
            <a href="/use-cases">Use Cases</a>
            <a href="/docs">Help</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
