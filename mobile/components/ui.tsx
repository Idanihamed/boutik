import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { COLORS } from '../lib/labels';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: COLORS.brand },
        variant === 'secondary' && { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
        variant === 'danger' && { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.danger },
        (pressed || off) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : COLORS.brand} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: variant === 'primary' ? '#fff' : variant === 'danger' ? COLORS.danger : COLORS.text },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && <Button label="Réessayer" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

export function Loader({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={COLORS.brand} />
      <Text style={{ color: COLORS.muted, marginTop: 8 }}>{label}</Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  card: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '600' },
  error: { backgroundColor: '#fef2f2', borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', padding: 14, gap: 10 },
  errorText: { color: COLORS.danger, fontSize: 15 },
  loader: { padding: 32, alignItems: 'center' },
  empty: { color: COLORS.muted, textAlign: 'center', padding: 32, fontSize: 15 },
});
