"use client";

import { useEffect } from "react";
import { useAccount } from "jazz-tools/react";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { AuthButton } from "../AuthButton";
import { JazzAccount } from "../schema";
import styles from "./landing.module.css";

export default function HomePage() {
  const router = useRouter();

  const me = useAccount(JazzAccount, {
    resolve: {
      profile: true,
      root: {
        links: { $each: {} },
        collections: { $each: { links: { $each: {} } } }
      }
    },
  });

  const handleGetStarted = () => {
    if (me.$isLoaded && me.root?.$isLoaded && me.root.collections?.$isLoaded) {
      // Create default collection if none exists
      if (me.root.collections.length === 0) {
        const { Collection } = require("../schema");
        const defaultCollection = Collection.create(
          {
            name: "My Links",
            description: "Your personal collection of product links",
            color: "#6366f1",
            links: [],
            createdAt: new Date(),
          },
          me.$jazz,
        );
        me.root.collections.$jazz.push(defaultCollection);
        me.root.$jazz.set("defaultCollectionId", defaultCollection.$jazz.id);

        // Navigate to the new collection
        router.push(`/collections/${defaultCollection.$jazz.id}`);
      } else {
        // Navigate to first collection or default
        const targetCollection = me.root.defaultCollectionId
          ? me.root.collections.find(c => c?.$isLoaded && c.$jazz.id === me.root!.defaultCollectionId)
          : me.root.collections[0];

        if (targetCollection?.$isLoaded) {
          router.push(`/collections/${targetCollection.$jazz.id}`);
        }
      }
    }
  };


  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.logo}>tote</h1>
        <AuthButton />
      </div>
      <div className={styles.hero}>
        <h1 className={styles.title}>tote</h1>
        <p className={styles.tagline}>Your personal product wishlist</p>
        <p className={styles.description}>
          Save, organize, and track products you want to remember with beautiful collections and smart budgeting.
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
            <p className={styles.signInPrompt}>Sign in to get started</p>
          </SignedOut>
        </div>
      </div>
      <div className={styles.features}>
        <div className={styles.feature}>
          <h3>🎨 Beautiful Collections</h3>
          <p>Organize your product links into colorful collections</p>
        </div>
        <div className={styles.feature}>
          <h3>💰 Budget Planning</h3>
          <p>Track prices and plan your purchases</p>
        </div>
        <div className={styles.feature}>
          <h3>📱 Sync Everywhere</h3>
          <p>Access your lists from any device, always in sync</p>
        </div>
      </div>
    </div>
  );
}
