import { useState, useRef, useEffect, useCallback } from "react";
import type { LoadedBlock } from "../../lib/blocks";
import styles from "./SlotSelector.module.css";

interface SlotSelectorProps {
  value: string | null;
  onChange: (slotId: string | null) => void;
  slots: LoadedBlock[];
  onCreateSlot: (name: string) => Promise<string>;
  placeholder?: string;
  disabled?: boolean;
}

export function SlotSelector({
  value,
  onChange,
  slots,
  onCreateSlot,
  placeholder = "Add to slot (optional)",
  disabled = false,
}: SlotSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Get the selected slot's name
  const selectedSlot = value ? slots.find((s) => s.$jazz.id === value) : null;

  // Filter slots based on input
  const filteredSlots = inputValue
    ? slots.filter((slot) =>
        slot.name.toLowerCase().includes(inputValue.toLowerCase())
      )
    : slots;

  // Check if we should show "Create" option
  const exactMatch = slots.some(
    (slot) => slot.name.toLowerCase() === inputValue.toLowerCase()
  );
  const showCreateOption = inputValue.trim() && !exactMatch;

  // Total items (slots + optional create)
  const totalItems = filteredSlots.length + (showCreateOption ? 1 : 0);

  // Reset highlighted index when options change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [inputValue]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleSelect = useCallback(
    (slotId: string) => {
      onChange(slotId);
      setInputValue("");
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [onChange]
  );

  const handleCreate = useCallback(async () => {
    if (!inputValue.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const newSlotId = await onCreateSlot(inputValue.trim());
      onChange(newSlotId);
      setInputValue("");
      setIsOpen(false);
    } finally {
      setIsCreating(false);
    }
  }, [inputValue, isCreating, onCreateSlot, onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
    setInputValue("");
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) =>
            prev < totalItems - 1 ? prev + 1 : prev
          );
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          if (highlightedIndex < filteredSlots.length) {
            handleSelect(filteredSlots[highlightedIndex].$jazz.id);
          } else if (showCreateOption) {
            handleCreate();
          }
        } else if (showCreateOption) {
          handleCreate();
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper}>
        {selectedSlot && !isOpen ? (
          <div className={styles.selectedValue}>
            <span className={styles.selectedText}>{selectedSlot.name}</span>
            {!disabled && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={handleClear}
                aria-label="Clear selection"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              // Delay to allow click on options
              setTimeout(() => setIsOpen(false), 150);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={styles.input}
            disabled={disabled}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            role="combobox"
          />
        )}
      </div>

      {isOpen && !disabled && (
        <ul
          ref={listRef}
          className={styles.dropdown}
          role="listbox"
        >
          {filteredSlots.map((slot, index) => (
            <li
              key={slot.$jazz.id}
              className={`${styles.option} ${
                highlightedIndex === index ? styles.highlighted : ""
              } ${value === slot.$jazz.id ? styles.selected : ""}`}
              onClick={() => handleSelect(slot.$jazz.id)}
              role="option"
              aria-selected={value === slot.$jazz.id}
            >
              {slot.name}
            </li>
          ))}
          {showCreateOption && (
            <li
              className={`${styles.option} ${styles.createOption} ${
                highlightedIndex === filteredSlots.length ? styles.highlighted : ""
              }`}
              onClick={handleCreate}
              role="option"
            >
              {isCreating ? (
                "Creating..."
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Create "{inputValue.trim()}"
                </>
              )}
            </li>
          )}
          {filteredSlots.length === 0 && !showCreateOption && (
            <li className={styles.empty}>
              {slots.length === 0
                ? "No slots yet. Type to create one."
                : "No matching slots"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
