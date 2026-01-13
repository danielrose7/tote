import * as Dialog from "@radix-ui/react-dialog";
import type { SharedCollectionRef } from "../../schema.ts";
import type { co } from "jazz-tools";
import styles from "./LeaveCollectionDialog.module.css";

type LoadedSharedRef = co.loaded<typeof SharedCollectionRef>;

interface LeaveCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sharedRef: LoadedSharedRef | null;
  onConfirm: () => void;
}

export function LeaveCollectionDialog({
  open,
  onOpenChange,
  sharedRef,
  onConfirm,
}: LeaveCollectionDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>Leave Collection?</Dialog.Title>
          <Dialog.Description className={styles.description}>
            Are you sure you want to leave{" "}
            <strong>{sharedRef?.name || "this collection"}</strong>?
          </Dialog.Description>
          <p className={styles.info}>
            You will no longer see this collection in your list. You can rejoin
            if someone shares it with you again.
          </p>
          <div className={styles.actions}>
            <Dialog.Close asChild>
              <button type="button" className={styles.cancelButton}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={styles.leaveButton}
              onClick={handleConfirm}
            >
              Leave Collection
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
