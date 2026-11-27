import { Pressable, ScrollView, Text, View } from 'react-native';
import { PLANES, PLANE_TYPES, SPECIALS } from '../sim/planes';
import { MAP_IDS, MAPS } from '../sim/maps';
import { GameMode, isTeamMode, MapId, PlaneType } from '../sim/types';
import { LobbyPlayer } from '../net/protocol';
import { Segmented, styles, theme } from './ui';
import { PlaneCanvas } from './PlaneCanvas';
import { playSfx } from '../game/audio';
import { useApp } from '../store/app';

const PLANE_COLORS: Record<PlaneType, string> = {
  interceptor: '#00e5ff',
  fighter: '#ffd23f',
  bomber: '#ff3b3b',
  stealth: '#c084fc',
  gunship: '#10b981',
};

export function PlanePicker({ value, onChange }: { value: PlaneType; onChange: (t: PlaneType) => void }) {
  const sound = useApp((s) => s.sound);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}
      style={{ marginBottom: 10, flexGrow: 0 }}
    >
      {PLANE_TYPES.map((t) => {
        const s = PLANES[t];
        const active = t === value;
        const color = PLANE_COLORS[t];
        return (
          <Pressable
            key={t}
            onPress={() => {
              if (sound && t !== value) playSfx('pickup', 0.5);
              onChange(t);
            }}
            style={{
              width: 110,
              padding: 8,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: active ? color : 'rgba(255,255,255,0.12)',
              backgroundColor: active ? 'rgba(12, 27, 51, 0.95)' : '#071224',
              shadowColor: active ? color : 'transparent',
              shadowOpacity: active ? 0.4 : 0,
              shadowRadius: 10,
              alignItems: 'center',
            }}
          >
            {/* Plane Skia Visual Graphic */}
            <View style={{ height: 72, width: 72, alignItems: 'center', justifyContent: 'center', marginVertical: 2 }}>
              <PlaneCanvas type={t} color={color} size={68} animated={active} showHangarRing={active} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 2 }}>
              <Text style={{ color: active ? color : theme.text, fontWeight: '900', fontSize: 12, letterSpacing: 0.5 }}>
                {s.label.toUpperCase()}
              </Text>
            </View>
            <Text style={{ color: '#94a3b8', fontSize: 9, textAlign: 'center', marginBottom: 4 }} numberOfLines={1}>
              {s.description}
            </Text>

            <View style={{ width: '100%', gap: 3, marginTop: 2 }}>
              <Stat label="SPD" v={s.maxSpeed / 280} color={color} />
              <Stat label="AGI" v={s.turnRate / 3.6} color={color} />
              <Stat label="HP" v={s.hp / 160} color={color} />
              <Stat label="DMG" v={(s.bulletDamage / s.fireInterval) / 75} color={color} />
            </View>

            <View
              style={{
                width: '100%',
                marginTop: 6,
                paddingVertical: 3,
                paddingHorizontal: 4,
                borderRadius: 6,
                backgroundColor: active ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: active ? color : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: active ? color : theme.dim, fontSize: 9, fontWeight: '900' }}>
                {SPECIALS[t].label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Stat({ label, v, color }: { label: string; v: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color: '#94a3b8', fontSize: 8, width: 24, fontWeight: '800' }}>{label}</Text>
      <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <View
          style={{
            width: `${Math.min(1, Math.max(0, v)) * 100}%`,
            height: 4,
            backgroundColor: color ?? theme.accent,
            borderRadius: 2,
          }}
        />
      </View>
    </View>
  );
}

export function TeamPicker({ value, onChange }: { value: number; onChange: (t: number) => void }) {
  return (
    <Segmented
      label="Team"
      value={value}
      onChange={onChange}
      options={[
        { value: 0, label: 'BLUE', color: theme.blue },
        { value: 1, label: 'RED', color: theme.red },
      ]}
    />
  );
}

export function PlayerList({ players, bots, mode, myId }: { players: LobbyPlayer[]; bots: number; mode: GameMode; myId: string }) {
  return (
    <View style={{ gap: 6 }}>
      {players.map((p) => (
        <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, borderRadius: 8, padding: 8 }}>
          {isTeamMode(mode) ? (
            <View style={{ width: 10, height: 10, borderRadius: 5, marginRight: 8, backgroundColor: p.team === 0 ? theme.blue : theme.red }} />
          ) : null}
          <Text style={[styles.text, { flex: 1, fontWeight: p.id === myId ? '900' : '500' }]}>
            {p.name}
            {p.isHost ? '  (host)' : ''}
            {p.id === myId ? '  (you)' : ''}
          </Text>
          <Text style={[styles.dim, { marginRight: 10 }]}>{PLANES[p.type].label}</Text>
          <Text style={{ color: p.ready ? theme.ok : theme.dim, fontWeight: '800', fontSize: 12 }}>{p.ready ? 'READY' : 'NOT READY'}</Text>
        </View>
      ))}
      {bots > 0 ? <Text style={styles.dim}>+ {bots} bot{bots > 1 ? 's' : ''}</Text> : null}
    </View>
  );
}

