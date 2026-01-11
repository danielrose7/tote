import { useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { co } from "jazz-tools";
import type { Block, JazzAccount } from "../../schema";
import {
  isPublished,
  isPublishedClone,
  publishCollection,
  unpublishCollection,
  generateCollectionInviteLink,
  type LoadedBlock,
  type SharingRole,
} from "../../lib/blocks";
import { useToast } from "../ToastNotification";
import styles from "./ShareCollectionDialog.module.css";

interface ShareCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: LoadedBlock;
  allBlocks: LoadedBlock[];
  account: co.loaded<typeof JazzAccount>;
}

export function ShareCollectionDialog({
  open,
  onOpenChange,
  collection,
  allBlocks,
  account,
}: ShareCollectionDialogProps) {
  const { showToast } = useToast();

  // Invite state
  const [selectedRole, setSelectedRole] = useState<SharingRole>("reader");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Publish state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishCopied, setPublishCopied] = useState(false);

  const published = isPublished(collection);
  const publishedId = collection.collectionData?.publishedId;
  const publishedAt = collection.collectionData?.publishedAt;

  // Don't show share dialog for published clones
  if (isPublishedClone(collection)) {
    return null;
  }

  const getPublicLink = () => {
    if (!publishedId) return null;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/view/${publishedId}`;
  };

  const handleGenerateInvite = useCallback(async () => {
    setIsGeneratingInvite(true);
    setInviteLink(null);

    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const link = generateCollectionInviteLink(collection, selectedRole, baseUrl);
      setInviteLink(link);

      showToast({
        title: "Invite link created",
        description: `Anyone with this link can ${selectedRole === "reader" ? "view" : selectedRole === "writer" ? "edit" : "manage"} this collection`,
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to generate invite:", error);
      showToast({
        title: "Failed to create invite",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setIsGeneratingInvite(false);
    }
  }, [collection, selectedRole, showToast]);

  const handleCopyInvite = useCallback(() => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    }
  }, [inviteLink]);

  const handlePublish = useCallback(async () => {
    setIsPublishing(true);
    try {
      const createdBlocks = publishCollection(collection, allBlocks, account);

      if (account.root?.blocks?.$isLoaded) {
        for (const block of createdBlocks) {
          account.root.blocks.$jazz.push(block);
        }
      }

      const publishedCollection = createdBlocks[0];
      await publishedCollection.$jazz.waitForSync({ timeout: 5000 });
      await collection.$jazz.waitForSync({ timeout: 5000 });

      showToast({
        title: "Collection published",
        description: "Anyone with the link can now view this collection",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to publish:", error);
      showToast({
        title: "Failed to publish",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setIsPublishing(false);
    }
  }, [collection, allBlocks, account, showToast]);

  const handleUnpublish = useCallback(() => {
    unpublishCollection(collection);
    showToast({
      title: "Collection unpublished",
      description: "The public link will no longer work",
      variant: "success",
    });
  }, [collection, showToast]);

  const handleCopyPublic = useCallback(() => {
    const link = getPublicLink();
    if (link) {
      navigator.clipboard.writeText(link);
      setPublishCopied(true);
      setTimeout(() => setPublishCopied(false), 2000);
    }
  }, [publishedId]);

  // Clear invite link when role changes
  const handleRoleChange = useCallback((role: SharingRole) => {
    setSelectedRole(role);
    setInviteLink(null);
  }, []);

  const publicLink = getPublicLink();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>
            Share Collection
          </Dialog.Title>
          <Dialog.Description className={styles.description}>
            Share <strong>{collection.name}</strong> with others
          </Dialog.Description>

          {/* Invite Collaborators Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Invite People</h3>
            <p className={styles.hint}>
              Invite collaborators to view or edit this collection. They'll need to sign in.
            </p>

            <div className={styles.roleSelector}>
              <label htmlFor="role-select" className={styles.roleLabel}>
                Permission
              </label>
              <select
                id="role-select"
                value={selectedRole}
                onChange={(e) => handleRoleChange(e.target.value as SharingRole)}
                className={styles.roleSelect}
              >
                <option value="reader">Can view</option>
                <option value="writer">Can edit</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {inviteLink ? (
              <div className={styles.linkBox}>
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className={styles.linkInput}
                />
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className={styles.copyButton}
                >
                  {inviteCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateInvite}
                disabled={isGeneratingInvite}
                className={styles.generateButton}
              >
                {isGeneratingInvite ? "Creating..." : "Create Invite Link"}
              </button>
            )}
          </div>

          {/* General Access / Public Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>General Access</h3>

            {published ? (
              <>
                <div className={styles.accessStatus}>
                  <span className={styles.accessIcon}>🌐</span>
                  <div className={styles.accessInfo}>
                    <span className={styles.accessLabel}>Anyone with the link</span>
                    <span className={styles.accessDescription}>can view</span>
                  </div>
                </div>

                {publicLink && (
                  <div className={styles.linkBox}>
                    <input
                      type="text"
                      value={publicLink}
                      readOnly
                      className={styles.linkInput}
                    />
                    <button
                      type="button"
                      onClick={handleCopyPublic}
                      className={styles.copyButton}
                    >
                      {publishCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}

                {publishedAt && (
                  <p className={styles.publishedAt}>
                    Published {new Date(publishedAt).toLocaleDateString()}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleUnpublish}
                  className={styles.unpublishButton}
                >
                  Make Private
                </button>
              </>
            ) : (
              <>
                <div className={styles.accessStatus}>
                  <span className={styles.accessIcon}>🔒</span>
                  <div className={styles.accessInfo}>
                    <span className={styles.accessLabel}>Restricted</span>
                    <span className={styles.accessDescription}>Only people with access can open</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className={styles.publishButton}
                >
                  {isPublishing ? "Publishing..." : "Make Public"}
                </button>
                <p className={styles.publishHint}>
                  Creates a public copy anyone can view without signing in.
                </p>
              </>
            )}
          </div>

          <div className={styles.actions}>
            <Dialog.Close asChild>
              <button type="button" className={styles.closeButton}>
                Done
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
