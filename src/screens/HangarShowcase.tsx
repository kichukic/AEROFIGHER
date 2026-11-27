import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { PLANES, PLANE_TYPES, SPECIALS } from '../sim/planes';
import { PlaneType } from '../sim/types';
import { PlaneCanvas } from './PlaneCanvas';
import { theme } from './ui';
import { playSfx } from '../game/audio';
import { useApp } from '../store/app';

interface HangarShowcaseProps {
  selectedType: PlaneType;
  onSelect: (type: PlaneType) => void;
  compact?: boolean;
  style?: ViewStyle;
}

export const PLANE_LORE: Record<PlaneType, { codename: string; role: string; color: string; code: string }> = {
  interceptor: {
    codename: 'SWIFT JUSTICE',
    role: 'SUPERSONIC DELTA INTERCEPTOR',
    color: '#00e5ff',
    code: 'INT',
  },
  fighter: {
    codename: 'GLADIUS-22',
    role: 'AIR SUPERIORITY STRIKE FIGHTER',
    color: '#ffd23f',
    code: 'FTR',
  },
  bomber: {
    codename: 'IRON CLAD',
    role: 'HEAVY ARMORED BATTLECRUISER',
    color: '#ff3b3b',
    code: 'BMB',
  },
  stealth: {
    codename: 'SHADOW-X',
    role: 'TACTICAL STEALTH INFILTRATOR',
    color: '#c084fc',
    code: 'STL',
  },
  gunship: {
    codename: 'WARTHOG-30',
    role: 'CLOSE AIR SUPPORT TITAN',
    color: '#10b981',
    code: 'GSH',
  },
};

export function HangarShowcase({ selectedType, onSelect, compact = false, style }: HangarShowcaseProps) {
  const sound = useApp((s) => s.sound);
  const current = PLANES[selectedType];
  const lore = PLANE_LORE[selectedType];
  const special = SPECIALS[selectedType];

  const handleSelect = (t: PlaneType) => {
    if (sound && t !== selectedType) {
      playSfx('pickup', 0.5);
    }
    onSelect(t);
  };

  const handleNext = () => {
    const idx = PLANE_TYPES.indexOf(selectedType);
    const nextIdx = (idx + 1) % PLANE_TYPES.length;
    handleSelect(PLANE_TYPES[nextIdx]);
  };

  const handlePrev = () => {
    const idx = PLANE_TYPES.indexOf(selectedType);
    const prevIdx = (idx - 1 + PLANE_TYPES.length) % PLANE_TYPES.length;
    handleSelect(PLANE_TYPES[prevIdx]);
  };

  return (
    <View style={[styles.container, { borderColor: lore.color }, style]}>
      {/* Corner HUD Brackets */}
      <View style={[styles.cornerTL, { borderColor: lore.color }]} pointerEvents="none" />
      <View style={[styles.cornerTR, { borderColor: lore.color }]} pointerEvents="none" />
      <View style={[styles.cornerBL, { borderColor: lore.color }]} pointerEvents="none" />
      <View style={[styles.cornerBR, { borderColor: lore.color }]} pointerEvents="none" />

      {/* Top Header & Bay ID */}
      <View style={styles.topHeader}>
        <View style={styles.bayBadge}>
          <Text style={[styles.bayText, { color: lore.color }]}>HANGAR BAY 01 // {lore.code}</Text>
        </View>
        <Text style={styles.subCallout}>MSL {current.missiles} • COMBAT READY</Text>
      </View>

      {/* Plane Type Selection Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
        style={{ marginBottom: 6, flexGrow: 0 }}
      >
        {PLANE_TYPES.map((t) => {
          const active = t === selectedType;
          const tLore = PLANE_LORE[t];
          return (
            <Pressable
              key={t}
              onPress={() => handleSelect(t)}
              style={({ pressed }) => [
                styles.tabBtn,
                active ? [styles.tabBtnActive, { borderColor: tLore.color, backgroundColor: 'rgba(12, 27, 51, 0.95)' }] : styles.tabBtnInactive,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={[styles.codeBadge, { color: active ? tLore.color : '#64748b' }]}>{tLore.code}</Text>
              <Text
                style={[
                  styles.tabBtnText,
                  active ? { color: tLore.color, fontWeight: '900' } : { color: '#94a3b8' },
                ]}
              >
                {t.toUpperCase()}
              </Text>
              {active && <View style={[styles.tabActivePip, { backgroundColor: tLore.color }]} />}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Main Aircraft Viewport with Nav Arrows */}
      <View style={styles.viewport}>
        <Pressable
          onPress={handlePrev}
          style={({ pressed }) => [styles.navArrowBtn, pressed && { opacity: 0.6 }]}
          hitSlop={12}
        >
          <Text style={styles.navArrowText}>◀</Text>
        </Pressable>

        <View style={styles.canvasContainer}>
          <PlaneCanvas
            type={selectedType}
            color={lore.color}
            size={compact ? 95 : 125}
            animated={true}
            showHangarRing={true}
          />
        </View>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [styles.navArrowBtn, pressed && { opacity: 0.6 }]}
          hitSlop={12}
        >
          <Text style={styles.navArrowText}>▶</Text>
        </Pressable>
      </View>

      {/* Aircraft Codename & Lore */}
      <View style={styles.titleBlock}>
        <Text style={[styles.planeCodename, { color: lore.color }]}>{lore.codename}</Text>
        <Text style={styles.planeRole}>{lore.role}</Text>
      </View>

      {/* Arcade Tactical Stat Meters (2x2 Grid) */}
      <View style={styles.statsContainer}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <StatMeter label="SPD" value={current.maxSpeed / 280} text={`${current.maxSpeed} KT`} color={lore.color} />
          </View>
          <View style={{ flex: 1 }}>
            <StatMeter label="AGI" value={current.turnRate / 3.6} text={`${current.turnRate.toFixed(1)} RAD`} color={lore.color} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <StatMeter label="ARM" value={current.hp / 160} text={`${current.hp} HP`} color={lore.color} />
          </View>
          <View style={{ flex: 1 }}>
            <StatMeter
              label="PWR"
              value={(current.bulletDamage / current.fireInterval) / 75}
              text={`${Math.round(current.bulletDamage / current.fireInterval)} DPS`}
              color={lore.color}
            />
          </View>
        </View>
      </View>

      {/* Special Weapon Tactical Chip */}
      <View style={[styles.specialChip, { borderColor: lore.color }]}>
        <Text style={[styles.specialTag, { color: lore.color }]}>[SPEC]</Text>
        <Text style={[styles.specialLabel, { color: lore.color }]}>
          {special.label}:
        </Text>
        <Text style={styles.specialDesc} numberOfLines={1}>
          {special.description}
        </Text>
        <Text style={styles.specialCooldown}>{special.cooldown}S</Text>
      </View>
    </View>
  );
}

