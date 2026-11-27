import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { getLocalIp } from '../net/localIp';
import { MAX_PLAYERS } from '../net/protocol';
import { hostStartMatch, leaveToHome, setPlaneType, useApp } from '../store/app';
import { LimitPicker, MapPicker, MODE_OPTIONS, PlanePicker, PlayerList, TeamPicker, TIME_OPTIONS } from './common';
import { isTeamMode } from '../sim/types';
import { Button, ErrorBanner, Panel, Segmented, styles, theme, Title } from './ui';

export function HostLobbyScreen() {
  const host = useApp((s) => s.host);
  const lobby = useApp((s) => s.lobby);
  const error = useApp((s) => s.error);
  const [ip, setIp] = useState<string | null>(null);

  useEffect(() => {
    getLocalIp().then(setIp);
  }, []);

  if (!host || !lobby) return null;
  const me = lobby.players.find((p) => p.id === 'host')!;
  const humans = lobby.players.length;
  const allReady = lobby.players.every((p) => p.ready);
  const cfg = lobby.config;

  const handleStart = () => {
    if (humans + lobby.bots < 2) {
      host.setBots(1);
    }
    hostStartMatch();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
      <View>
        <Title>Hosting: {lobby.hostName}</Title>
        <ErrorBanner message={error} />
        <Panel style={{ marginBottom: 12 }}>
          <Text style={styles.label}>Players ({humans}/{MAX_PLAYERS})</Text>
          <PlayerList players={lobby.players} bots={lobby.bots} mode={cfg.mode} myId="host" />
          <View style={{ marginTop: 10, backgroundColor: theme.panelLight, borderRadius: 8, padding: 10 }}>
            <Text style={[styles.text, { fontSize: 13, fontWeight: '700', color: theme.accent }]}>
              📡 Hotspot Hosting Guide
            </Text>
            <Text style={[styles.dim, { fontSize: 12, marginTop: 4 }]}>
              1. Turn on this phone’s Personal Hotspot.
            </Text>
            <Text style={[styles.dim, { fontSize: 12, marginTop: 2 }]}>
              2. Friends connect to this hotspot & open Join Game.
            </Text>
            <Text style={[styles.text, { fontSize: 12, marginTop: 4, color: theme.text }]}>
              {ip ? `Your IP: ${ip}` : 'Hotspot Host IP: 192.168.43.1 (default Android) or 172.20.10.1 (iOS)'}
            </Text>
          </View>
        </Panel>
        <Panel>
          <Segmented label="Mode" value={cfg.mode} onChange={(mode) => host.setConfig({ mode })} options={MODE_OPTIONS} />
          <Segmented label="Time limit" value={cfg.timeLimit} onChange={(timeLimit) => host.setConfig({ timeLimit })} options={TIME_OPTIONS} />
          <LimitPicker mode={cfg.mode} killLimit={cfg.killLimit} captureLimit={cfg.captureLimit} onChange={(c) => host.setConfig(c)} />
          <MapPicker value={cfg.map} onChange={(map) => host.setConfig({ map })} />
          <Segmented
            label="Bots"
            value={lobby.bots}
            onChange={(n) => host.setBots(n)}
            options={Array.from({ length: MAX_PLAYERS - humans + 1 }, (_, n) => ({ value: n, label: String(n) }))}
          />
        </Panel>
      </View>
      <View>
        <Title>Your plane</Title>
        {isTeamMode(cfg.mode) ? <TeamPicker value={me.team} onChange={(team) => host.setHostSetup({ team })} /> : null}
        <PlanePicker
          value={me.type}
          onChange={(type) => {
            setPlaneType(type);
            host.setHostSetup({ type });
          }}
        />
        {!allReady ? <Text style={[styles.dim, { marginBottom: 8, color: theme.accent }]}>Waiting for all players to be ready…</Text> : null}
        {humans === 1 && lobby.bots === 0 ? (
          <Text style={[styles.dim, { marginBottom: 8, color: theme.accent }]}>
            Tip: Press Start to launch with bots, or wait for friends to join.
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="CLOSE" kind="danger" onPress={leaveToHome} style={{ flex: 1 }} />
          <Button
            title="START BATTLE"
            disabled={!allReady}
            onPress={handleStart}
            style={{ flex: 2 }}
          />
        </View>
      </View>
    </ScrollView>
  );
}
