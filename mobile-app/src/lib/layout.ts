import { type Context, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  type EdgeInsets,
  SafeAreaInsetsContext,
} from 'react-native-safe-area-context';

// Photos, Pinterest and SwiftUI's `LazyVGrid(.adaptive(minimum:))` all size grids
// the same way: you pick an *ideal tile width*, and the column count falls out of
// how many of those fit. Tiles stay roughly the same physical size on every
// device and the grid just gets wider — the opposite of hardcoding 2 columns and
// letting each tile balloon to half an iPad.

/**
 * Default ideal tile width for card grids.
 *
 * Tuned to land on 4 columns across both iPads in portrait, which is a narrow
 * target: the 11" has 778pt of content (778/4.5 = 173, 778/3.5 = 222) and the
 * 13" has 968pt (968/4.5 = 215, 968/3.5 = 277), so only 215–222 gives 4 on
 * both. 218 sits in the middle of that window. Landscape exceeds MAX_GRID_WIDTH
 * and settles at 5.
 *
 * Because the window is tight, changing `gutter` or adding a device size can
 * tip one of them to 3 or 5 — re-check the arithmetic above if you touch either.
 */
export const IDEAL_TILE_WIDTH = 218;

/**
 * Below this the window is a phone (or a narrow iPad Split View pane) — a
 * stand-in for UIKit's compact/regular horizontal size class, which React
 * Native doesn't expose. 660 puts both poses of the open iPhone Duo (669 and
 * 951) in regular and every iPhone, including the folded Duo (466), in
 * compact, matching Apple's guidance to design for those two classes.
 */
const REGULAR_WIDTH = 660;

/** Grids stop growing here; past it we add columns, not width. */
const MAX_GRID_WIDTH = 1100;

/** Rows, forms and prose get a tighter cap — long lines are hard to scan. */
const MAX_READABLE_WIDTH = 720;

const MIN_COLUMNS = 2;
const MAX_COLUMNS = 5;

/**
 * Devices and poses this has to cover (points, portrait unless noted):
 *
 *   iPhone              ~390–440 wide   2 columns
 *   iPhone Duo, folded   466 × 678      2 columns (an ordinary phone)
 *   iPhone Duo, open     669 × 951      3 columns; 4 when held sideways (regular)
 *   iPad 11" / 13"       834 / 1032     4 columns; 5 in landscape
 *
 * The Duo's inner screen ignores UISupportedInterfaceOrientations — apps run
 * there in either pose — so nothing here may assume "phone means portrait".
 * Fold/unfold arrives as an ordinary window-size change: useWindowDimensions
 * re-renders and the column count follows, with no Duo-specific code path.
 */
export function useBreakpoints() {
  const { width } = useWindowDimensions();
  // The Duo puts a camera/status-bar rail down one edge of the folded screen
  // (and of the open screen when it's held sideways), so the left and right
  // safe-area insets can differ by ~90pt. Content is laid out inside
  // [safeLeft, width - safeRight] and centered *there*, not in the window.
  // Read through the context (null outside a provider) rather than
  // useSafeAreaInsets(), which throws there.
  // Cast only bridges duplicate @types/react copies in the monorepo.
  const insets = useContext(
    SafeAreaInsetsContext as unknown as Context<EdgeInsets | null>,
  );
  const safeLeft = insets?.left ?? 0;
  const safeRight = insets?.right ?? 0;
  return {
    width,
    safeLeft,
    safeRight,
    /** Window width minus the left and right safe areas. */
    safeWidth: width - safeLeft - safeRight,
    /** iPad portrait and up. */
    isRegular: width >= REGULAR_WIDTH,
    /** Page padding inside the safe area — grows so content isn't pinned to the edge. */
    gutter: width >= 1000 ? 32 : width >= REGULAR_WIDTH ? 28 : 20,
    /** Space between tiles. */
    gap: width >= REGULAR_WIDTH ? 20 : 12,
  };
}

/** paddingLeft/paddingRight that center `contentWidth` inside the safe area. */
export type SidePadding = { paddingLeft: number; paddingRight: number };

function centerInSafeArea(
  safeLeft: number,
  safeRight: number,
  safeWidth: number,
  contentWidth: number,
): SidePadding {
  const extra = Math.max(0, safeWidth - contentWidth) / 2;
  return {
    paddingLeft: Math.round(safeLeft + extra),
    paddingRight: Math.round(safeRight + extra),
  };
}

export type GridLayout = {
  width: number;
  /** Width the grid's columns and gaps fill. */
  contentWidth: number;
  columns: number;
  columnWidth: number;
  gap: number;
  /**
   * Spread into the container's style. Pads *and* centers the grid, and the
   * two sides differ when a camera rail makes the safe area asymmetric.
   */
  padding: SidePadding;
  isRegular: boolean;
};

/**
 * Column count and tile width for a grid of `idealTileWidth`-ish tiles.
 * Pass the result's `columns` straight to `MasonryGrid`.
 */
export function useGridLayout(idealTileWidth: number): GridLayout {
  const { width, safeLeft, safeRight, safeWidth, gutter, gap, isRegular } =
    useBreakpoints();
  const contentWidth = Math.min(safeWidth - gutter * 2, MAX_GRID_WIDTH);
  const columns = Math.min(
    MAX_COLUMNS,
    Math.max(MIN_COLUMNS, Math.round(contentWidth / idealTileWidth)),
  );

  return {
    width,
    contentWidth,
    columns,
    columnWidth: Math.floor((contentWidth - gap * (columns - 1)) / columns),
    gap,
    padding: centerInSafeArea(safeLeft, safeRight, safeWidth, contentWidth),
    isRegular,
  };
}

/**
 * paddingLeft/paddingRight that center a single column of rows/forms at a
 * comfortable reading width, clear of any safe-area rail.
 */
export function useReadablePadding(maxWidth = MAX_READABLE_WIDTH): SidePadding {
  const { safeLeft, safeRight, safeWidth, gutter } = useBreakpoints();
  return centerInSafeArea(
    safeLeft,
    safeRight,
    safeWidth,
    Math.min(safeWidth - gutter * 2, maxWidth),
  );
}
