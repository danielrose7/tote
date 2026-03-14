import { useState, useCallback, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { co } from "jazz-tools";
import { Group } from "jazz-tools";
import { useUser } from "@clerk/nextjs";
import type { Block, JazzAccount } from "../../schema";
import {
  isPublished,
  isPublishedClone,
  publishCollection,
  unpublishCollection,
  republishCollection,
  syncPublishedCollectionToClerk,
  removePublishedCollectionFromClerk,
  generateCollectionInviteLink,
  type LoadedBlock,
  type SharingRole,
} from "../../lib/blocks";
import { slugify } from "../../lib/slugify";
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
  const { user: clerkUser } = useUser();
  const username = clerkUser?.username;

  // Invite state
  const [selectedRole, setSelectedRole] = useState<SharingRole>("reader");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Publish state
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRepublishing, setIsRepublishing] = useState(false);
  const [publishCopied, setPublishCopied] = useState(false);

  // Slug editing state
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [isSavingSlug, setIsSavingSlug] = useState(false);

  const published = isPublished(collection);
  const publishedId = collection.collectionData?.publishedId;
  const publishedAt = collection.collectionData?.publishedAt;
  const currentSlug = collection.collectionData?.slug;

  // Initialize slug input when dialog opens or slug changes
  useEffect(() => {
    if (currentSlug) {
      setSlugInput(currentSlug);
    } else {
      setSlugInput(slugify(collection.name));
    }
  }, [currentSlug, collection.name]);

  // Don't show share dialog for published clones
  if (isPublishedClone(collection)) {
    return null;
  }

  const getFriendlyLink = () => {
    if (!published || !currentSlug || !username) return null;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/s/${username}/${currentSlug}`;
  };

  const getFallbackLink = () => {
    if (!publishedId) return null;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/view/${publishedId}`;
  };

  const getPublicLink = () => {
    return getFriendlyLink() || getFallbackLink();
  };

  const handleGenerateInvite = useCallback(async () => {
    setIsGeneratingInvite(true);
    setInviteLink(null);

    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const link = generateCollectionInviteLink(collection, selectedRole, baseUrl);

      const sharingGroupId = collection.collectionData?.sharingGroupId;
      if (sharingGroupId) {
        const group = await Group.load(sharingGroupId as `co_z${string}`, {});
        if (group) {
          await group.$jazz.waitForSync({ timeout: 10000 });
        }
      }

      await collection.$jazz.waitForSync({ timeout: 10000 });

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

      const publishedCollection = createdBlocks[0];
      if (account.root?.blocks?.$isLoaded) {
        account.root.blocks.$jazz.push(publishedCollection);
      }

      await publishedCollection.$jazz.waitForSync({ timeout: 5000 });
      await collection.$jazz.waitForSync({ timeout: 5000 });

      // Sync slug to Clerk metadata for friendly URL resolution
      const slug = collection.collectionData?.slug;
      const pubId = collection.collectionData?.publishedId;
      if (slug && pubId) {
        syncPublishedCollectionToClerk(slug, pubId).catch(console.error);
      }

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

  const handleRepublish = useCallback(async () => {
    if (!account.root?.blocks?.$isLoaded) return;

    setIsRepublishing(true);
    try {
      const freshBlocks: LoadedBlock[] = [];
      for (const block of account.root.blocks) {
        if (block && block.$isLoaded) {
          freshBlocks.push(block);
        }
      }

      const createdChildBlocks = republishCollection(
        collection,
        freshBlocks,
        account,
        account.root.blocks
      );

      await collection.$jazz.waitForSync({ timeout: 5000 });

      for (const block of createdChildBlocks) {
        await block.$jazz.waitForSync({ timeout: 5000 });
      }

      showToast({
        title: "Collection updated",
        description: "The public version has been updated with your changes",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to republish:", error);
      showToast({
        title: "Failed to update",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setIsRepublishing(false);
    }
  }, [collection, account, showToast]);

  const handleCopyPublic = useCallback(() => {
    const link = getPublicLink();
    if (link) {
      navigator.clipboard.writeText(link);
      setPublishCopied(true);
      setTimeout(() => setPublishCopied(false), 2000);
    }
  }, [publishedId, currentSlug, username]);

  const handleSaveSlug = useCallback(async () => {
    const newSlug = slugify(slugInput);
    if (!newSlug || newSlug === currentSlug) {
      setEditingSlug(false);
      return;
    }

    setIsSavingSlug(true);
    try {
      const oldSlug = currentSlug;

      // Update slug on the collection
      collection.$jazz.set("collectionData", {
        ...collection.collectionData,
        slug: newSlug,
      });

      await collection.$jazz.waitForSync({ timeout: 5000 });

      // Update Clerk metadata: remove old, add new
      if (oldSlug) {
        removePublishedCollectionFromClerk(oldSlug).catch(console.error);
      }
      if (publishedId) {
        syncPublishedCollectionToClerk(newSlug, publishedId).catch(
          console.error
        );
      }

      setSlugInput(newSlug);
      setEditingSlug(false);

      showToast({
        title: "URL updated",
        description: "Your share link has been updated",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to update slug:", error);
      showToast({
        title: "Failed to update URL",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setIsSavingSlug(false);
    }
  }, [slugInput, currentSlug, publishedId, collection, showToast]);

  // Clear invite link when role changes
  const handleRoleChange = useCallback((role: SharingRole) => {
    setSelectedRole(role);
    setInviteLink(null);
  }, []);

  const publicLink = getPublicLink();
  const friendlyLink = getFriendlyLink();

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

                {/* Slug editor */}
                {username && (
                  <div className={styles.slugSection}>
                    {editingSlug ? (
                      <div className={styles.slugEditor}>
                        <span className={styles.slugPrefix}>
                          /s/{username}/
                        </span>
                        <input
                          type="text"
                          value={slugInput}
                          onChange={(e) => setSlugInput(e.target.value)}
                          className={styles.slugInput}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveSlug();
                            if (e.key === "Escape") {
                              setEditingSlug(false);
                              setSlugInput(currentSlug || slugify(collection.name));
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleSaveSlug}
                          disabled={isSavingSlug}
                          className={styles.slugSaveButton}
                        >
                          {isSavingSlug ? "Saving..." : "Save"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingSlug(true)}
                        className={styles.slugEditButton}
                      >
                        Edit URL slug
                      </button>
                    )}
                  </div>
                )}

                {!username && published && (
                  <p className={styles.slugHint}>
                    Set a username in Settings to get a friendly share link.
                  </p>
                )}

                {publishedAt && (
                  <p className={styles.publishedAt}>
                    Published {new Date(publishedAt).toLocaleDateString()}
                  </p>
                )}

                <div className={styles.publishActions}>
                  <button
                    type="button"
                    onClick={handleRepublish}
                    disabled={isRepublishing}
                    className={styles.updateButton}
                  >
                    {isRepublishing ? "Updating..." : "Update Public Version"}
                  </button>
                  <button
                    type="button"
                    onClick={handleUnpublish}
                    className={styles.unpublishButton}
                  >
                    Make Private
                  </button>
                </div>
                <p className={styles.publishHint}>
                  Update pushes your latest changes to the public version.
                </p>
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
