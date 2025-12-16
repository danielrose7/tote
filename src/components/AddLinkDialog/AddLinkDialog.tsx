import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import type { JazzAccount } from "../../schema.ts";
import type { co } from "jazz-tools";
import { fetchMetadata, isValidUrl } from "../../../app/utils/metadata";
import { ProductLink } from "../../schema.ts";
import { useToast } from "../ToastNotification";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import styles from "./AddLinkDialog.module.css";

interface AddLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: co.loaded<typeof JazzAccount>;
  collectionId?: string; // Optional collection ID to default to
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
}: AddLinkDialogProps) {
  const { showToast } = useToast();
  const isOnline = useOnlineStatus();
  const [isLoading, setIsLoading] = useState(false);

  // Default to the provided collection ID, or the account's default collection
  const defaultCollectionId = collectionId || (account.root?.$isLoaded ? account.root.defaultCollectionId || null : null);

  const formik = useFormik({
    initialValues: {
      url: "",
      collectionId: defaultCollectionId || "",
    },
    validationSchema,
    onSubmit: async (values) => {
      if (!account.root || !account.root.$isLoaded) return;
      if (!values.collectionId || !account.root.collections.$isLoaded) return;

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

        const newLink = ProductLink.create(
          {
            url: metadata.url,
            title: metadata.title,
            description: metadata.description,
            imageUrl: metadata.imageUrl,
            price: metadata.price,
            addedAt: new Date(),
          },
          account.$jazz,
        );

        // Add to selected collection
        const collection = account.root.collections.find(
          (c) => c && c.$isLoaded && c.$jazz.id === values.collectionId
        );
        if (collection && collection.$isLoaded && collection.links.$isLoaded) {
          collection.links.$jazz.push(newLink);
          showToast({
            title: "Link added",
            description: `"${metadata.title || "Link"}" has been added to ${collection.name}`,
            variant: "success",
          });
        }

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
      },
    });
    onOpenChange(false);
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
            {account.root?.collections?.$isLoaded && account.root.collections.length > 0 && (
              <div className={styles.inputGroup}>
                <label htmlFor="collectionId" className={styles.label}>
                  Collection
                </label>
                <select
                  id="collectionId"
                  name="collectionId"
                  value={formik.values.collectionId}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={styles.select}
                  disabled={isLoading}
                >
                  {account.root.collections.map((collection) => {
                    if (!collection || !collection.$isLoaded) return null;
                    return (
                      <option key={collection.$jazz.id} value={collection.$jazz.id}>
                        {collection.name}
                      </option>
                    );
                  })}
                </select>
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
