import { ScrollView, Text, View } from 'react-native';
import { PLANES } from '../sim/planes';
import { backToLobby, go, leaveToHome, rematch, useApp } from '../store/app';
import { isTeamMode } from '../sim/types';
import { Button, Panel, styles, theme, Title } from './ui';

export function ResultsScreen() {
  const r = useApp((s) => s.results);
  if (!r) return null;
  const me = r.planes.find((p) => p.id === r.myId);

  let headline: string;
  if (isTeamMode(r.mode)) {
    headline = r.winnerTeam === null ? 'DRAW' : r.winnerTeam === me?.team ? 'VICTORY' : 'DEFEAT';
  } else {
    headline = r.winner === r.myId ? 'VICTORY' : r.winner ? `${r.planes.find((p) => p.id === r.winner)?.name} wins` : 'DRAW';
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
      <View>
        <Title>{headline}</Title>
        {isTeamMode(r.mode) ? (
          <Text style={[styles.text, { fontSize: 20, fontWeight: '900', marginBottom: 8 }]}>
            <Text style={{ color: theme.blue }}>BLUE {r.teamScores[0]}</Text>
            <Text> : </Text>
            <Text style={{ color: theme.red }}>{r.teamScores[1]} RED</Text>
          </Text>
        ) : null}
        <Panel>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Text style={[styles.label, { width: 22 }]}>#</Text>
            <Text style={[styles.label, { flex: 1 }]}>Pilot</Text>
            <Text style={[styles.label, { width: 72 }]}>Plane</Text>
            {r.mode === 'ctf' ? <Text style={[styles.label, { width: 34, textAlign: 'right' }]}>CAP</Text> : null}
            <Text style={[styles.label, { width: 34, textAlign: 'right' }]}>K</Text>
            <Text style={[styles.label, { width: 34, textAlign: 'right' }]}>D</Text>
          </View>
          {r.planes.map((p, i) => (
            <View key={p.id} style={{ flexDirection: 'row', paddingVertical: 5, backgroundColor: p.id === r.myId ? 'rgba(255,210,63,0.15)' : 'transparent', borderRadius: 6 }}>
              <Text style={[styles.text, { width: 22 }]}>{i + 1}</Text>
              <Text style={[styles.text, { flex: 1, fontWeight: '700', color: isTeamMode(r.mode) ? (p.team === 0 ? '#7da2ff' : '#ff8080') : theme.text }]}>
                {p.name}
              </Text>
              <Text style={[styles.dim, { width: 72 }]}>{PLANES[p.type].label}</Text>
              {r.mode === 'ctf' ? <Text style={[styles.text, { width: 34, textAlign: 'right', fontWeight: '900' }]}>{p.caps}</Text> : null}
              <Text style={[styles.text, { width: 34, textAlign: 'right', fontWeight: '900' }]}>{p.kills}</Text>
              <Text style={[styles.text, { width: 34, textAlign: 'right' }]}>{p.deaths}</Text>
            </View>
          ))}
        </Panel>
      </View>
      <View style={{ gap: 12 }}>
        {r.kind === 'solo' ? (
          <>
            <Button title="REMATCH" onPress={rematch} />
            <Button title="CHANGE SETTINGS" kind="secondary" onPress={() => go('solo')} />
          </>
        ) : r.kind === 'host' ? (
          <>
            <Button title="REMATCH (SAME PLAYERS)" onPress={rematch} />
            <Button title="BACK TO LOBBY" kind="secondary" onPress={backToLobby} />
          </>
        ) : (
          <>
            <Text style={[styles.dim, { textAlign: 'center' }]}>Waiting for the host… a rematch starts automatically.</Text>
            <Button title="BACK TO LOBBY" kind="secondary" onPress={backToLobby} />
          </>
        )}
        <Button title="MAIN MENU" kind="danger" onPress={leaveToHome} />
      </View>
    </ScrollView>
  );
}
