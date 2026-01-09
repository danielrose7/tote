import * as Dialog from "@radix-ui/react-dialog";
import { useFormik } from "formik";
import * as Yup from "yup";
import type { JazzAccount } from "../../schema.ts";
import type { co } from "jazz-tools";
import { Block, BlockList } from "../../schema.ts";
import { useToast } from "../ToastNotification";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import styles from "./CreateCollectionDialog.module.css";

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function CreateCollectionDialog({
  open,
  onOpenChange,
  account,
}: CreateCollectionDialogProps) {
  const { showToast } = useToast();
  const isOnline = useOnlineStatus();

  const formik = useFormik({
    initialValues: {
      name: "",
      description: "",
      color: PRESET_COLORS[0],
    },
    validationSchema,
    onSubmit: async (values) => {
      if (!account.root || !account.root.$isLoaded) {
        formik.setFieldError("name", "Account not ready");
        return;
      }

      try {
        // Create the collection block (no parentId = top-level)
        const newCollectionBlock = Block.create(
          {
            type: "collection",
            name: values.name.trim(),
            collectionData: {
              description: values.description.trim() || undefined,
              color: values.color,
              viewMode: "grid",
            },
            createdAt: new Date(),
          },
          account.$jazz,
        );

        // Ensure blocks exists and add the new collection
        if (!account.root.blocks) {
          const blocksList = BlockList.create([newCollectionBlock], account);
          account.root.$jazz.set("blocks", blocksList);
        } else if (account.root.blocks.$isLoaded) {
          account.root.blocks.$jazz.push(newCollectionBlock);
        }

        showToast({
          title: "Collection created",
          description: `"${values.name}" has been created${!isOnline ? " (will sync when online)" : ""}`,
          variant: "success",
        });

        handleClose();
      } catch (err) {
        formik.setFieldError(
          "name",
          err instanceof Error ? err.message : "Failed to create collection",
        );
      }
    },
  });

  const handleClose = () => {
    formik.resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>Create Collection</Dialog.Title>
          <Dialog.Description className={styles.description}>
            Organize your product links into collections
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
                Create Collection
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
