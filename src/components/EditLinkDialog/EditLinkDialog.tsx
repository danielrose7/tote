import * as Dialog from "@radix-ui/react-dialog";
import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import type { ProductLink } from "../../schema.ts";
import type { co } from "jazz-tools";
import styles from "./EditLinkDialog.module.css";

interface EditLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: co.loaded<typeof ProductLink> | null;
}

const validationSchema = Yup.object({
  title: Yup.string(),
  description: Yup.string(),
  notes: Yup.string(),
  price: Yup.string(),
  tags: Yup.string(),
});

export function EditLinkDialog({
  open,
  onOpenChange,
  link,
}: EditLinkDialogProps) {
  const formik = useFormik({
    initialValues: {
      title: "",
      description: "",
      notes: "",
      price: "",
      tags: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      if (!link) return;

      link.$jazz.set("title", values.title || undefined);
      link.$jazz.set("description", values.description || undefined);
      link.$jazz.set("notes", values.notes || undefined);
      link.$jazz.set("price", values.price || undefined);

      const tagArray = values.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      link.$jazz.set("tags", tagArray.length > 0 ? tagArray : undefined);

      onOpenChange(false);
    },
  });

  // Update form values when link changes
  useEffect(() => {
    if (link) {
      formik.setValues({
        title: link.title || "",
        description: link.description || "",
        notes: link.notes || "",
        price: link.price || "",
        tags: link.tags?.join(", ") || "",
      });
    }
  }, [link]);

  const handleClose = () => {
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

            <div className={styles.inputGroup}>
              <label htmlFor="tags" className={styles.label}>
                Tags <span className={styles.hint}>(comma-separated)</span>
              </label>
              <input
                id="tags"
                name="tags"
                type="text"
                value={formik.values.tags}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="electronics, gift ideas, wishlist"
                className={styles.input}
              />
              {formik.touched.tags && formik.errors.tags && (
                <div className={styles.error}>{formik.errors.tags}</div>
              )}
            </div>

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
                href={link?.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.urlLink}
              >
                {link?.url}
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
