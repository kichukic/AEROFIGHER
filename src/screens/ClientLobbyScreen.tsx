import { ScrollView, Text, View } from 'react-native';
import { clientSetup, leaveToHome, useApp } from '../store/app';
import { MODE_LABEL, PlanePicker, PlayerList, TeamPicker } from './common';
import { isTeamMode } from '../sim/types';
import { MAPS } from '../sim/maps';
import { Button, Panel, styles, theme, Title } from './ui';

export function ClientLobbyScreen() {
  const client = useApp((s) => s.client);
  const lobby = useApp((s) => s.lobby);

  if (!client || !lobby) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.text}>Waiting for lobby…</Text>
      </View>
    );
  }
  const me = lobby.players.find((p) => p.id === client.id);
  const cfg = lobby.config;
  const modeLabel = MODE_LABEL[cfg.mode];
  const limit = cfg.mode === 'ctf' ? `${cfg.captureLimit} captures` : `${cfg.killLimit} kills`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
      <View>
        <Title>{lobby.hostName}’s game</Title>
        <Panel>
          <Text style={[styles.dim, { marginBottom: 8 }]}>
            {modeLabel} · {MAPS[cfg.map]?.label ?? cfg.map} · {cfg.timeLimit / 60} min · {limit}
          </Text>
          <PlayerList players={lobby.players} bots={lobby.bots} mode={cfg.mode} myId={client.id} />
        </Panel>
      </View>
      <View>
        <Title>Your plane</Title>
        {me ? (
          <>
            {isTeamMode(cfg.mode) ? <TeamPicker value={me.team} onChange={(team) => clientSetup({ team })} /> : null}
            <PlanePicker value={me.type} onChange={(type) => clientSetup({ type })} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="LEAVE" kind="danger" onPress={leaveToHome} style={{ flex: 1 }} />
              <Button
                title={me.ready ? 'READY ✓' : 'READY'}
                kind={me.ready ? 'secondary' : 'primary'}
                onPress={() => clientSetup({ ready: !me.ready })}
                style={{ flex: 2 }}
              />
            </View>
            {me.ready ? <Text style={[styles.dim, { marginTop: 8, color: theme.accent }]}>Waiting for the host to start…</Text> : null}
          </>
        ) : (
          <Text style={styles.dim}>Joining…</Text>
        )}
      </View>
    </ScrollView>
  );
}