function StatMeter({
  label,
  value,
  text,
  color,
}: {
  label: string;
  value: number;
  text: string;
  color: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const segments = 7;
  const filled = Math.round(clamped * segments);

  return (
    <View style={statStyles.row}>
      <Text style={statStyles.label}>{label}</Text>
      <View style={statStyles.barContainer}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={[
              statStyles.segment,
              i < filled ? { backgroundColor: color, shadowColor: color, shadowOpacity: 0.5, shadowRadius: 3 } : statStyles.emptySegment,
            ]}
          />
        ))}
      </View>
      <Text style={[statStyles.valueText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(7, 18, 36, 0.84)',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#00e5ff',
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  cornerTL: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    opacity: 0.65,
  },
  cornerTR: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
    opacity: 0.65,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 10,
    height: 10,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    opacity: 0.65,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 10,
    height: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    opacity: 0.65,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  bayText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  subCallout: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1.5,
    position: 'relative',
  },
  tabBtnActive: {
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  tabBtnInactive: {
    backgroundColor: '#0b1628',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tabActivePip: {
    position: 'absolute',
    bottom: -1,
    left: '25%',
    right: '25%',
    height: 2,
    borderRadius: 1,
  },
  viewport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  canvasContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: 10,
  },
  planeCodename: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  planeRole: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  statsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  specialChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  specialIconBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBadge: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginRight: 2,
  },
  specialTag: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  specialLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  specialCooldown: {
    color: theme.dim,
    fontSize: 9,
    fontWeight: '800',
  },
  specialDesc: {
    color: '#cbd5e1',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 1,
  },
});

const statStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '900',
    width: 30,
    letterSpacing: 0.5,
  },
  barContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 2,
  },
  emptySegment: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  valueText: {
    fontSize: 10,
    fontWeight: '900',
    width: 50,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
});
