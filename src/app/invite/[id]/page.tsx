"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAccount } from "jazz-tools/react";
import { SignInButton, useUser } from "@clerk/nextjs";
import { JazzAccount, Block, SharedCollectionRef, SharedWithMeList } from "../../../schema";
import { useToast } from "../../../components/ToastNotification";
import styles from "./page.module.css";

export default function InvitePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { isSignedIn, isLoaded: isUserLoaded } = useUser();

  const collectionId = params.id as string;
  const inviteSecret = searchParams.get("secret");
  const role = searchParams.get("role") || "reader";

  const [status, setStatus] = useState<"loading" | "accepting" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const me = useAccount(JazzAccount, {
    resolve: {
      root: {
        sharedWithMe: { $each: {} },
      },
    },
  });

  useEffect(() => {
    if (!isUserLoaded) return;

    // If not signed in, show sign in prompt
    if (!isSignedIn) {
      setStatus("loading");
      return;
    }

    // Need invite secret
    if (!inviteSecret) {
      setStatus("error");
      setErrorMessage("Invalid invite link - missing secret");
      return;
    }

    // Need account loaded
    if (!me.$isLoaded) {
      setStatus("loading");
      return;
    }

    // Accept the invite
    const acceptInvite = async () => {
      setStatus("accepting");

      try {
        // Use the account's acceptInvite method
        await me.acceptInvite(
          collectionId as `co_z${string}`,
          inviteSecret as `inviteSecret_z${string}`,
          Block
        );

        // Load the block to get its name
        const block = await Block.load(collectionId as `co_z${string}`, {});

        if (block && block.type === "collection") {
          // Add to SharedWithMe list
          if (me.root?.$isLoaded) {
            if (!me.root.sharedWithMe) {
              const sharedList = SharedWithMeList.create([], me);
              me.root.$jazz.set("sharedWithMe", sharedList);
            }

            // Check if already exists
            const existingRef = me.root.sharedWithMe?.find(
              (ref) => ref?.$isLoaded && ref.collectionId === collectionId
            );

            if (!existingRef) {
              const ref = SharedCollectionRef.create(
                {
                  collectionId: collectionId,
                  role: role as "reader" | "writer" | "admin",
                  sharedBy: "",
                  sharedAt: new Date(),
                  name: block.name,
                },
                me
              );
              me.root.sharedWithMe?.$jazz.push(ref);
            }
          }

          setStatus("success");
          showToast({
            title: "Invite accepted!",
            description: `You now have access to "${block.name}"`,
            variant: "success",
          });

          // Redirect to the collection
          setTimeout(() => {
            router.push(`/collections/${collectionId}`);
          }, 1500);
        } else {
          throw new Error("Could not load collection");
        }
      } catch (error) {
        console.error("Error accepting invite:", error);
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to accept invite"
        );
      }
    };

    acceptInvite();
  }, [isUserLoaded, isSignedIn, me.$isLoaded, collectionId, inviteSecret, role]);

  // Not signed in - show sign in prompt
  if (isUserLoaded && !isSignedIn) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.icon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className={styles.title}>You've been invited!</h1>
          <p className={styles.description}>
            Sign in to accept this collection invite and start collaborating.
          </p>
          <SignInButton mode="modal">
            <button className={styles.signInButton}>
              Sign in to continue
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  // Loading state
  if (status === "loading" || status === "accepting") {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>
            {status === "accepting" ? "Accepting invite..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorIcon}>!</div>
          <h1 className={styles.title}>Something went wrong</h1>
          <p className={styles.description}>{errorMessage}</p>
          <button
            className={styles.button}
            onClick={() => router.push("/collections")}
          >
            Go to Collections
          </button>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.successIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h1 className={styles.title}>Invite accepted!</h1>
        <p className={styles.description}>Redirecting to collection...</p>
      </div>
    </div>
  );
}
