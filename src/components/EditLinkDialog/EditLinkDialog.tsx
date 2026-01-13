import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import type { Block, JazzAccount } from "../../schema.ts";
import { Block as BlockSchema } from "../../schema.ts";
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
  const getCollectionId = (): string | null => {
    if (!block?.parentId) return null;
    const allBlocks = getAllBlocks();
    const parent = allBlocks.find((b) => b.$jazz.id === block.parentId);
    if (!parent) return null;
    // If parent is a collection, use it; if parent is a slot, use slot's parent
    if (parent.type === "collection") {
      return parent.$jazz.id;
    } else if (parent.type === "slot" && parent.parentId) {
      return parent.parentId;
    }
    return null;
  };

  // Get the current slot ID (if product is in a slot)
  const getCurrentSlotId = (): string | null => {
    if (!block?.parentId) return null;
    const allBlocks = getAllBlocks();
    const parent = allBlocks.find((b) => b.$jazz.id === block.parentId);
    if (parent?.type === "slot") {
      return parent.$jazz.id;
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

      // Update parentId if slot changed
      const currentSlotId = getCurrentSlotId();
      if (values.slotId !== currentSlotId) {
        // If moving to a slot, set parentId to slot; otherwise set to collection
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
  const getSlots = (): LoadedBlock[] => {
    if (!collectionId) return [];
    const existingSlots = getSlotsForCollection(getAllBlocks(), collectionId);
    // Merge in any newly created slots that might not be in the blocks list yet
    const existingIds = new Set(existingSlots.map(s => s.$jazz.id));
    const newSlots = createdSlots.filter(s =>
      s.parentId === collectionId && !existingIds.has(s.$jazz.id)
    );
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

    // Get the collection's sharing group for proper ownership
    let ownerGroup: Group | null = null;
    const sharingGroupId = collectionBlock?.collectionData?.sharingGroupId;
    if (sharingGroupId) {
      ownerGroup = await Group.load(sharingGroupId as `co_z${string}`, {});
    }

    const newSlot = BlockSchema.create(
      {
        type: "slot",
        name,
        slotData: {
          maxSelections: 1,
        },
        parentId: collectionId,
        createdAt: new Date(),
      },
      ownerGroup ? { owner: ownerGroup } : account.$jazz,
    );

    account.root.blocks.$jazz.push(newSlot);
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
