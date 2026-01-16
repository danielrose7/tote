import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LoadedBlock } from "../../lib/blocks";
import { SlotSection, type SlotSectionProps } from "./SlotSection";

interface SortableSlotSectionProps extends Omit<SlotSectionProps, "dragHandleProps" | "isDragging" | "forceCollapsed"> {
  slotBlock: LoadedBlock;
}

export function SortableSlotSection(props: SortableSlotSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.slotBlock.$jazz.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SlotSection
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        forceCollapsed={true}
      />
    </div>
  );
}
