import { useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  View,
  type FlatListProps,
  type ViewToken,
} from 'react-native';

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList,
) as unknown as new <T>(
  props: Animated.AnimatedProps<FlatListProps<T>>,
) => FlatList<T>;

type MasonryGridProps<T> = Omit<
  FlatListProps<T>,
  'renderItem' | 'numColumns' | 'columnWrapperStyle'
> & {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, opts: { isVisible: boolean }) => React.ReactElement;
  gap?: number;
};

// A 2-column grid that only fetches images for cards near the viewport:
// it tracks which rows are actually visible and passes that down as
// `isVisible` so callers can prioritize (or defer) their image loads.
export function MasonryGrid<T>({
  keyExtractor,
  renderItem,
  gap = 12,
  ...rest
}: MasonryGridProps<T>) {
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setVisibleKeys(new Set(viewableItems.map((v) => String(v.key))));
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current;

  return (
    <AnimatedFlatList
      keyExtractor={keyExtractor}
      numColumns={2}
      columnWrapperStyle={{ flexDirection: 'row', gap }}
      initialNumToRender={6}
      maxToRenderPerBatch={4}
      updateCellsBatchingPeriod={50}
      windowSize={5}
      removeClippedSubviews
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      renderItem={({ item, index }) => (
        <View style={{ flex: 1 }}>
          {renderItem(item, {
            isVisible: visibleKeys.has(String(keyExtractor(item, index))),
          })}
        </View>
      )}
      {...rest}
    />
  );
}
