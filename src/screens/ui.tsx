import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

export const theme = {
  bg: '#060c18',
  bgCard: '#0b172a',
  panel: '#0e1f38',
  panelLight: '#162e52',
  panelBorder: '#1c3d6c',
  accent: '#ffd23f',
  accentGlow: 'rgba(255, 210, 63, 0.22)',
  cyan: '#00f5d4',
  cyanGlow: 'rgba(0, 245, 212, 0.2)',
  orange: '#ff9f1c',
  text: '#ffffff',
  textMuted: '#cbd5e1',
  dim: '#7e97b8',
  danger: '#ff3b5c',
  ok: '#10b981',
  blue: '#3b82f6',
  red: '#ef4444',
};

export function Button({
  title,
  onPress,
  disabled,
  kind = 'primary',
  style,
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: 'primary' | 'secondary' | 'danger' | 'cyan' | 'ghost';
  style?: ViewStyle;
  icon?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        kind === 'secondary' && styles.btnSecondary,
        kind === 'danger' && styles.btnDanger,
        kind === 'cyan' && styles.btnCyan,
        kind === 'ghost' && styles.btnGhost,
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.85 },
        disabled && { opacity: 0.35 },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {icon ? <Text style={{ fontSize: 16 }}>{icon}</Text> : null}
        <Text
          style={[
            styles.btnText,
            kind === 'secondary' && { color: theme.text },
            kind === 'danger' && { color: '#ffffff' },
            kind === 'cyan' && { color: '#04111d' },
            kind === 'ghost' && { color: theme.dim },
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

/** Arcade-style Tactical Action Card for main menu and lobbies */
export function ActionCard({
  title,
  badge,
  badgeColor = theme.accent,
  description,
  icon,
  accentColor = theme.accent,
  onPress,
  disabled,
  busy,
  ctaText = 'LAUNCH ›',
}: {
  title: string;
  badge?: string;
  badgeColor?: string;
  description: string;
  icon: string;
  accentColor?: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  ctaText?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.actionCard,
        {
          borderColor: pressed ? accentColor : 'rgba(255,255,255,0.12)',
          backgroundColor: pressed ? 'rgba(22,46,82,0.95)' : theme.panel,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <View style={[styles.cardCornerPip, { backgroundColor: accentColor }]} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={[styles.cardIconBox, { borderColor: accentColor, backgroundColor: 'rgba(0,0,0,0.3)' }]}>
          <Text style={{ fontSize: 26 }}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
            {badge ? (
              <View style={[styles.badge, { borderColor: badgeColor, backgroundColor: 'rgba(0,0,0,0.4)' }]}>
                <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardDesc} numberOfLines={2}>
            {description}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
          {busy ? (
            <ActivityIndicator color={accentColor} />
          ) : (
            <View style={[styles.cardCtaPill, { borderColor: accentColor }]}>
              <Text style={[styles.cardCtaText, { color: accentColor }]}>{ctaText}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/** Row of mutually exclusive options. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
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
              style={[
                styles.segItem,
                active && { backgroundColor: o.color ?? theme.accent, shadowColor: o.color ?? theme.accent, shadowOpacity: 0.3, shadowRadius: 6 },
              ]}
            >
              <Text style={[styles.segText, active && { color: o.color ? theme.text : '#0b1320', fontWeight: '900' }]}>{o.label}</Text>
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
      <Text style={styles.errorText}>⚠️ {message}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  title: { color: theme.accent, fontSize: 24, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12, textTransform: 'uppercase' },
  label: { color: theme.cyan, fontSize: 11, fontWeight: '800', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' },
  text: { color: theme.text, fontSize: 14 },
  dim: { color: theme.dim, fontSize: 13, lineHeight: 18 },
  panel: { backgroundColor: theme.panel, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.panelBorder },
  btn: {
    backgroundColor: theme.accent,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.accent,
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  btnSecondary: { backgroundColor: theme.panelLight, borderWidth: 1, borderColor: theme.panelBorder, shadowOpacity: 0 },
  btnDanger: { backgroundColor: theme.danger, shadowColor: theme.danger },
  btnCyan: { backgroundColor: theme.cyan, shadowColor: theme.cyan },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', shadowOpacity: 0 },
  btnText: { color: '#09121f', fontWeight: '900', fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' },
  actionCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    position: 'relative',
    overflow: 'hidden',
  },
  cardCornerPip: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 24,
    height: 3,
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardDesc: {
    color: theme.dim,
    fontSize: 12,
    lineHeight: 16,
  },
  cardCtaPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardCtaText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  segWrap: { marginBottom: 12 },
  seg: { flexDirection: 'row', backgroundColor: '#050a14', borderRadius: 10, padding: 3, flexWrap: 'wrap', borderWidth: 1, borderColor: theme.panelBorder },
  segItem: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8 },
  segText: { color: theme.dim, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  input: {
    backgroundColor: '#050a14',
    color: theme.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: theme.panelBorder,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  error: {
    backgroundColor: 'rgba(255,59,92,0.15)',
    borderColor: theme.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: '#ffb3c0', fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
