import styles from "./ViewModeToggle.module.css";

export type ViewMode = "grid" | "table";

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <div className={styles.toggle} role="group" aria-label="View mode">
      <button
        type="button"
        className={`${styles.button} ${mode === "grid" ? styles.active : ""}`}
        onClick={() => onChange("grid")}
        aria-pressed={mode === "grid"}
        title="Grid view"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      </button>
      <button
        type="button"
        className={`${styles.button} ${mode === "table" ? styles.active : ""}`}
        onClick={() => onChange("table")}
        aria-pressed={mode === "table"}
        title="Table view"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>
    </div>
  );
}
