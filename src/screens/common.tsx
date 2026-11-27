import { Pressable, Text, View } from 'react-native';
import { PLANES, PLANE_TYPES, SPECIALS } from '../sim/planes';
import { MAP_IDS, MAPS } from '../sim/maps';
import { GameMode, isTeamMode, MapId, PlaneType } from '../sim/types';
import { LobbyPlayer } from '../net/protocol';
import { Segmented, styles, theme } from './ui';

const PLANE_ICONS: Record<PlaneType, string> = {
  interceptor: '⚡',
  fighter: '⚔️',
  bomber: '🛡️',
};

export function PlanePicker({ value, onChange }: { value: PlaneType; onChange: (t: PlaneType) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
      {PLANE_TYPES.map((t) => {
        const s = PLANES[t];
        const active = t === value;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            style={{
              flex: 1, padding: 10, borderRadius: 12, borderWidth: 2,
              borderColor: active ? theme.accent : 'rgba(255,255,255,0.08)',
              backgroundColor: active ? 'rgba(255,210,63,0.1)' : theme.panel,
              shadowColor: active ? theme.accent : 'transparent',
              shadowOpacity: active ? 0.3 : 0,
              shadowRadius: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ color: active ? theme.accent : theme.text, fontWeight: '900', fontSize: 13 }}>{s.label}</Text>
              <Text style={{ fontSize: 14 }}>{PLANE_ICONS[t]}</Text>
            </View>
            <Text style={[styles.dim, { fontSize: 10, marginBottom: 4 }]} numberOfLines={1}>{s.description}</Text>
            <Stat label="SPD" v={s.maxSpeed / 280} />
            <Stat label="TURN" v={s.turnRate / 5.2} />
            <Stat label="HP" v={s.hp / 160} />
            <Stat label="DMG" v={s.bulletDamage / s.fireInterval / 75} />
            <Text style={{ color: theme.cyan, fontSize: 10, fontWeight: '900', marginTop: 6 }}>{SPECIALS[t].label}</Text>
            <Text style={[styles.dim, { fontSize: 9 }]} numberOfLines={2}>{SPECIALS[t].description}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
      <Text style={{ color: theme.dim, fontSize: 9, width: 32, fontWeight: '700' }}>{label}</Text>
      <View style={{ flex: 1, height: 5, backgroundColor: theme.panelLight, borderRadius: 3 }}>
        <View style={{ width: `${Math.min(1, v) * 100}%`, height: 5, backgroundColor: theme.accent, borderRadius: 3 }} />
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

export function MapPicker({ value, onChange }: { value: MapId; onChange: (m: MapId) => void }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>Map</Text>
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
              <View style={{ flexDirection: 'row', gap: 3, height: 14, marginBottom: 2 }}>
                {m.obstacles.slice(0, 5).map((o, i) => (
                  <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.palette.rock, borderWidth: 1, borderColor: m.palette.rockEdge }} />
                ))}
              </View>
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
