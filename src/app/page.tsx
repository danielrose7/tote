"use client";

import { useAccount } from "jazz-tools/react";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Group } from "jazz-tools";
import { AuthButton } from "../AuthButton";
import { JazzAccount, Block, BlockList } from "../schema";
import styles from "./landing.module.css";

export default function HomePage() {
  const router = useRouter();

  const me = useAccount(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        blocks: { $each: {} }
      }
    },
  });

  const handleGetStarted = () => {
    if (!me.$isLoaded || !me.root?.$isLoaded) return;

    // Get collection blocks
    const blocks = me.root.blocks;
    const collectionBlocks = blocks?.$isLoaded
      ? Array.from(blocks).filter(b => b?.$isLoaded && b.type === "collection" && !b.parentId)
      : [];

    if (collectionBlocks.length === 0) {
      // Create a Group for this collection to enable sharing
      const ownerGroup = Group.create({ owner: me });
      ownerGroup.addMember(me, "admin");

      // Create default collection if none exists, owned by the group
      const defaultCollection = Block.create(
        {
          type: "collection",
          name: "My Links",
          collectionData: {
            description: "Your personal collection of product links",
            color: "#6366f1",
            viewMode: "grid",
            sharingGroupId: ownerGroup.$jazz.id,
          },
          createdAt: new Date(),
        },
        { owner: ownerGroup },
      );

      if (!me.root.blocks) {
        const blocksList = BlockList.create([defaultCollection], me);
        me.root.$jazz.set("blocks", blocksList);
      } else if (me.root.blocks.$isLoaded) {
        me.root.blocks.$jazz.push(defaultCollection);
      }
      me.root.$jazz.set("defaultBlockId", defaultCollection.$jazz.id);

      // Navigate to the new collection
      router.push(`/collections/${defaultCollection.$jazz.id}`);
    } else {
      // Navigate to first collection or default
      const targetCollection = me.root.defaultBlockId
        ? collectionBlocks.find(c => c.$jazz.id === me.root!.defaultBlockId)
        : collectionBlocks[0];

      if (targetCollection) {
        router.push(`/collections/${targetCollection.$jazz.id}`);
      } else {
        router.push("/collections");
      }
    }
  };


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
          <AuthButton variant="landing" />
        </nav>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.title}>
          A cart that doesn't<br />belong to a store
        </h1>
        <p className={styles.subtitle}>
          Tote keeps your saved products in one place, wherever you shop
        </p>
        <div className={styles.cta}>
          <SignedIn>
            <button
              className={styles.primaryButton}
              onClick={handleGetStarted}
              disabled={!me.$isLoaded}
            >
              {me.$isLoaded ? 'Get Started' : 'Loading...'}
            </button>
          </SignedIn>
          <SignedOut>
            <AuthButton />
          </SignedOut>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className={styles.section}>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={styles.stepNumber}>1</span>
            <h3>Save with one click</h3>
            <p>Use our browser extension to save any product page instantly. No copying URLs or filling out forms.</p>
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

      {/* Feature: Collections */}
      <section id="features" className={styles.section}>
        <div className={styles.featureBlock}>
          <svg className={styles.featureGraphic} viewBox="0 0 200 200" aria-hidden="true">
            <rect x="20" y="40" width="70" height="90" rx="8" className={styles.shapeBlush} />
            <rect x="50" y="60" width="70" height="90" rx="8" className={styles.shapeLavender} />
            <rect x="80" y="80" width="70" height="90" rx="8" className={styles.shapePeriwinkle} />
          </svg>
          <div className={styles.featureContent}>
            <h2 className={styles.featureTitle}>Organize your way</h2>
            <p className={styles.featureDescription}>
              Create collections for different projects, seasons, or goals.
              Whether it's a home renovation, gift ideas, or your personal style board—keep
              everything sorted exactly how you think about it.
            </p>
          </div>
        </div>
      </section>

      {/* Feature: Price tracking */}
      <section className={styles.section}>
        <div className={styles.featureBlock}>
          <svg className={styles.featureGraphic} viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r="60" className={styles.shapePeach} />
            <path d="M70 100 L90 120 L130 80" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" className={styles.shapeCheck} />
          </svg>
          <div className={styles.featureContent}>
            <h2 className={styles.featureTitle}>Prices that stay up to date</h2>
            <p className={styles.featureDescription}>
              Refresh your saved products to see current prices.
              Know when something goes on sale or sells out—so you
              can act at the right moment.
            </p>
          </div>
        </div>
      </section>

      {/* Feature: Privacy */}
      <section className={styles.section}>
        <div className={styles.featureBlock}>
          <svg className={styles.featureGraphic} viewBox="0 0 200 200" aria-hidden="true">
            <path d="M100 30 L160 60 L160 110 C160 150 100 180 100 180 C100 180 40 150 40 110 L40 60 Z" className={styles.shapePowder} />
            <circle cx="100" cy="100" r="20" className={styles.shapeWhite} />
          </svg>
          <div className={styles.featureContent}>
            <h2 className={styles.featureTitle}>Your data stays yours</h2>
            <p className={styles.featureDescription}>
              No tracking, no ads, no selling your shopping habits.
              Tote is built for you, not advertisers. Your data is
              private and syncs securely across your devices.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.finalCta}>
        <h2 className={styles.finalCtaTitle}>Ready to stop shopping in spreadsheets?</h2>
        <p className={styles.finalCtaSubtitle}>Try Tote today. It's free to get started.</p>
        <div className={styles.cta}>
          <SignedIn>
            <button
              className={styles.primaryButton}
              onClick={handleGetStarted}
              disabled={!me.$isLoaded}
            >
              {me.$isLoaded ? 'Open Tote' : 'Loading...'}
            </button>
          </SignedIn>
          <SignedOut>
            <AuthButton variant="landing" />
          </SignedOut>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <span className={styles.footerLogo}>tote</span>
          <nav className={styles.footerLinks}>
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <span>&copy; {new Date().getFullYear()} Tote</span>
        </div>
      </footer>
    </div>
  );
}
