import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FoundGame, startScanner } from '../net/discovery';
import { getLocalIp } from '../net/localIp';
import { go, joinGame, useApp } from '../store/app';
import { Button, ErrorBanner, Panel, styles, theme, Title } from './ui';
import { MODE_LABEL } from './common';
import { GameMode } from '../sim/types';

export function JoinScreen() {
  const storeError = useApp((s) => s.error);
  const [games, setGames] = useState<FoundGame[]>([]);
  const [ip, setIp] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(storeError);
  const [myIp, setMyIp] = useState<string | null>(null);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    startScanner(setGames)
      .then((s) => {
        if (cancelled) s();
        else stop = s;
      })
      .catch((e) => setError('Discovery unavailable: ' + String(e?.message ?? e)));
    getLocalIp().then((a) => {
      setMyIp(a);
      // Pre-fill the most likely host address: the hotspot gateway (x.y.z.1).
      if (a) setIp((cur) => cur || a.split('.').slice(0, 3).join('.') + '.1');
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const connect = async (addr: string, port?: number) => {
    setBusy(addr);
    setError(null);
    try {
      await joinGame(addr, port);
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
      <View>
        <Title>Join a game</Title>
        <ErrorBanner message={error} />
        <Panel>
          <View style={[styles.row, { marginBottom: 8 }]}>
            <Text style={[styles.label, { flex: 1, marginBottom: 0 }]}>Games on this network</Text>
            <ActivityIndicator color={theme.accent} size="small" />
          </View>
          {games.length === 0 ? (
            <Text style={styles.dim}>Searching… Make sure you’re connected to the host’s hotspot.</Text>
          ) : (
            games.map((g) => (
              <Pressable
                key={g.ip}
                disabled={!g.open || !!busy}
                onPress={() => connect(g.ip, g.port)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', backgroundColor: pressed ? theme.panelLight : theme.bg,
                  borderRadius: 10, padding: 12, marginBottom: 6, opacity: g.open ? 1 : 0.5,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.text, { fontWeight: '900' }]}>{g.name}</Text>
                  <Text style={styles.dim}>
                    {MODE_LABEL[g.mode as GameMode] ?? g.mode} · {g.players}/{g.max} players · {g.ip}
                  </Text>
                </View>
                {busy === g.ip ? (
                  <ActivityIndicator color={theme.accent} />
                ) : (
                  <Text style={{ color: g.open ? theme.accent : theme.dim, fontWeight: '900' }}>{g.open ? 'JOIN ›' : 'IN MATCH'}</Text>
                )}
              </Pressable>
            ))
          )}
        </Panel>
      </View>
      <View>
        <Panel style={{ marginBottom: 12 }}>
          <Text style={styles.label}>Manual connect</Text>
          <TextInput
            value={ip}
            onChangeText={setIp}
            placeholder="Host IP e.g. 192.168.43.1"
            placeholderTextColor={theme.dim}
            keyboardType="numeric"
            style={[styles.input, { marginBottom: 8 }]}
          />
          <Button title={busy === ip ? 'CONNECTING…' : 'CONNECT'} disabled={!ip || !!busy} onPress={() => connect(ip)} />
          <Text style={[styles.dim, { marginTop: 8, fontSize: 11 }]}>Your IP: {myIp ?? 'unknown (not on Wi-Fi?)'}</Text>
        </Panel>
        <Button title="BACK" kind="secondary" onPress={() => go('home')} />
      </View>
    </ScrollView>
  );
}
