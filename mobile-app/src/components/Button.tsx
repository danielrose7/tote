import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  isLoading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const spinnerColor =
    variant === 'primary'
      ? '#fff'
      : variant === 'danger'
        ? '#ef4444'
        : '#6b7280';

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        (disabled || isLoading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || isLoading}
    >
      <View style={styles.content}>
        {isLoading && (
          <ActivityIndicator
            color={spinnerColor}
            size="small"
            style={styles.spinner}
          />
        )}
        <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },

  primary: { backgroundColor: '#6366f1' },
  ghost: { borderWidth: 1, borderColor: '#e5e7eb' },
  danger: {},

  content: { flexDirection: 'row', alignItems: 'center' },
  spinner: { marginRight: 8 },

  label: { fontSize: 15, fontWeight: '600' },
  primaryLabel: { color: '#fff' },
  ghostLabel: { color: '#6b7280' },
  dangerLabel: { color: '#ef4444', fontSize: 14 },
});
