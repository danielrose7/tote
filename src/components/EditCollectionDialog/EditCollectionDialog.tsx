import * as Dialog from "@radix-ui/react-dialog";
import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import type { Block, JazzAccount } from "../../schema.ts";
import type { co } from "jazz-tools";
import { useToast } from "../ToastNotification";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import styles from "./EditCollectionDialog.module.css";

type LoadedBlock = co.loaded<typeof Block>;

interface EditCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: LoadedBlock | null;
  account: co.loaded<typeof JazzAccount>;
}

const PRESET_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
];

const validationSchema = Yup.object({
  name: Yup.string()
    .required("Collection name is required")
    .max(50, "Collection name must be 50 characters or less"),
  description: Yup.string().max(200, "Description must be 200 characters or less"),
  color: Yup.string().required("Color is required"),
});

export function EditCollectionDialog({
  open,
  onOpenChange,
  block,
  account,
}: EditCollectionDialogProps) {
  const { showToast } = useToast();
  const isOnline = useOnlineStatus();

  const collectionData = block?.collectionData;

  const isDefault = account.root?.$isLoaded
    ? account.root.defaultBlockId === block?.$jazz.id
    : false;

  const formik = useFormik({
    initialValues: {
      name: "",
      description: "",
      color: PRESET_COLORS[0],
    },
    validationSchema,
    onSubmit: async (values) => {
      if (!block) return;

      // Update block name
      block.$jazz.set("name", values.name.trim());

      // Update collectionData
      block.$jazz.set("collectionData", {
        ...block.collectionData,
        description: values.description.trim() || undefined,
        color: values.color,
      });

      showToast({
        title: "Collection updated",
        description: `"${values.name}" has been updated${!isOnline ? " (will sync when online)" : ""}`,
        variant: "success",
      });

      onOpenChange(false);
    },
  });

  // Update form values when block changes
  useEffect(() => {
    if (block) {
      formik.setValues({
        name: block.name || "",
        description: collectionData?.description || "",
        color: collectionData?.color || PRESET_COLORS[0],
      });
    }
  }, [block, collectionData]);

  const handleSetAsDefault = () => {
    if (!block || !account.root || !account.root.$isLoaded) return;

    account.root.$jazz.set("defaultBlockId", block.$jazz.id);

    showToast({
      title: "Default collection set",
      description: `"${block.name}" is now your default collection${!isOnline ? " (will sync when online)" : ""}`,
      variant: "success",
    });
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>Edit Collection</Dialog.Title>
          <Dialog.Description className={styles.description}>
            Update your collection details
          </Dialog.Description>

          <form onSubmit={formik.handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="name" className={styles.label}>
                Collection Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formik.values.name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="e.g., Gift Ideas, Tech Gadgets, Home Decor"
                className={styles.input}
                maxLength={50}
                autoFocus
              />
              {formik.touched.name && formik.errors.name && (
                <div className={styles.error}>{formik.errors.name}</div>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="description" className={styles.label}>
                Description (optional)
              </label>
              <textarea
                id="description"
                name="description"
                value={formik.values.description}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="What's this collection for?"
                className={styles.textarea}
                rows={3}
                maxLength={200}
              />
              {formik.touched.description && formik.errors.description && (
                <div className={styles.error}>{formik.errors.description}</div>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Color</label>
              <div className={styles.colorPicker}>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`${styles.colorOption} ${formik.values.color === color ? styles.colorOptionSelected : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => formik.setFieldValue("color", color)}
                    aria-label={`Select color ${color}`}
                  >
                    {formik.values.color === color && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.defaultSection}>
              <div className={styles.defaultInfo}>
                <span className={styles.defaultLabel}>Default Collection</span>
                <span className={styles.defaultDescription}>
                  {isDefault
                    ? "This is your default collection"
                    : "Set as the default collection for new links"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSetAsDefault}
                disabled={isDefault}
                className={styles.defaultButton}
              >
                {isDefault ? "✓ Default" : "Set as Default"}
              </button>
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
                disabled={!formik.values.name.trim() || formik.isSubmitting}
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
