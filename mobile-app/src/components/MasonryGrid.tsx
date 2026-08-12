import type React from 'react';
import { useMemo } from 'react';
import {
  Animated,
  type ScrollViewProps,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

type MasonryGridProps<T> = Omit<ScrollViewProps, 'children'> & {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, opts: { isVisible: boolean }) => React.ReactElement;
  /**
   * Estimated rendered height of a card at `columnWidth`. Only used to decide
   * which column each card goes in, so a rough estimate is fine — being off
   * makes the bottom edge less even, it never opens a gap mid-column.
   * Memoize it; it's a dependency of the layout.
   */
  estimateHeight: (item: T, columnWidth: number) => number;
  columns?: number;
  columnWidth?: number;
  gap?: number;
  ListHeaderComponent?: React.ReactNode;
  ListEmptyComponent?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * A true masonry grid: cards keep their natural heights and each one goes to
 * whichever column is currently shortest, so columns stay level and no card
 * leaves dead space beneath it.
 *
 * This is deliberately a ScrollView rather than a FlatList. FlatList lays out
 * fixed rows — every row as tall as its tallest card — which is what produced
 * the ragged gaps this replaces. The cost is that every card mounts up front;
 * collections here are curated and small, but if they grow into the thousands
 * this wants windowing based on the offsets the layout below already knows.
 */
export function MasonryGrid<T>({
  data,
  keyExtractor,
  renderItem,
  estimateHeight,
  columns = 2,
  columnWidth,
  gap = 12,
  ListHeaderComponent,
  ListEmptyComponent,
  contentContainerStyle,
  ...scrollProps
}: MasonryGridProps<T>) {
  const columnItems = useMemo(() => {
    const buckets = Array.from({ length: columns }, (_, column) => ({
      key: `column-${column}`,
      items: [] as { item: T; index: number }[],
    }));
    const heights = new Array<number>(columns).fill(0);

    data.forEach((item, index) => {
      let shortest = 0;
      for (let i = 1; i < columns; i++) {
        if (heights[i] < heights[shortest]) shortest = i;
      }
      buckets[shortest].items.push({ item, index });
      heights[shortest] += estimateHeight(item, columnWidth ?? 0) + gap;
    });

    return buckets;
  }, [data, columns, columnWidth, gap, estimateHeight]);

  return (
    <Animated.ScrollView
      contentContainerStyle={contentContainerStyle}
      {...scrollProps}
    >
      {ListHeaderComponent}
      {data.length === 0 ? (
        ListEmptyComponent
      ) : (
        <View style={{ flexDirection: 'row', gap }}>
          {columnItems.map(({ key, items }) => (
            <View
              key={key}
              style={[
                columnWidth ? { width: columnWidth } : { flex: 1 },
                { gap },
              ]}
            >
              {items.map(({ item, index }) => (
                <View key={keyExtractor(item, index)}>
                  {renderItem(item, { isVisible: true })}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </Animated.ScrollView>
  );
}
