import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LoadedBlock } from "../../lib/blocks";
import styles from "./SlotSection.module.css";

interface SortableProductItemProps {
  product: LoadedBlock;
}

export function SortableProductItem({ product }: SortableProductItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.$jazz.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative" as const,
  };

  const productData = product.productData;
  const price = productData?.price;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.productItem} ${isDragging ? styles.productItemDragging : ""}`}
    >
      <button
        type="button"
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder product"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="9" cy="19" r="2" />
          <circle cx="15" cy="5" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="15" cy="19" r="2" />
        </svg>
      </button>
      {productData?.imageUrl && (
        <img
          src={productData.imageUrl}
          alt=""
          className={styles.productItemImage}
        />
      )}
      <span className={styles.productItemName}>{product.name}</span>
      {price && <span className={styles.productItemPrice}>{price}</span>}
    </div>
  );
}
