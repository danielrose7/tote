"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClerkProvider, useClerk, useUser } from "@clerk/nextjs";
import { JazzReactProviderWithClerk, useAcceptInvite, useAccount } from "jazz-tools/react";
import { JazzAccount, Block, SharedCollectionRef, SharedWithMeList } from "../schema";
import { ToastProvider, useToast } from "../components/ToastNotification";
import { OfflineBanner } from "../components/OfflineBanner";
import { JazzInspector } from "jazz-tools/inspector";
import { apiKey } from "../apiKey";

/** Global invite handler - accepts invites from any page */
function InviteHandler() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isSignedIn, isLoaded: isUserLoaded } = useUser();
  const [hasProcessed, setHasProcessed] = useState(false);

  const me = useAccount(JazzAccount, {
    resolve: {
      root: {
        sharedWithMe: { $each: {} },
      },
    },
  });

  useAcceptInvite({
    invitedObjectSchema: Block,
    onAccept: async (sharedBlockId) => {
      // Prevent duplicate processing
      if (hasProcessed) return;

      // Wait for user state to be known
      if (!isUserLoaded) return;

      // If not signed in, don't process - they need to sign in first
      // The hash will remain so it can be processed after sign-in
      if (!isSignedIn) {
        return;
      }

      setHasProcessed(true);

      try {
        const block = await Block.load(sharedBlockId as `co_z${string}`, {});

        if (block && block.type === "collection") {
          // Add to SharedWithMe list
          if (me.$isLoaded && me.root?.$isLoaded) {
            if (!me.root.sharedWithMe) {
              const sharedList = SharedWithMeList.create([], me);
              me.root.$jazz.set("sharedWithMe", sharedList);
            }

            const existingRef = me.root.sharedWithMe?.find(
              (ref) => ref?.$isLoaded && ref.collectionId === sharedBlockId
            );

            if (!existingRef) {
              const ref = SharedCollectionRef.create(
                {
                  collectionId: sharedBlockId,
                  role: "reader",
                  sharedBy: "",
                  sharedAt: new Date(),
                  name: block.name,
                },
                me
              );
              me.root.sharedWithMe?.$jazz.push(ref);
            }
          }

          showToast({
            title: "Invite accepted!",
            description: `You now have access to "${block.name}"`,
            variant: "success",
          });

          // Clear the hash before redirecting to prevent re-processing
          window.history.replaceState(null, "", window.location.pathname);

          router.push(`/collections/${sharedBlockId}`);
        }
      } catch (error) {
        console.error("Error accepting invite:", error);
        showToast({
          title: "Failed to accept invite",
          description: "Something went wrong",
          variant: "error",
        });
      }
    },
  });

  return null;
}

function JazzProvider({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();

  return (
    <JazzReactProviderWithClerk
      clerk={clerk}
      AccountSchema={JazzAccount}
      sync={{
        peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
      }}
    >
      <ToastProvider>
        <InviteHandler />
        <OfflineBanner />
        {children}
        <JazzInspector />
      </ToastProvider>
    </JazzReactProviderWithClerk>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <JazzProvider>{children}</JazzProvider>
    </ClerkProvider>
  );
}
