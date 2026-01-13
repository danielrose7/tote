import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import type { Block, JazzAccount } from "../../schema.ts";
import { Block as BlockSchema, BlockList } from "../../schema.ts";
import type { co } from "jazz-tools";
import { Group } from "jazz-tools";
import { SlotSelector } from "../SlotSelector/SlotSelector";
import { getSlotsForCollection } from "../../lib/slotHelpers";
import styles from "./EditLinkDialog.module.css";

type LoadedBlock = co.loaded<typeof Block>;

interface EditLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: LoadedBlock | null;
  account?: co.loaded<typeof JazzAccount>;
}

const validationSchema = Yup.object({
  title: Yup.string(),
  description: Yup.string(),
  notes: Yup.string(),
  price: Yup.string(),
});

export function EditLinkDialog({
  open,
  onOpenChange,
  block,
  account,
}: EditLinkDialogProps) {
  const productData = block?.productData;
  // Track newly created slots to ensure they're available immediately
  const [createdSlots, setCreatedSlots] = useState<LoadedBlock[]>([]);

  // Get all loaded blocks
  const getAllBlocks = (): LoadedBlock[] => {
    if (!account?.root?.blocks?.$isLoaded) return [];
    const blocks: LoadedBlock[] = [];
    for (const b of account.root.blocks) {
      if (b && b.$isLoaded) {
        blocks.push(b);
      }
    }
    return blocks;
  };

  // Find the collection ID for this product (could be direct parent or via slot)
  // Searches both parentId (legacy) and children lists (new pattern)
  const getCollectionId = (): string | null => {
    if (!block) return null;
    const allBlocks = getAllBlocks();
    const blockId = block.$jazz.id;

    // Try legacy parentId approach first
    if (block.parentId) {
      const parent = allBlocks.find((b) => b.$jazz.id === block.parentId);
      if (parent) {
        if (parent.type === "collection") {
          return parent.$jazz.id;
        } else if (parent.type === "slot" && parent.parentId) {
          return parent.parentId;
        }
      }
    }

    // Search through children lists (new pattern)
    for (const col of allBlocks.filter((b) => b.type === "collection")) {
      // Check if product is directly in collection's children
      if (col.children?.$isLoaded) {
        for (const child of col.children) {
          if (child && child.$isLoaded && child.$jazz.id === blockId) {
            return col.$jazz.id;
          }
          // Check if product is in a slot's children
          if (child && child.$isLoaded && child.type === "slot" && child.children?.$isLoaded) {
            for (const slotChild of child.children) {
              if (slotChild && slotChild.$isLoaded && slotChild.$jazz.id === blockId) {
                return col.$jazz.id;
              }
            }
          }
        }
      }
    }

    return null;
  };

  // Get the current slot ID (if product is in a slot)
  // Searches both parentId (legacy) and children lists (new pattern)
  const getCurrentSlotId = (): string | null => {
    if (!block) return null;
    const allBlocks = getAllBlocks();
    const blockId = block.$jazz.id;

    // Try legacy parentId approach first
    if (block.parentId) {
      const parent = allBlocks.find((b) => b.$jazz.id === block.parentId);
      if (parent?.type === "slot") {
        return parent.$jazz.id;
      }
    }

    // Search through children lists (new pattern)
    for (const col of allBlocks.filter((b) => b.type === "collection")) {
      if (col.children?.$isLoaded) {
        for (const child of col.children) {
          // Check if product is in a slot's children
          if (child && child.$isLoaded && child.type === "slot" && child.children?.$isLoaded) {
            for (const slotChild of child.children) {
              if (slotChild && slotChild.$isLoaded && slotChild.$jazz.id === blockId) {
                return child.$jazz.id;
              }
            }
          }
        }
      }
    }

    return null;
  };

  const collectionId = getCollectionId();

  const formik = useFormik({
    initialValues: {
      title: "",
      description: "",
      notes: "",
      price: "",
      slotId: null as string | null,
    },
    validationSchema,
    onSubmit: async (values) => {
      if (!block || !block.productData) return;

      // Update block name
      block.$jazz.set("name", values.title || block.name);

      // Update productData
      const updatedProductData = {
        ...block.productData,
        description: values.description || undefined,
        notes: values.notes || undefined,
        price: values.price || undefined,
      };
      block.$jazz.set("productData", updatedProductData);

      // Handle slot/collection change
      const currentSlotId = getCurrentSlotId();
      if (values.slotId !== currentSlotId) {
        const allBlocks = getAllBlocks();
        const collection = allBlocks.find((b) => b.$jazz.id === collectionId);

        if (collection?.children?.$isLoaded) {
          // Remove from current location (slot or collection children)
          if (currentSlotId) {
            // Remove from current slot's children
            const currentSlot = collection.children.find(
              (c) => c && c.$isLoaded && c.$jazz.id === currentSlotId
            );
            if (currentSlot?.children?.$isLoaded) {
              const idx = currentSlot.children.findIndex(
                (c) => c && c.$isLoaded && c.$jazz.id === block.$jazz.id
              );
              if (idx !== -1) {
                currentSlot.children.$jazz.splice(idx, 1);
              }
            }
          } else {
            // Remove from collection's children
            const idx = collection.children.findIndex(
              (c) => c && c.$isLoaded && c.$jazz.id === block.$jazz.id
            );
            if (idx !== -1) {
              collection.children.$jazz.splice(idx, 1);
            }
          }

          // Add to new location
          if (values.slotId) {
            // Add to new slot's children
            const newSlot = collection.children.find(
              (c) => c && c.$isLoaded && c.$jazz.id === values.slotId
            );
            if (newSlot?.children?.$isLoaded) {
              newSlot.children.$jazz.push(block);
            }
          } else {
            // Add to collection's children
            collection.children.$jazz.push(block);
          }
        }

        // Also update parentId for legacy compatibility
        const newParentId = values.slotId || collectionId;
        if (newParentId) {
          block.$jazz.set("parentId", newParentId);
        }
      }

      onOpenChange(false);
    },
  });

  // Update form values when block changes
  useEffect(() => {
    if (block && productData) {
      formik.setValues({
        title: block.name || "",
        description: productData.description || "",
        notes: productData.notes || "",
        price: productData.price || "",
        slotId: getCurrentSlotId(),
      });
    }
  }, [block, productData]);

  // Get slots for this product's collection (including newly created ones)
  // Searches both parentId (legacy) and children lists (new pattern)
  const getSlots = (): LoadedBlock[] => {
    if (!collectionId) return [];
    const allBlocks = getAllBlocks();
    const collection = allBlocks.find((b) => b.$jazz.id === collectionId);

    // Get slots from children list (new pattern)
    const slotsFromChildren: LoadedBlock[] = [];
    if (collection?.children?.$isLoaded) {
      for (const child of collection.children) {
        if (child && child.$isLoaded && child.type === "slot") {
          slotsFromChildren.push(child);
        }
      }
    }

    // Fall back to parentId-based lookup if no children
    const existingSlots = slotsFromChildren.length > 0
      ? slotsFromChildren
      : getSlotsForCollection(allBlocks, collectionId);

    // Merge in any newly created slots that might not be in the lists yet
    const existingIds = new Set(existingSlots.map(s => s.$jazz.id));
    const newSlots = createdSlots.filter(s => !existingIds.has(s.$jazz.id));
    return [...existingSlots, ...newSlots];
  };

  // Create a new slot in the collection
  const handleCreateSlot = async (name: string): Promise<string> => {
    if (!account?.root?.blocks?.$isLoaded || !collectionId) {
      throw new Error("Cannot create slot");
    }

    // Find the collection to get its sharing group
    const collectionBlock = account.root.blocks.find(
      (b) => b && b.$isLoaded && b.$jazz.id === collectionId
    );

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

    // Add slot to collection's children list
    collectionBlock.children.$jazz.push(newSlot);
    // Track the new slot locally to ensure it's immediately available
    setCreatedSlots(prev => [...prev, newSlot as LoadedBlock]);
    return newSlot.$jazz.id;
  };

  const handleClose = () => {
    setCreatedSlots([]); // Clear created slots on close
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>Edit Product Link</Dialog.Title>
          <Dialog.Description className={styles.description}>
            Update the details for your product
          </Dialog.Description>

          <form onSubmit={formik.handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="title" className={styles.label}>
                Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                value={formik.values.title}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Product title"
                className={styles.input}
              />
              {formik.touched.title && formik.errors.title && (
                <div className={styles.error}>{formik.errors.title}</div>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="description" className={styles.label}>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formik.values.description}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Product description"
                className={styles.textarea}
                rows={3}
              />
              {formik.touched.description && formik.errors.description && (
                <div className={styles.error}>{formik.errors.description}</div>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="price" className={styles.label}>
                Price
              </label>
              <input
                id="price"
                name="price"
                type="text"
                value={formik.values.price}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="$99.99"
                className={styles.input}
              />
              {formik.touched.price && formik.errors.price && (
                <div className={styles.error}>{formik.errors.price}</div>
              )}
            </div>

            {/* Slot Selector - only show if we have account access */}
            {account && collectionId && (
              <div className={styles.inputGroup}>
                <label className={styles.label}>
                  Slot <span className={styles.optional}>(optional)</span>
                </label>
                <SlotSelector
                  value={formik.values.slotId}
                  onChange={(slotId) => formik.setFieldValue("slotId", slotId)}
                  slots={getSlots()}
                  onCreateSlot={handleCreateSlot}
                  placeholder="Move to slot (optional)"
                  disabled={formik.isSubmitting}
                />
              </div>
            )}

            <div className={styles.inputGroup}>
              <label htmlFor="notes" className={styles.label}>
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formik.values.notes}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Add your personal notes..."
                className={styles.textarea}
                rows={3}
              />
              {formik.touched.notes && formik.errors.notes && (
                <div className={styles.error}>{formik.errors.notes}</div>
              )}
            </div>

            <div className={styles.urlDisplay}>
              <label className={styles.label}>URL</label>
              <a
                href={productData?.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.urlLink}
              >
                {productData?.url}
              </a>
            </div>

            <div className={styles.actions}>
              <Dialog.Close asChild>
                <button type="button" className={styles.cancelButton}>
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className={styles.saveButton}
                disabled={formik.isSubmitting}
              >
                Save Changes
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
