import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

export const theme = {
  bg: '#0b1d33',
  panel: '#14304f',
  panelLight: '#1d4170',
  accent: '#ffd23f',
  text: '#ffffff',
  dim: '#9fb3c8',
  danger: '#ff4d4d',
  ok: '#3ddc84',
  blue: '#2f6bff',
  red: '#ff3b3b',
};

export function Button({ title, onPress, disabled, kind = 'primary', style }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        kind === 'secondary' && styles.btnSecondary,
        kind === 'danger' && styles.btnDanger,
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.35 },
        style,
      ]}
    >
      <Text style={[styles.btnText, kind !== 'primary' && { color: theme.text }]}>{title}</Text>
    </Pressable>
  );
}

/** Row of mutually exclusive options. */
export function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string; color?: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <View style={styles.segWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.seg}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              style={[styles.segItem, active && { backgroundColor: o.color ?? theme.accent }]}
            >
              <Text style={[styles.segText, active && { color: o.color ? theme.text : '#111' }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  title: { color: theme.accent, fontSize: 26, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  label: { color: theme.dim, fontSize: 12, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  text: { color: theme.text, fontSize: 14 },
  dim: { color: theme.dim, fontSize: 13 },
  panel: { backgroundColor: theme.panel, borderRadius: 14, padding: 14 },
  btn: { backgroundColor: theme.accent, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12, alignItems: 'center' },
  btnSecondary: { backgroundColor: theme.panelLight },
  btnDanger: { backgroundColor: theme.danger },
  btnText: { color: '#111', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  segWrap: { marginBottom: 10 },
  seg: { flexDirection: 'row', backgroundColor: theme.bg, borderRadius: 10, padding: 3, flexWrap: 'wrap' },
  segItem: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8 },
  segText: { color: theme.text, fontWeight: '700', fontSize: 13 },
  input: { backgroundColor: theme.bg, color: theme.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, borderWidth: 1, borderColor: theme.panelLight },
  error: { backgroundColor: 'rgba(255,77,77,0.18)', borderColor: theme.danger, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10 },
  errorText: { color: '#ffd0d0', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
