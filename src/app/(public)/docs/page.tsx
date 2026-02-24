import type { Metadata } from "next";
import Link from "next/link";
import styles from "./docs.module.css";

export const metadata: Metadata = {
  title: "Help Center — Tote",
  description:
    "Learn how to use Tote to save, organize, and track products from anywhere on the web. Guides for collections, slots, sharing, and the Chrome extension.",
  openGraph: {
    title: "Help Center — Tote",
    description:
      "Learn how to use Tote to save, organize, and track products from anywhere on the web.",
    url: "https://tote.tools/docs",
    siteName: "Tote",
  },
};

export default function DocsPage() {
  return (
    <article className={styles.article}>
      <h1>Help Center</h1>
      <p className={styles.lead}>
        Learn how to use Tote to save, organize, and track products from anywhere on the web.
      </p>

      <h2>Guides</h2>
      <p>
        Tote is a universal shopping cart that works across any online store. Save products with one click, organize them into collections, and track prices over time.
      </p>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Getting Started</h3>
        <p className={styles.cardDescription}>
          New to Tote? Sign up, install the extension, and save your first product in minutes.
        </p>
        <Link href="/docs/getting-started">Get started &rarr;</Link>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Collections</h3>
        <p className={styles.cardDescription}>
          Top-level folders for organizing your saved products by project, season, or any theme you choose.
        </p>
        <Link href="/docs/collections">Learn about collections &rarr;</Link>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Slots</h3>
        <p className={styles.cardDescription}>
          Optional groupings within a collection for more granular organization, like budget tiers or room categories.
        </p>
        <Link href="/docs/slots">Learn about slots &rarr;</Link>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Adding Links</h3>
        <p className={styles.cardDescription}>
          Save products using the browser extension or add links manually from any device.
        </p>
        <Link href="/docs/adding-links">Learn about adding links &rarr;</Link>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Chrome Extension</h3>
        <p className={styles.cardDescription}>
          Install and use the browser extension for one-click saving, right-click context menu, and more.
        </p>
        <Link href="/docs/extension">Learn about the extension &rarr;</Link>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Selections &amp; Budgets</h3>
        <p className={styles.cardDescription}>
          Mark favorite products, set selection limits, and track spending with collection and slot budgets.
        </p>
        <Link href="/docs/selections-and-budgets">Learn about selections &rarr;</Link>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Sharing</h3>
        <p className={styles.cardDescription}>
          Share collections with friends or family for collaborative wishlists and gift planning.
        </p>
        <Link href="/docs/sharing">Learn about sharing &rarr;</Link>
      </div>
    </article>
  );
}