export const TIME_OPTIONS = [
  { value: 180, label: '3 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
];
export const KILL_OPTIONS = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
];
export const MODE_OPTIONS: { value: GameMode; label: string }[] = [
  { value: 'ffa', label: 'FREE-FOR-ALL' },
  { value: 'tdm', label: 'TEAM DM' },
  { value: 'ctf', label: 'CAPTURE FLAG' },
];
export const CAPTURE_OPTIONS = [
  { value: 3, label: '3' },
  { value: 5, label: '5' },
  { value: 7, label: '7' },
];
export const MODE_LABEL: Record<GameMode, string> = { ffa: 'Free-for-all', tdm: 'Team Deathmatch', ctf: 'Capture the Flag' };

const MAP_ICONS: Record<MapId, string> = {
  farmland: 'SEC 01',
  ocean: 'SEC 02',
  desert: 'SEC 03',
  arctic: 'SEC 04',
  canyon: 'SEC 05',
  night: 'SEC 06',
  mountain: 'SEC 07',
  forest: 'SEC 08',
  city: 'SEC 09',
};

export function MapPicker({ value, onChange }: { value: MapId; onChange: (m: MapId) => void }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>Airspace</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {MAP_IDS.map((id) => {
          const m = MAPS[id];
          const active = id === value;
          return (
            <Pressable
              key={id}
              onPress={() => onChange(id)}
              style={{
                width: 92, padding: 6, borderRadius: 8, borderWidth: 2,
                borderColor: active ? theme.accent : 'transparent', backgroundColor: m.palette.sky,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '900', color: active ? theme.accent : theme.cyan, marginBottom: 2 }}>{MAP_ICONS[id] ?? 'ZONE'}</Text>
              <Text style={{ color: id === 'night' || id === 'canyon' ? '#fff' : '#111', fontWeight: '900', fontSize: 11 }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.dim, { fontSize: 11, marginTop: 4 }]}>{MAPS[value].description}</Text>
    </View>
  );
}

/** Mode-dependent match limit picker (kills, or captures for CTF). */
export function LimitPicker({ mode, killLimit, captureLimit, onChange }: {
  mode: GameMode;
  killLimit: number;
  captureLimit: number;
  onChange: (c: { killLimit?: number; captureLimit?: number }) => void;
}) {
  if (mode === 'ctf') {
    return <Segmented label="Captures to win" value={captureLimit} onChange={(v) => onChange({ captureLimit: v })} options={CAPTURE_OPTIONS} />;
  }
  return <Segmented label="Kill limit" value={killLimit} onChange={(v) => onChange({ killLimit: v })} options={KILL_OPTIONS} />;
}
