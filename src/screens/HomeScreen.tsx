import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { go, hostGame, setName, setOrientation, toggleOrientation, toggleSound, toggleVibration, useApp } from '../store/app';
import { ActionCard, ErrorBanner, Segmented, styles, theme } from './ui';

const COOL_CALLSIGNS = [
  'VIPER', 'MAVERICK', 'GHOST', 'PHANTOM', 'RAPTOR', 'COBRA',
  'VALKYRIE', 'RAZOR', 'FALCON', 'TITAN', 'STORM', 'SPECTRE',
  'REAPER', 'HAWK', 'SHADOW', 'BLAZE', 'WOLFHOUND', 'HUNTER', 'WARLOCK',
];

function randomCallsign(): string {
  const name = COOL_CALLSIGNS[Math.floor(Math.random() * COOL_CALLSIGNS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${name}-${num}`;
}

export function HomeScreen() {
  const name = useApp((s) => s.playerName);
  const error = useApp((s) => s.error);
  const sound = useApp((s) => s.sound);
  const vibration = useApp((s) => s.vibration);
  const orientation = useApp((s) => s.orientation);
  const [busy, setBusy] = useState(false);

  const rollCallsign = () => {
    setName(randomCallsign());
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={localStyles.contentContainer}>
      {/* Top HUD Controls */}
      <View style={localStyles.topBar}>
        <View style={localStyles.statusPill}>
          <View style={[localStyles.statusDot, { backgroundColor: theme.ok }]} />
          <Text style={localStyles.statusText}>RADAR READY</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={toggleOrientation}
            style={({ pressed }) => [
              localStyles.miniToggle,
              { backgroundColor: orientation === 'landscape' ? 'rgba(0,229,255,0.18)' : 'rgba(255,255,255,0.06)' },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ fontSize: 13 }}>{orientation === 'landscape' ? '🔄' : '📱'}</Text>
            <Text style={[localStyles.toggleLabel, { color: orientation === 'landscape' ? theme.cyan : theme.dim }]}>
              {orientation === 'landscape' ? 'LAND' : 'PORT'}
            </Text>
          </Pressable>
          <Pressable
            onPress={toggleSound}
            style={({ pressed }) => [
              localStyles.miniToggle,
              { backgroundColor: sound ? 'rgba(255,210,63,0.15)' : 'rgba(255,255,255,0.06)' },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ fontSize: 13 }}>{sound ? '🔊' : '🔇'}</Text>
            <Text style={[localStyles.toggleLabel, { color: sound ? theme.accent : theme.dim }]}>SFX</Text>
          </Pressable>
          <Pressable
            onPress={toggleVibration}
            style={({ pressed }) => [
              localStyles.miniToggle,
              { backgroundColor: vibration ? 'rgba(0,245,212,0.15)' : 'rgba(255,255,255,0.06)' },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ fontSize: 13 }}>{vibration ? '📳' : '📴'}</Text>
            <Text style={[localStyles.toggleLabel, { color: vibration ? theme.cyan : theme.dim }]}>HAPTIC</Text>
          </Pressable>
        </View>
      </View>

      {/* Hero Fighter Banner */}
      <View style={localStyles.heroSection}>
        <View style={localStyles.wingsContainer}>
          <Text style={{ fontSize: 32 }}>⚡ ✈️ ⚡</Text>
        </View>
        <Text style={localStyles.gameTitle}>A E R O F I G H T E R</Text>
        <Text style={localStyles.gameSubtitle}>AIR COMBAT SIMULATOR · LOCAL MULTIPLAYER</Text>
      </View>

      <ErrorBanner message={error} />

      {/* Callsign / Pilot Station */}
      <View style={localStyles.callsignCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={styles.label}>PILOT CALLSIGN</Text>
          <Pressable onPress={rollCallsign} style={({ pressed }) => [localStyles.rollBtn, pressed && { opacity: 0.6 }]}>
            <Text style={localStyles.rollBtnText}>🎲 RANDOM</Text>
          </Pressable>
        </View>
        <View style={localStyles.inputRow}>
          <View style={localStyles.callsignBadge}>
            <Text style={{ fontSize: 16 }}>🎖️</Text>
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[styles.input, { flex: 1, paddingVertical: 9 }]}
            maxLength={16}
            placeholder="CALLSIGN (e.g. VIPER-07)"
            placeholderTextColor={theme.dim}
            autoCapitalize="characters"
          />
        </View>
      </View>

      {/* Screen Orientation Settings Menu */}
      <View style={localStyles.settingsCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={styles.label}>SCREEN ORIENTATION</Text>
          <Text style={[styles.dim, { fontSize: 11 }]}>
            {orientation === 'landscape' ? 'HORIZONTAL COCKPIT' : 'VERTICAL DUAL-THUMB'}
          </Text>
        </View>
        <Segmented
          value={orientation}
          onChange={(o) => setOrientation(o as 'portrait' | 'landscape')}
          options={[
            { value: 'portrait', label: '📱 PORTRAIT' },
            { value: 'landscape', label: '🔄 LANDSCAPE', color: theme.cyan },
          ]}
        />
      </View>

      {/* Main Mission Cards */}
      <View style={{ gap: 12 }}>
        <ActionCard
          title="SOLO DOGFIGHT"
          badge="OFFLINE"
          badgeColor={theme.accent}
          description="Engage rogue AI bot squadrons with customizable bot difficulty"
          icon="🎯"
          accentColor={theme.accent}
          onPress={() => go('solo')}
          ctaText="FLY SOLO ›"
        />

        <ActionCard
          title="HOST SQUADRON"
          badge="CREATE ROOM"
          badgeColor={theme.cyan}
          description="Host local dogfight room over your phone hotspot for nearby pilots"
          icon="📡"
          accentColor={theme.cyan}
          busy={busy}
          disabled={busy || !name.trim()}
          onPress={async () => {
            setBusy(true);
            try {
              await hostGame();
            } finally {
              setBusy(false);
            }
          }}
          ctaText="HOST ROOM ›"
        />

        <ActionCard
          title="JOIN SQUADRON"
          badge="RADAR SCAN"
          badgeColor={theme.ok}
          description="Scan hotspot network or connect with 1-tap direct IP"
          icon="🚀"
          accentColor={theme.ok}
          disabled={!name.trim()}
          onPress={() => go('join')}
          ctaText="FIND SQUAD ›"
        />
      </View>

      {/* How To Play Infographic */}
      <View style={localStyles.howToBox}>
        <Text style={[styles.label, { marginBottom: 10, textAlign: 'center' }]}>HOTSPOT DOGFIGHT INSTRUCTIONS</Text>
        <View style={localStyles.stepGrid}>
          <View style={localStyles.stepCol}>
            <View style={localStyles.stepCircle}>
              <Text style={localStyles.stepNumber}>1</Text>
            </View>
            <Text style={localStyles.stepTitle}>HOTSPOT ON</Text>
            <Text style={localStyles.stepDesc}>Host enables phone’s hotspot</Text>
          </View>
          <View style={localStyles.stepArrow}>
            <Text style={{ color: theme.dim, fontSize: 16 }}>➔</Text>
          </View>
          <View style={localStyles.stepCol}>
            <View style={localStyles.stepCircle}>
              <Text style={localStyles.stepNumber}>2</Text>
            </View>
            <Text style={localStyles.stepTitle}>SQUAD JOINS</Text>
            <Text style={localStyles.stepDesc}>Friends connect to Wi-Fi</Text>
          </View>
          <View style={localStyles.stepArrow}>
            <Text style={{ color: theme.dim, fontSize: 16 }}>➔</Text>
          </View>
          <View style={localStyles.stepCol}>
            <View style={[localStyles.stepCircle, { borderColor: theme.accent }]}>
              <Text style={[localStyles.stepNumber, { color: theme.accent }]}>3</Text>
            </View>
            <Text style={[localStyles.stepTitle, { color: theme.accent }]}>DOGFIGHT!</Text>
            <Text style={localStyles.stepDesc}>Host: Host, Squad: Join</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 40,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    color: theme.ok,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  miniToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  wingsContainer: {
    marginBottom: 6,
  },
  gameTitle: {
    color: theme.accent,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(255,210,63,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  gameSubtitle: {
    color: theme.dim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 4,
  },
  callsignCard: {
    backgroundColor: theme.panel,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.panelBorder,
  },
  settingsCard: {
    backgroundColor: theme.panel,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.panelBorder,
  },
  rollBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  rollBtnText: {
    color: theme.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callsignBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: theme.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howToBox: {
    backgroundColor: 'rgba(11,23,42,0.85)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 4,
  },
  stepGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepCol: {
    flex: 1,
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.cyan,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepNumber: {
    color: theme.cyan,
    fontSize: 12,
    fontWeight: '900',
  },
  stepTitle: {
    color: theme.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 2,
  },
  stepDesc: {
    color: theme.dim,
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 12,
  },
  stepArrow: {
    paddingHorizontal: 2,
    marginBottom: 16,
  },
});
