"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { SignInButton, SignUpButton, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { useAccount, useCoState } from "jazz-tools/react";
import { Block as BlockSchema, BlockList, JazzAccount } from "../../../../schema";
import { duplicateCollectionToAccount } from "../../../../lib/blocks";
import styles from "../../../(public)/view/[id]/page.module.css";

export default function CloneCollectionPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn, isLoaded: isUserLoaded } = useUser();
  const collectionId = params.id as string;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  const me = useAccount(JazzAccount, {
    resolve: {
      root: {
        blocks: true,
      },
    },
  });

  const sourceCollection = useCoState(BlockSchema, collectionId as `co_z${string}`, {
    resolve: {
      children: {
        $each: {
          children: { $each: {} },
        },
      },
    },
  });

  useEffect(() => {
    if (!isUserLoaded || !isSignedIn || hasStartedRef.current) return;
    if (!me.$isLoaded || !me.root?.$isLoaded) return;
    if (!sourceCollection || !sourceCollection.$isLoaded) return;

    if (sourceCollection.type !== "collection") {
      setErrorMessage("This item cannot be copied.");
      return;
    }

    if (sourceCollection.collectionData?.allowCloning !== true) {
      setErrorMessage("Copying is disabled for this collection.");
      return;
    }

    hasStartedRef.current = true;

    const run = async () => {
      try {
        const duplicatedCollection = duplicateCollectionToAccount(sourceCollection, me);

        if (!me.root.blocks) {
          const blocksList = BlockList.create([duplicatedCollection], me);
          me.root.$jazz.set("blocks", blocksList);
        } else if (me.root.blocks.$isLoaded) {
          me.root.blocks.$jazz.push(duplicatedCollection);
        }

        await duplicatedCollection.$jazz.waitForSync({ timeout: 5000 });
        router.replace(`/collections/${duplicatedCollection.$jazz.id}`);
      } catch (error) {
        console.error("Failed to clone collection:", error);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to copy this collection."
        );
      }
    };

    run();
  }, [isSignedIn, isUserLoaded, me, sourceCollection, router]);

  if (!isUserLoaded) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Preparing your copy...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Use this list</h1>
          <p className={styles.description}>
            Sign in or create an account to copy this collection into your own Tote.
          </p>
          <div className={styles.templateActions} style={{ marginTop: "1rem", width: "100%" }}>
            <SignUpButton mode="modal" fallbackRedirectUrl={`/clone/${collectionId}`}>
              <button type="button" className={styles.useListButton}>
                Sign up to copy
              </button>
            </SignUpButton>
          </div>
          <p className={styles.templateHint} style={{ marginTop: "0.75rem" }}>
            Already have an account?{" "}
            <SignInButton mode="modal" fallbackRedirectUrl={`/clone/${collectionId}`}>
              <button type="button" className={styles.inlineAuthButton}>
                Log in
              </button>
            </SignInButton>
          </p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorIcon}>!</div>
          <h1 className={styles.title}>Unable to copy</h1>
          <p className={styles.description}>{errorMessage}</p>
          <div style={{ marginTop: "1rem" }}>
            <SignedIn>
              <Link href="/collections" className={styles.footerLink}>
                Back to collections
              </Link>
            </SignedIn>
            <SignedOut>
              <Link href="/" className={styles.footerLink}>
                Back to home
              </Link>
            </SignedOut>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Copying this list into your account...</p>
      </div>
    </div>
  );
}
