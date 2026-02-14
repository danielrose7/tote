import { createColumnHelper } from "@tanstack/react-table";
import type { co } from "jazz-tools";
import type { Block } from "../../schema";
import styles from "./TableView.module.css";

type LoadedBlock = co.loaded<typeof Block>;

const columnHelper = createColumnHelper<LoadedBlock>();

function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (isNaN(num)) return price;
  return `$${num.toFixed(2)}`;
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

interface ColumnOptions {
  onEdit?: (block: LoadedBlock) => void;
  onDelete?: (block: LoadedBlock) => void;
  onRefresh?: (block: LoadedBlock) => void;
  refreshingBlockId?: string | null;
  enqueuedBlockIds?: string[];
  allBlocks?: LoadedBlock[];
}

export function getColumns(options: ColumnOptions) {
  const { onEdit, onDelete, onRefresh, refreshingBlockId, enqueuedBlockIds, allBlocks } = options;

  // Helper to get slot name for a product
  const getSlotName = (block: LoadedBlock): string | null => {
    if (!block.parentId || !allBlocks) return null;
    const parent = allBlocks.find((b) => b.$jazz.id === block.parentId);
    if (parent?.type === "slot") {
      return parent.name || "Unnamed slot";
    }
    return null;
  };

  return [
    columnHelper.display({
      id: "image",
      header: "",
      size: 60,
      cell: (info) => {
        const block = info.row.original;
        const imageUrl = block.productData?.imageUrl;
        return (
          <div className={styles.imageCell}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className={styles.thumbnail}
                loading="lazy"
              />
            ) : (
              <div className={styles.thumbnailPlaceholder}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
            )}
          </div>
        );
      },
    }),

    columnHelper.accessor("name", {
      header: "Title",
      size: 300,
      cell: (info) => {
        const block = info.row.original;
        const title = info.getValue() || "Untitled";
        const url = block.productData?.url;
        return url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.titleLink}
            title={url}
          >
            {title}
          </a>
        ) : (
          <span className={styles.titleLink}>{title}</span>
        );
      },
    }),

    columnHelper.display({
      id: "price",
      header: "Price",
      size: 100,
      cell: (info) => {
        const block = info.row.original;
        const price = block.productData?.price;
        return price ? (
          <span className={styles.price}>{formatPrice(price)}</span>
        ) : (
          <span className={styles.noValue}>-</span>
        );
      },
    }),

    columnHelper.display({
      id: "slot",
      header: "Slot",
      size: 140,
      cell: (info) => {
        const block = info.row.original;
        const slotName = getSlotName(block);
        return slotName ? (
          <span className={styles.slotBadge}>{slotName}</span>
        ) : (
          <span className={styles.noValue}>-</span>
        );
      },
    }),

    columnHelper.accessor("createdAt", {
      header: "Added",
      size: 120,
      cell: (info) => {
        const date = info.getValue();
        return (
          <span className={styles.date} title={date.toLocaleDateString()}>
            {formatRelativeDate(date)}
          </span>
        );
      },
    }),

    columnHelper.display({
      id: "actions",
      header: "",
      size: 100,
      cell: (info) => {
        const block = info.row.original;
        const blockId = block.$jazz.id;
        const isRefreshing = refreshingBlockId === blockId;
        const isEnqueued = enqueuedBlockIds?.includes(blockId);
        const isDisabled = isRefreshing || isEnqueued;

        return (
          <div className={styles.actions}>
            {onRefresh && (
              <button
                type="button"
                className={`${styles.actionButton} ${isRefreshing ? styles.actionButtonSpinning : ""}`}
                onClick={() => onRefresh(block)}
                title={isRefreshing ? "Refreshing..." : isEnqueued ? "Queued" : "Refresh metadata"}
                disabled={isDisabled}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => onEdit(block)}
                title="Edit"
                disabled={isDisabled}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className={`${styles.actionButton} ${styles.deleteButton}`}
                onClick={() => onDelete(block)}
                title="Delete"
                disabled={isDisabled}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
        );
      },
    }),
  ];
}
