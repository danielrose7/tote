"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../docs/docs.module.css";

const navItems = [
  { href: "/use-cases", label: "Overview" },
  { href: "/use-cases/gift-shopping", label: "Gift Lists & Wishlists" },
  { href: "/use-cases/home-renovation", label: "Home Renovation" },
  { href: "/use-cases/personal-style", label: "Wardrobe & Style" },
  { href: "/use-cases/family-shopping", label: "Family Shopping" },
  { href: "/use-cases/professional-projects", label: "Professional Projects" },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Tote Use Cases",
  url: "https://tote.tools/use-cases",
  description:
    "Discover how people use Tote to organize shopping for gifts, home renovations, wardrobes, family projects, and professional sourcing.",
  publisher: {
    "@type": "Organization",
    name: "Tote",
    url: "https://tote.tools",
  },
};

export default function UseCasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.container}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.logo}>
            tote
          </Link>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.docsLabel}>Use Cases</span>
        </div>
        <button
          className={styles.menuToggle}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
        <Link href="/collections" className={styles.backLink}>
          Back to app
        </Link>
      </header>

      <div className={styles.main}>
        <aside className={`${styles.sidebar} ${menuOpen ? styles.open : ""}`}>
          <nav className={styles.sidebarNav}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${
                  pathname === item.href ? styles.navItemActive : ""
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
