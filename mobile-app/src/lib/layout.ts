import { useWindowDimensions } from 'react-native';

// Photos, Pinterest and SwiftUI's `LazyVGrid(.adaptive(minimum:))` all size grids
// the same way: you pick an *ideal tile width*, and the column count falls out of
// how many of those fit. Tiles stay roughly the same physical size on every
// device and the grid just gets wider — the opposite of hardcoding 2 columns and
// letting each tile balloon to half an iPad.

/** Below this the window is a phone (or a narrow iPad Split View pane). */
const REGULAR_WIDTH = 700;

/** Grids stop growing here; past it we add columns, not width. */
const MAX_GRID_WIDTH = 1100;

/** Rows, forms and prose get a tighter cap — long lines are hard to scan. */
const MAX_READABLE_WIDTH = 720;

const MIN_COLUMNS = 2;
const MAX_COLUMNS = 5;

export function useBreakpoints() {
  const { width } = useWindowDimensions();
  return {
    width,
    /** iPad portrait and up. */
    isRegular: width >= REGULAR_WIDTH,
    /** Page padding — grows with the window so content isn't pinned to the edge. */
    gutter: width >= 1000 ? 32 : width >= REGULAR_WIDTH ? 28 : 20,
    /** Space between tiles. */
    gap: width >= REGULAR_WIDTH ? 20 : 12,
  };
}

export type GridLayout = {
  width: number;
  columns: number;
  columnWidth: number;
  gap: number;
  /** Horizontal padding that both pads *and* centers the content. */
  sideInset: number;
  isRegular: boolean;
};

/**
 * Column count and tile width for a grid of `idealTileWidth`-ish tiles.
 * Pass the result's `columns` straight to `MasonryGrid`.
 */
export function useGridLayout(idealTileWidth: number): GridLayout {
  const { width, gutter, gap, isRegular } = useBreakpoints();
  const contentWidth = Math.min(width - gutter * 2, MAX_GRID_WIDTH);
  const columns = Math.min(
    MAX_COLUMNS,
    Math.max(MIN_COLUMNS, Math.round(contentWidth / idealTileWidth)),
  );

  return {
    width,
    columns,
    columnWidth: Math.floor((contentWidth - gap * (columns - 1)) / columns),
    gap,
    sideInset: Math.round((width - contentWidth) / 2),
    isRegular,
  };
}

/**
 * Horizontal padding that centers a single column of rows/forms at a
 * comfortable reading width.
 */
export function useReadableInset(maxWidth = MAX_READABLE_WIDTH): number {
  const { width, gutter } = useBreakpoints();
  return Math.round((width - Math.min(width - gutter * 2, maxWidth)) / 2);
}
