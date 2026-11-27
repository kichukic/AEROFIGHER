import { StyleSheet, Text, View } from 'react-native';
import { PLANES } from '../sim/planes';
import { isTeamMode, Weapon } from '../sim/types';
import { GameSession } from './session';
import { COLORS } from './render';

export interface KillFeedItem {
  key: string;
  killer: string | null;
  victim: string;
  weapon: Weapon;
  mine: boolean;
  at: number;
  text?: string;
}

const WEAPON_ICON: Record<Weapon, string> = { gun: '✦', missile: '➶', zone: '☠', crash: '✸', flak: '✺' };

function fmtTime(s: number) {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export interface AccoladeItem {
  title: string;
  subtitle?: string;
  color?: string;
}

/** Text overlay; re-rendered ~10x/second via `tick`. */
export function Hud({ session, feed, accolade }: { session: GameSession; feed: KillFeedItem[]; tick: number; accolade?: AccoladeItem | null }) {
  const w = session.world;
  const me = w.planes.find((p) => p.id === session.myId);
  const stats = me ? PLANES[me.type] : null;
  const remaining = w.config.timeLimit - w.time;
  const ping = session.ping();

  let score: React.ReactNode;
  if (isTeamMode(w.config.mode)) {
    score = (
      <View style={styles.row}>
        <Text style={[styles.score, { color: COLORS.team[0] }]}>{w.teamScores[0]}</Text>
        <Text style={styles.scoreSep}> : </Text>
        <Text style={[styles.score, { color: COLORS.team[1] }]}>{w.teamScores[1]}</Text>
        <Text style={styles.scoreSmall}>  / {w.config.mode === 'ctf' ? `${w.config.captureLimit} caps` : w.config.killLimit}</Text>
      </View>
    );
  } else {
    const leader = Math.max(0, ...w.planes.map((p) => p.kills));
    score = (
      <Text style={styles.scoreSmall}>
        You {me?.kills ?? 0} · Lead {leader} / {w.config.killLimit}
      </Text>
    );
  }

  let center: string | null = null;
  if (w.ended) {
    if (isTeamMode(w.config.mode)) center = w.winnerTeam === null ? 'DRAW!' : w.winnerTeam === me?.team ? 'VICTORY!' : 'DEFEAT';
    else center = w.winner === session.myId ? 'VICTORY!' : w.winner ? `${w.planes.find((p) => p.id === w.winner)?.name} WINS` : 'DRAW!';
  } else if (me && !me.alive) {
    center = `SHOT DOWN — respawning in ${Math.max(0, Math.ceil(me.respawnAt - w.time))}`;
  }
  const outOfZone = !!me?.alive && me.outOfBoundsTime > 0;

  // CTF status line
  let flagMsg: { text: string; color: string } | null = null;
  if (w.config.mode === 'ctf' && me && w.flags.length === 2) {
    const own = w.flags[me.team];
    const enemy = w.flags[1 - me.team];
    if (enemy.carrier === me.id) {
      flagMsg = own.carrier || own.droppedAt !== null
        ? { text: '⚑ You have the flag — get YOUR flag back to score!', color: '#ffd23f' }
        : { text: '⚑ You have the flag! Fly back to your base!', color: '#ffd23f' };
    } else if (own.carrier) {
      flagMsg = { text: '⚠ Your flag was stolen! Shoot down the carrier!', color: '#ff8080' };
    } else if (own.droppedAt !== null) {
      flagMsg = { text: 'Your flag is dropped — touch it to return it', color: '#ffb3b3' };
    } else if (enemy.carrier) {
      flagMsg = { text: 'Your team has the enemy flag — escort them home!', color: '#b3ffcc' };
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Top-left: health & tactical telemetry */}
      {me && stats ? (
        <View style={styles.status}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.statusLabel}>[ TAC // {stats.label.toUpperCase()} ]</Text>
            {me.streak >= 2 ? (
              <View style={styles.comboBadge}>
                <Text style={styles.comboText}>🔥 x{me.streak}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.hpBar}>
            <View style={[styles.hpFill, { width: `${Math.max(0, (me.hp / stats.hp) * 100)}%`, backgroundColor: me.hp / stats.hp < 0.35 ? '#ff2a4a' : '#00f5d4' }]} />
            {w.time < me.shieldUntil ? (
              <View style={[styles.shieldFill, { width: `${Math.min(100, ((me.shieldUntil - w.time) / 6) * 100)}%` }]} />
            ) : null}
          </View>
          <View style={styles.row}>
            {w.time < me.shieldUntil ? <Text style={[styles.tag, { backgroundColor: '#00e5ff', color: '#04111d' }]}>SHIELD</Text> : null}
            {w.time < me.boostUntil ? <Text style={[styles.tag, { backgroundColor: '#c77dff', color: '#04111d' }]}>BOOST</Text> : null}
            {me.perk && w.time < me.perk.until ? (
              <Text style={[styles.tag, { backgroundColor: me.perk.kind === 'twin_vulcan' ? '#ff2a4a' : me.perk.kind === 'cluster_missile' ? '#ffd23f' : '#00e5ff', color: '#04111d' }]}>
                {me.perk.kind === 'twin_vulcan' ? 'VULCAN' : me.perk.kind === 'cluster_missile' ? 'CLUSTER' : me.perk.kind === 'overdrive' ? 'OVERDRIVE' : 'SHIELD'} {Math.ceil(me.perk.until - w.time)}s
              </Text>
            ) : null}
            <Text style={styles.statusSmall}>K {me.kills}  D {me.deaths}</Text>
          </View>
        </View>
      ) : null}

      {/* Under the health bar: timer + score */}
      <View style={styles.top}>
        <Text style={styles.timer}>{fmtTime(remaining)}</Text>
        {score}
      </View>

      {/* Right: kill feed (under minimap) */}
      <View style={styles.feed}>
        {feed.map((f) => (
          <Text key={f.key} style={[styles.feedItem, f.mine && styles.feedMine]}>
            {f.text ?? (f.killer ? `${f.killer} ${WEAPON_ICON[f.weapon]} ${f.victim}` : `${f.victim} ${WEAPON_ICON[f.weapon]}`)}
          </Text>
        ))}
      </View>

      {center ? (
        <View style={styles.centerWrap}>
          <Text style={[styles.center, w.ended && { fontSize: 40 }]}>{center}</Text>
        </View>
      ) : null}
      {outOfZone ? (
        <View style={styles.warnWrap}>
          <Text style={styles.warn}>⚠ RETURN TO THE COMBAT ZONE ⚠</Text>
        </View>
      ) : null}

      {flagMsg ? (
        <View style={styles.flagWrap}>
          <Text style={[styles.flag, { color: flagMsg.color }]}>{flagMsg.text}</Text>
        </View>
      ) : null}

      {accolade ? (
        <View style={styles.accoladeWrap}>
          <View style={[styles.accoladeCard, { borderColor: accolade.color ?? '#ffd23f' }]}>
            <Text style={[styles.accoladeTitle, { color: accolade.color ?? '#ffd23f' }]}>{accolade.title}</Text>
            {accolade.subtitle ? <Text style={styles.accoladeSub}>{accolade.subtitle}</Text> : null}
          </View>
        </View>
      ) : null}

      {ping !== null ? <Text style={styles.ping}>{ping} ms</Text> : null}
    </View>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3, textShadowOffset: { width: 1, height: 1 } };

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  status: { position: 'absolute', top: 10, left: 58, width: 150 },
  statusLabel: { color: 'white', fontWeight: '900', fontSize: 12, ...shadow },
  statusSmall: { color: 'white', fontWeight: '700', fontSize: 11, marginTop: 3, ...shadow },
  hpBar: { height: 10, borderRadius: 5, backgroundColor: 'rgba(5, 12, 24, 0.75)', borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.35)', marginTop: 3, overflow: 'hidden', position: 'relative' },
  hpFill: { height: 10 },
  shieldFill: { position: 'absolute', top: 0, left: 0, height: 10, backgroundColor: 'rgba(0, 229, 255, 0.55)', borderBottomWidth: 2, borderBottomColor: '#ffffff' },
  comboBadge: { backgroundColor: 'rgba(255, 183, 3, 0.25)', borderColor: '#ffb703', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  comboText: { color: '#ffb703', fontWeight: '900', fontSize: 10, letterSpacing: 0.8 },
  tag: { color: '#04111d', fontSize: 10, fontWeight: '900', paddingHorizontal: 5, borderRadius: 4, marginRight: 4, marginTop: 3, overflow: 'hidden' },
  top: { position: 'absolute', top: 68, left: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  timer: { color: '#00e5ff', fontSize: 22, fontWeight: '900', letterSpacing: 1.2, ...shadow },
  score: { fontSize: 22, fontWeight: '900', ...shadow },
  scoreSep: { color: 'white', fontSize: 20, fontWeight: '900', ...shadow },
  scoreSmall: { color: '#e0e6ed', fontSize: 13, fontWeight: '800', ...shadow },
  feed: { position: 'absolute', top: 104, right: 12, alignItems: 'flex-end', maxWidth: '70%' },
  feedItem: { color: 'white', fontSize: 11, fontWeight: '700', backgroundColor: 'rgba(5, 12, 24, 0.75)', borderLeftWidth: 2.5, borderLeftColor: '#00e5ff', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, marginBottom: 3, overflow: 'hidden' },
  feedMine: { backgroundColor: 'rgba(255,210,63,0.3)', borderLeftColor: '#ffd23f', color: '#ffd23f' },
  centerWrap: { position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center' },
  center: { color: 'white', fontSize: 22, fontWeight: '900', textAlign: 'center', paddingHorizontal: 16, letterSpacing: 1.5, ...shadow },
  warnWrap: { position: 'absolute', top: '30%', left: 12, right: 12, alignItems: 'center' },
  warn: { color: '#ffffff', backgroundColor: 'rgba(220,20,50,0.75)', borderColor: '#ff2a4a', borderWidth: 1.5, fontSize: 15, fontWeight: '900', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, letterSpacing: 1, overflow: 'hidden' },
  flagWrap: { position: 'absolute', top: '24%', left: 12, right: 12, alignItems: 'center' },
  flag: { fontSize: 14, fontWeight: '900', backgroundColor: 'rgba(5, 12, 24, 0.75)', borderColor: '#00e5ff', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  accoladeWrap: { position: 'absolute', top: '15%', left: 0, right: 0, alignItems: 'center' },
  accoladeCard: { backgroundColor: 'rgba(5, 12, 24, 0.94)', borderWidth: 2.5, borderRadius: 14, paddingHorizontal: 26, paddingVertical: 12, alignItems: 'center', shadowColor: '#00e5ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 10, elevation: 10 },
  accoladeTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 1.5, ...shadow },
  accoladeSub: { color: '#e0e6ed', fontSize: 12, fontWeight: '700', marginTop: 3, ...shadow },
  ping: { position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 11 },
});
