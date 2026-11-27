import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { go, hostGame, setName, toggleSound, toggleVibration, useApp } from '../store/app';
import { Button, ErrorBanner, Panel, styles, theme } from './ui';

export function HomeScreen() {
  const name = useApp((s) => s.playerName);
  const error = useApp((s) => s.error);
  const sound = useApp((s) => s.sound);
  const vibration = useApp((s) => s.vibration);
  const [busy, setBusy] = useState(false);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 20, flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}>
      <View>
        <Text style={{ color: theme.accent, fontSize: 38, fontWeight: '900', letterSpacing: 2, textAlign: 'center' }}>AEROFIGHTER</Text>
        <Text style={[styles.dim, { marginBottom: 18, textAlign: 'center' }]}>Local multiplayer dogfights over your phone’s hotspot</Text>
        <Text style={styles.label}>Pilot name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} maxLength={16} placeholder="Your name" placeholderTextColor={theme.dim} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, justifyContent: 'center' }}>
          <Button title={sound ? '🔊 SOUND ON' : '🔇 SOUND OFF'} kind="secondary" onPress={toggleSound} />
          <Button title={vibration ? '📳 VIBRATE ON' : '📴 VIBRATE OFF'} kind="secondary" onPress={toggleVibration} />
        </View>
      </View>
      <View style={{ gap: 12 }}>
        <ErrorBanner message={error} />
        <Button title="SOLO VS BOTS" onPress={() => go('solo')} />
        <Button
          title={busy ? 'STARTING…' : 'HOST GAME'}
          disabled={busy || !name.trim()}
          onPress={async () => {
            setBusy(true);
            await hostGame();
            setBusy(false);
          }}
        />
        <Button title="JOIN GAME" kind="secondary" disabled={!name.trim()} onPress={() => go('join')} />
        {busy ? <ActivityIndicator color={theme.accent} /> : null}
        <Panel style={{ marginTop: 6 }}>
          <Text style={styles.label}>How to play together</Text>
          <Text style={styles.dim}>1. One phone turns on its Wi-Fi hotspot and taps HOST GAME.</Text>
          <Text style={styles.dim}>2. Other phones connect to that hotspot, then tap JOIN GAME.</Text>
          <Text style={styles.dim}>3. Pick your team and plane, tap READY. The host starts the battle.</Text>
        </Panel>
      </View>
    </ScrollView>
  );
}
