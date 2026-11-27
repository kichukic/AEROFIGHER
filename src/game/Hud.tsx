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

/** Text overlay; re-rendered ~10x/second via `tick`. */
export function Hud({ session, feed }: { session: GameSession; feed: KillFeedItem[]; tick: number }) {
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
      {/* Top-left: health */}
      {me && stats ? (
        <View style={styles.status}>
          <Text style={styles.statusLabel}>{stats.label.toUpperCase()}</Text>
          <View style={styles.hpBar}>
            <View style={[styles.hpFill, { width: `${Math.max(0, (me.hp / stats.hp) * 100)}%`, backgroundColor: me.hp / stats.hp < 0.35 ? '#ff4d4d' : '#3ddc84' }]} />
          </View>
          <View style={styles.row}>
            {w.time < me.shieldUntil ? <Text style={[styles.tag, { backgroundColor: COLORS.pickup.shield }]}>SHIELD</Text> : null}
            {w.time < me.boostUntil ? <Text style={[styles.tag, { backgroundColor: COLORS.pickup.boost }]}>BOOST</Text> : null}
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
  hpBar: { height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.4)', marginTop: 3, overflow: 'hidden' },
  hpFill: { height: 10 },
  tag: { color: 'white', fontSize: 10, fontWeight: '900', paddingHorizontal: 5, borderRadius: 4, marginRight: 4, marginTop: 3, overflow: 'hidden' },
  top: { position: 'absolute', top: 62, left: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  timer: { color: 'white', fontSize: 22, fontWeight: '900', ...shadow },
  score: { fontSize: 22, fontWeight: '900', ...shadow },
  scoreSep: { color: 'white', fontSize: 20, fontWeight: '900', ...shadow },
  scoreSmall: { color: 'white', fontSize: 13, fontWeight: '800', ...shadow },
  feed: { position: 'absolute', top: 104, right: 12, alignItems: 'flex-end', maxWidth: '70%' },
  feedItem: { color: 'white', fontSize: 12, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 3, overflow: 'hidden' },
  feedMine: { backgroundColor: 'rgba(255,210,63,0.55)', color: '#111' },
  centerWrap: { position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center' },
  center: { color: 'white', fontSize: 22, fontWeight: '900', textAlign: 'center', paddingHorizontal: 16, ...shadow },
  warnWrap: { position: 'absolute', top: '30%', left: 12, right: 12, alignItems: 'center' },
  warn: { color: '#ffdddd', backgroundColor: 'rgba(200,0,0,0.55)', fontSize: 16, fontWeight: '900', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, overflow: 'hidden' },
  flagWrap: { position: 'absolute', top: '24%', left: 12, right: 12, alignItems: 'center' },
  flag: { fontSize: 14, fontWeight: '900', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  ping: { position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 11 },
});
