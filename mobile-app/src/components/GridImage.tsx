import { Image, type ImageContentFit } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';

export function GridImage({
  uri,
  style,
  isVisible = true,
  contentFit = 'cover',
  onError,
}: {
  uri: string;
  style?: StyleProp<ImageStyle>;
  isVisible?: boolean;
  contentFit?: ImageContentFit;
  onError?: () => void;
}) {
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      transition={200}
      cachePolicy="memory-disk"
      priority={isVisible ? 'high' : 'low'}
      onError={onError}
    />
  );
}
