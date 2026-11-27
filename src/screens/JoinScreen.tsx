import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FoundGame, startScanner } from '../net/discovery';
import { getLocalIp } from '../net/localIp';
import { go, joinGame, useApp } from '../store/app';
import { Button, ErrorBanner, Panel, styles, theme, Title } from './ui';
import { MODE_LABEL } from './common';
import { GameMode } from '../sim/types';

export function JoinScreen() {
  const storeError = useApp((s) => s.error);
  const [games, setGames] = useState<FoundGame[]>([]);
  const [ip, setIp] = useState('192.168.43.1');
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
      // Pre-fill the most likely host address: the hotspot gateway (x.y.z.1), or Android hotspot default 192.168.43.1
      if (a) setIp((cur) => cur || a.split('.').slice(0, 3).join('.') + '.1');
      else setIp((cur) => cur || '192.168.43.1');
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
    <ScrollView style={styles.screen} contentContainerStyle={localStyles.container}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Title>JOIN SQUADRON</Title>
          <Text style={[styles.dim, { fontSize: 12, marginTop: -8 }]}>AIRSPACE RADAR · DIRECT LINK</Text>
        </View>
        <Button title="‹ BACK" kind="ghost" onPress={() => go('home')} style={{ paddingVertical: 8, paddingHorizontal: 12 }} />
      </View>

      <ErrorBanner message={error} />

      {/* Prominent 1-Tap Quick Connect Card */}
      <View style={localStyles.quickCard}>
        <View style={localStyles.quickHeader}>
          <Text style={{ fontSize: 20 }}>⚡</Text>
          <View style={{ flex: 1 }}>
            <Text style={localStyles.quickTitle}>HOTSPOT 1-TAP CONNECT</Text>
            <Text style={localStyles.quickSub}>Connected to friend’s hotspot? Tap below to join immediately</Text>
          </View>
        </View>
        <Pressable
          onPress={() => connect(ip || '192.168.43.1')}
          disabled={!!busy}
          style={({ pressed }) => [
            localStyles.quickBtn,
            pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 },
            busy === (ip || '192.168.43.1') && { opacity: 0.6 },
          ]}
        >
          {busy === (ip || '192.168.43.1') ? (
            <ActivityIndicator color="#09121f" />
          ) : (
            <Text style={localStyles.quickBtnText}>CONNECT TO HOST ({ip || '192.168.43.1'}) ›</Text>
          )}
        </Pressable>
      </View>

      {/* Live Discovered Airspace Rooms */}
      <Panel>
        <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={localStyles.liveDot} />
            <Text style={[styles.label, { marginBottom: 0 }]}>AIRSPACE SCANNER</Text>
          </View>
          <ActivityIndicator color={theme.cyan} size="small" />
        </View>

        {games.length === 0 ? (
          <View style={localStyles.emptyScanBox}>
            <Text style={{ fontSize: 24, textAlign: 'center', marginBottom: 6 }}>📡</Text>
            <Text style={[styles.text, { textAlign: 'center', fontWeight: '800' }]}>Scanning local network…</Text>
            <Text style={[styles.dim, { textAlign: 'center', fontSize: 12, marginTop: 4 }]}>
              Ensure you are connected to the host’s Wi-Fi hotspot. If auto-scan doesn’t detect it, use the 1-Tap button above.
            </Text>
          </View>
        ) : (
          games.map((g) => (
            <Pressable
              key={g.ip}
              disabled={!g.open || !!busy}
              onPress={() => connect(g.ip, g.port)}
              style={({ pressed }) => [
                localStyles.roomCard,
                {
                  borderColor: g.open ? theme.cyan : 'rgba(255,255,255,0.1)',
                  backgroundColor: pressed ? 'rgba(0,245,212,0.1)' : 'rgba(0,0,0,0.3)',
                  opacity: g.open ? 1 : 0.5,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={[styles.text, { fontWeight: '900', fontSize: 16 }]}>{g.name}</Text>
                  <View style={[localStyles.roomBadge, { borderColor: theme.accent }]}>
                    <Text style={[localStyles.roomBadgeText, { color: theme.accent }]}>
                      {MODE_LABEL[g.mode as GameMode] ?? g.mode}
                    </Text>
                  </View>
                </View>
                <Text style={styles.dim}>
                  👥 {g.players}/{g.max} Pilots · {g.ip}
                </Text>
              </View>
              {busy === g.ip ? (
                <ActivityIndicator color={theme.cyan} />
              ) : (
                <View style={[localStyles.joinBtn, { backgroundColor: g.open ? theme.cyan : 'transparent' }]}>
                  <Text style={[localStyles.joinBtnText, { color: g.open ? '#04111d' : theme.dim }]}>
                    {g.open ? 'JOIN ›' : 'FULL'}
                  </Text>
                </View>
              )}
            </Pressable>
          ))
        )}
      </Panel>

      {/* Manual Host Address Drawer */}
      <Panel>
        <Text style={styles.label}>MANUAL HOST ADDRESS</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => setIp('192.168.43.1')}
            style={({ pressed }) => [
              localStyles.presetChip,
              ip === '192.168.43.1' && localStyles.presetChipActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[localStyles.presetChipText, ip === '192.168.43.1' && { color: theme.accent }]}>
              🤖 192.168.43.1 (Android)
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setIp('172.20.10.1')}
            style={({ pressed }) => [
              localStyles.presetChip,
              ip === '172.20.10.1' && localStyles.presetChipActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[localStyles.presetChipText, ip === '172.20.10.1' && { color: theme.accent }]}>
              🍎 172.20.10.1 (iOS)
            </Text>
          </Pressable>
        </View>

        <TextInput
          value={ip}
          onChangeText={setIp}
          placeholder="Host IP address"
          placeholderTextColor={theme.dim}
          keyboardType="numeric"
          style={[styles.input, { marginBottom: 10 }]}
        />
        <Button
          title={busy === ip ? 'CONNECTING…' : 'CONNECT VIA IP ›'}
          disabled={!ip || !!busy}
          onPress={() => connect(ip)}
          kind="secondary"
        />
        {myIp ? <Text style={[styles.dim, { marginTop: 8, fontSize: 11 }]}>Your Network IP: {myIp}</Text> : null}
      </Panel>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  container: {
    paddingBottom: 40,
    gap: 16,
  },
  quickCard: {
    backgroundColor: 'rgba(0, 245, 212, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: theme.cyan,
  },
  quickHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  quickTitle: {
    color: theme.cyan,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  quickSub: {
    color: theme.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  quickBtn: {
    backgroundColor: theme.cyan,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  quickBtnText: {
    color: '#04111d',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.cyan,
  },
  emptyScanBox: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 8,
  },
  roomBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  roomBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  joinBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnText: {
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  presetChipActive: {
    borderColor: theme.accent,
    backgroundColor: 'rgba(255,210,63,0.15)',
  },
  presetChipText: {
    color: theme.dim,
    fontSize: 11,
    fontWeight: '800',
  },
});
