import * as Dialog from "@radix-ui/react-dialog";
import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import type { Block } from "../../schema.ts";
import type { co } from "jazz-tools";
import styles from "./EditLinkDialog.module.css";

type LoadedBlock = co.loaded<typeof Block>;

interface EditLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: LoadedBlock | null;
}

const validationSchema = Yup.object({
  title: Yup.string(),
  description: Yup.string(),
  notes: Yup.string(),
  price: Yup.string(),
  status: Yup.string(),
});

export function EditLinkDialog({
  open,
  onOpenChange,
  block,
}: EditLinkDialogProps) {
  const productData = block?.productData;

  const formik = useFormik({
    initialValues: {
      title: "",
      description: "",
      notes: "",
      price: "",
      status: "considering" as "considering" | "selected" | "ruled-out",
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
        status: values.status,
      };
      block.$jazz.set("productData", updatedProductData);

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
        status: productData.status || "considering",
      });
    }
  }, [block, productData]);

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
              <label htmlFor="status" className={styles.label}>
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formik.values.status}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={styles.select}
              >
                <option value="considering">Considering</option>
                <option value="selected">Selected</option>
                <option value="ruled-out">Ruled out</option>
              </select>
              {formik.touched.status && formik.errors.status && (
                <div className={styles.error}>{formik.errors.status}</div>
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
