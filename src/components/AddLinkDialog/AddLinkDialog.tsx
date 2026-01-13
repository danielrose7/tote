import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import type { JazzAccount, Block } from "../../schema.ts";
import type { co } from "jazz-tools";
import { Group } from "jazz-tools";
import { fetchMetadata, isValidUrl } from "../../app/utils/metadata";
import { Block as BlockSchema, BlockList } from "../../schema";
import { useToast } from "../ToastNotification";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useAllCollections } from "../../hooks/useAllCollections";
import { SlotSelector } from "../SlotSelector/SlotSelector";
import styles from "./AddLinkDialog.module.css";

type LoadedBlock = co.loaded<typeof Block>;

interface AddLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: co.loaded<typeof JazzAccount>;
  collectionId?: string; // Optional collection block ID to default to
  collection?: LoadedBlock; // Optional pre-loaded collection (for shared collections)
}

const validationSchema = Yup.object({
  url: Yup.string()
    .required("URL is required")
    .test("is-url", "Please enter a valid URL (must start with http:// or https://)", isValidUrl),
});

export function AddLinkDialog({
  open,
  onOpenChange,
  account,
  collectionId,
  collection,
}: AddLinkDialogProps) {
  const { showToast } = useToast();
  const isOnline = useOnlineStatus();
  const [isLoading, setIsLoading] = useState(false);
  // Track newly created slots to ensure they're available immediately
  const [createdSlots, setCreatedSlots] = useState<LoadedBlock[]>([]);

  // Get all collections (owned + shared)
  const { collections, findCollection } = useAllCollections(account, {
    sharedCollections: collection ? [collection] : [],
  });

  // Default to the provided collection ID, or the account's default block
  const defaultCollectionId = collectionId || (account.root?.$isLoaded ? account.root.defaultBlockId || null : null);

  const formik = useFormik({
    initialValues: {
      url: "",
      collectionId: defaultCollectionId || "",
      slotId: null as string | null,
    },
    validationSchema,
    onSubmit: async (values) => {
      if (!account.root || !account.root.$isLoaded) return;
      if (!values.collectionId || !account.root.blocks?.$isLoaded) return;

      if (!isOnline) {
        formik.setFieldError(
          "url",
          "You're offline. Connect to the internet to add links.",
        );
        return;
      }

      setIsLoading(true);

      try {
        const metadata = await fetchMetadata(values.url);

        // Find the collection block to get its name and sharing group
        const collectionBlock = findCollection(values.collectionId);

        if (!collectionBlock) {
          throw new Error("Collection not found");
        }

        // Get the collection's sharing group for proper ownership
        let ownerGroup: Group | null = null;
        const sharingGroupId = collectionBlock?.collectionData?.sharingGroupId;
        if (sharingGroupId) {
          ownerGroup = await Group.load(sharingGroupId as `co_z${string}`, {});
        }

        // Create the product block owned by the group
        const newProductBlock = BlockSchema.create(
          {
            type: "product",
            name: metadata.title || "Untitled",
            productData: {
              url: metadata.url,
              imageUrl: metadata.imageUrl,
              price: metadata.price,
              description: metadata.description,
            },
            createdAt: new Date(),
          },
          ownerGroup ? { owner: ownerGroup } : account.$jazz,
        );

        // Add to the appropriate parent's children list
        if (values.slotId) {
          // Find the slot and add to its children
          const slotBlock = collectionBlock.children?.find(
            (b) => b && b.$isLoaded && b.$jazz.id === values.slotId
          );
          if (slotBlock?.children?.$isLoaded) {
            slotBlock.children.$jazz.push(newProductBlock);
          }
        } else {
          // Add directly to collection's children
          if (collectionBlock.children?.$isLoaded) {
            collectionBlock.children.$jazz.push(newProductBlock);
          }
        }

        showToast({
          title: "Link added",
          description: `"${metadata.title || "Link"}" has been added to ${collectionBlock.name}`,
          variant: "success",
        });

        handleClose();
      } catch (error) {
        console.error("Error adding link:", error);
        formik.setFieldError(
          "url",
          "Failed to fetch link details. Please try again.",
        );
      } finally {
        setIsLoading(false);
      }
    },
  });

  const handleClose = () => {
    formik.resetForm({
      values: {
        url: "",
        collectionId: defaultCollectionId || "",
        slotId: null,
      },
    });
    setCreatedSlots([]); // Clear created slots on close
    onOpenChange(false);
  };

  // Get slots for the currently selected collection (including newly created ones)
  const getSlotsForSelectedCollection = (): LoadedBlock[] => {
    if (!formik.values.collectionId) return [];

    // Get slots from the collection's children (works for both owned and shared)
    const collectionBlock = findCollection(formik.values.collectionId);
    const existingSlots: LoadedBlock[] = [];
    if (collectionBlock?.children?.$isLoaded) {
      for (const child of collectionBlock.children) {
        if (child && child.$isLoaded && child.type === "slot") {
          existingSlots.push(child);
        }
      }
    }

    // Merge in any newly created slots that might not be in the children list yet
    const existingIds = new Set(existingSlots.map(s => s.$jazz.id));
    const newSlots = createdSlots.filter(s => !existingIds.has(s.$jazz.id));
    return [...existingSlots, ...newSlots];
  };

  // Create a new slot in the selected collection
  const handleCreateSlot = async (name: string): Promise<string> => {
    // Find the collection to get its sharing group
    const collectionBlock = findCollection(formik.values.collectionId);

    if (!collectionBlock?.children?.$isLoaded) {
      throw new Error("Collection children not loaded");
    }

    // Get the collection's sharing group for proper ownership
    let ownerGroup: Group | null = null;
    const sharingGroupId = collectionBlock?.collectionData?.sharingGroupId;
    if (sharingGroupId) {
      ownerGroup = await Group.load(sharingGroupId as `co_z${string}`, {});
    }

    // Create empty children list for the slot
    const slotChildren = BlockList.create(
      [],
      ownerGroup ? { owner: ownerGroup } : account.$jazz
    );

    const newSlot = BlockSchema.create(
      {
        type: "slot",
        name,
        slotData: {
          maxSelections: 1,
        },
        children: slotChildren,
        createdAt: new Date(),
      },
      ownerGroup ? { owner: ownerGroup } : account.$jazz,
    );

    // Add slot to collection's children
    collectionBlock.children.$jazz.push(newSlot);
    // Track the new slot locally to ensure it's immediately available
    setCreatedSlots(prev => [...prev, newSlot as LoadedBlock]);
    return newSlot.$jazz.id;
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>Add Product Link</Dialog.Title>
          <Dialog.Description className={styles.description}>
            Enter a product URL to save it to your collection
          </Dialog.Description>

          <form onSubmit={formik.handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="url" className={styles.label}>
                Product URL
              </label>
              <input
                id="url"
                name="url"
                type="url"
                value={formik.values.url}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="https://example.com/product"
                className={styles.input}
                disabled={isLoading}
                autoFocus
              />
              {formik.touched.url && formik.errors.url && (
                <div className={styles.error}>{formik.errors.url}</div>
              )}
            </div>

            {/* Collection Selector */}
            {collections.length > 0 && (
              <div className={styles.inputGroup}>
                <label htmlFor="collectionId" className={styles.label}>
                  Collection
                </label>
                <select
                  id="collectionId"
                  name="collectionId"
                  value={formik.values.collectionId}
                  onChange={(e) => {
                    formik.handleChange(e);
                    // Clear slot when collection changes
                    formik.setFieldValue("slotId", null);
                  }}
                  onBlur={formik.handleBlur}
                  className={styles.select}
                  disabled={isLoading}
                >
                  {collections.map((block) => (
                    <option key={block.$jazz.id} value={block.$jazz.id}>
                      {block.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Slot Selector */}
            {formik.values.collectionId && (
              <div className={styles.inputGroup}>
                <label className={styles.label}>
                  Slot <span className={styles.optional}>(optional)</span>
                </label>
                <SlotSelector
                  value={formik.values.slotId}
                  onChange={(slotId) => formik.setFieldValue("slotId", slotId)}
                  slots={getSlotsForSelectedCollection()}
                  onCreateSlot={handleCreateSlot}
                  placeholder="Add to slot (optional)"
                  disabled={isLoading}
                />
              </div>
            )}

            <div className={styles.actions}>
              <Dialog.Close asChild>
                <button type="button" className={styles.cancelButton} disabled={isLoading}>
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className={styles.saveButton}
                disabled={isLoading || !formik.values.url || !formik.values.collectionId}
              >
                {isLoading ? "Adding..." : "Add Link"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
