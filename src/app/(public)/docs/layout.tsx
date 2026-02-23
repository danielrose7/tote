"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./docs.module.css";

const navItems = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/collections", label: "Collections" },
  { href: "/docs/slots", label: "Slots" },
  { href: "/docs/adding-links", label: "Adding Links" },
  { href: "/docs/sharing", label: "Sharing" },
];

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.logo}>
            tote
          </Link>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.docsLabel}>Help</span>
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
