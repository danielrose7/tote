import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { Block } from "../../schema.ts";
import type { co } from "jazz-tools";
import styles from "./DeleteConfirmDialog.module.css";

type LoadedBlock = co.loaded<typeof Block>;

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: LoadedBlock | null;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  block,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.overlay} />
        <AlertDialog.Content className={styles.content}>
          <AlertDialog.Title className={styles.title}>
            Delete Product Link?
          </AlertDialog.Title>
          <AlertDialog.Description className={styles.description}>
            Are you sure you want to delete{" "}
            <strong>{block?.name || "this link"}</strong>? This action cannot be
            undone.
          </AlertDialog.Description>

          <div className={styles.actions}>
            <AlertDialog.Cancel asChild>
              <button type="button" className={styles.cancelButton}>
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                onClick={handleConfirm}
                className={styles.deleteButton}
              >
                Delete
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
