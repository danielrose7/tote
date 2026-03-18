import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

function SkeletonBlock({ width, height, borderRadius = 8, style }: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: "#e5e7eb", opacity }, style]}
    />
  );
}

export function ProductSkeleton() {
  return (
    <View style={styles.container}>
      {/* Image placeholder */}
      <SkeletonBlock width="100%" height={200} borderRadius={12} />

      {/* Title lines */}
      <View style={styles.textGroup}>
        <SkeletonBlock width="85%" height={18} />
        <SkeletonBlock width="60%" height={18} style={{ marginTop: 8 }} />
      </View>

      {/* Price */}
      <SkeletonBlock width={80} height={22} borderRadius={6} style={{ marginTop: 12 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  textGroup: {
    marginTop: 16,
  },
});
