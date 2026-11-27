import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { go, hostGame, setName, setOrientation, setPlaneType, toggleSound, toggleVibration, useApp } from '../store/app';
import { ErrorBanner, theme } from './ui';
import { HangarShowcase, PLANE_LORE } from './HangarShowcase';
import { MenuBackdrop } from './MenuBackdrop';
import { playSfx } from '../game/audio';

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
  const planeType = useApp((s) => s.planeType);
  const error = useApp((s) => s.error);
  const sound = useApp((s) => s.sound);
  const vibration = useApp((s) => s.vibration);
  const orientation = useApp((s) => s.orientation);
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const rollCallsign = () => {
    if (sound) playSfx('pickup', 0.5);
    setName(randomCallsign());
  };

  const switchOrientation = (target: 'portrait' | 'landscape') => {
    if (sound && target !== orientation) playSfx('special', 0.4);
    setOrientation(target);
  };

  const isLandscape = orientation === 'landscape';
  const activeLore = PLANE_LORE[planeType];

  return (
    <View style={[styles.screen, isLandscape && styles.screenLandscape]}>
      <MenuBackdrop />
      {/* Landscape layout: 2 equal columns */}
      {isLandscape ? (
        <View style={styles.landscapeRow}>
          {/* Left Column: Aircraft Hangar Stage */}
          <View style={styles.landscapeHangarCol}>
            <HangarShowcase
              selectedType={planeType}
              onSelect={setPlaneType}
              compact={true}
              style={{ flex: 1 }}
            />
          </View>

          {/* Right Column: Title, Profile, Controls, and Action Deck */}
          <View style={styles.landscapeMenuCol}>
            {/* Top Bar */}
            <View style={styles.topBar}>
              <View>
                <View style={styles.titleRow}>
                  <View style={styles.titlePip} />
                  <Text style={styles.gameTitleSmall}>AEROFIGHER</Text>
                </View>
                <Text style={styles.gameSubtitleSmall}>AIRBASE ALPHA // TACTICAL DOGFIGHT</Text>
              </View>

              <View style={styles.topPillRow}>
                <Pressable
                  onPress={() => switchOrientation('portrait')}
                  style={({ pressed }) => [styles.pillBtn, styles.pillBtnCyan, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.pillBtnTextCyan}>PORTRAIT</Text>
                </Pressable>

                <Pressable
                  onPress={toggleSound}
                  style={({ pressed }) => [styles.pillBtn, sound ? styles.pillBtnAccent : styles.pillBtnDim, pressed && { opacity: 0.7 }]}
                >
                  <Text style={sound ? styles.pillBtnTextAccent : styles.pillBtnTextDim}>SFX {sound ? 'ON' : 'OFF'}</Text>
                </Pressable>

                <Pressable
                  onPress={toggleVibration}
                  style={({ pressed }) => [styles.pillBtn, vibration ? styles.pillBtnCyan : styles.pillBtnDim, pressed && { opacity: 0.7 }]}
                >
                  <Text style={vibration ? styles.pillBtnTextCyan : styles.pillBtnTextDim}>VIB {vibration ? 'ON' : 'OFF'}</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowGuide(true)}
                  style={({ pressed }) => [styles.pillBtn, styles.pillBtnDim, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.pillBtnTextDim}>GUIDE</Text>
                </Pressable>
              </View>
            </View>

            <ErrorBanner message={error} />

            {/* Callsign Strip */}
            <View style={styles.callsignStrip}>
              <View style={[styles.wingBadge, { borderColor: activeLore.color }]}>
                <Text style={[styles.wingBadgeText, { color: activeLore.color }]}>{activeLore.code}</Text>
              </View>
              <Text style={styles.callsignLabel}>CALLSIGN:</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.callsignInput}
                maxLength={16}
                placeholder="CALLSIGN"
                placeholderTextColor={theme.dim}
                autoCapitalize="characters"
              />
              <Pressable onPress={rollCallsign} style={({ pressed }) => [styles.rerollBtn, pressed && { opacity: 0.6 }]}>
                <Text style={styles.rerollText}>REROLL</Text>
              </Pressable>
            </View>

            {/* Compact Tactical Telemetry Strip */}
            <View style={styles.telemetryStrip}>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryVal}>9</Text>
                <Text style={styles.telemetryLbl}>AIRSPACES</Text>
              </View>
              <View style={styles.telemetryDiv} />
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryVal}>FFA / TDM / CTF</Text>
                <Text style={styles.telemetryLbl}>COMBAT MODES</Text>
              </View>
              <View style={styles.telemetryDiv} />
              <View style={styles.telemetryItem}>
                <Text style={[styles.telemetryVal, { color: '#00f5d4' }]}>ONLINE</Text>
                <Text style={styles.telemetryLbl}>LAN RADAR</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionGroup}>
              <Pressable
                onPress={() => {
                  if (sound) playSfx('shoot', 0.4);
                  go('solo');
                }}
                style={({ pressed }) => [styles.btnPrimary, pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }]}
              >
                <View style={styles.btnRow}>
                  <View>
                    <Text style={styles.btnPrimaryText}>SOLO DOGFIGHT</Text>
                    <Text style={styles.btnPrimarySub}>INSTANT SCRAMBLE • AI SQUADRONS</Text>
                  </View>
                  <Text style={styles.btnPrimaryBadge}>LAUNCH ›</Text>
                </View>
              </Pressable>

              <View style={styles.dualBtnRow}>
                <Pressable
                  onPress={async () => {
                    if (sound) playSfx('shoot', 0.4);
                    setBusy(true);
                    try {
                      await hostGame();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  disabled={busy || !name.trim()}
                  style={({ pressed }) => [
                    styles.btnCyan,
                    (busy || !name.trim()) && { opacity: 0.4 },
                    pressed && { transform: [{ scale: 0.98 }], opacity: 0.8 },
                  ]}
                >
                  <Text style={styles.btnCyanText}>{busy ? 'BROADCASTING...' : 'HOST SQUADRON'}</Text>
                  <Text style={styles.btnSubText}>CREATE HOTSPOT ROOM</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (sound) playSfx('shoot', 0.4);
                    go('join');
                  }}
                  disabled={!name.trim()}
                  style={({ pressed }) => [
                    styles.btnEmerald,
                    !name.trim() && { opacity: 0.4 },
                    pressed && { transform: [{ scale: 0.98 }], opacity: 0.8 },
                  ]}
                >
                  <Text style={styles.btnEmeraldText}>JOIN SQUADRON</Text>
                  <Text style={styles.btnSubText}>SCAN LOCAL WIFI</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ) : (
        /* Portrait layout: 100% viewport single screen */
        <View style={styles.portraitRoot}>
          {/* Top Header Bar */}
          <View style={styles.topBar}>
            <View>
              <View style={styles.titleRow}>
                <View style={styles.titlePip} />
                <Text style={styles.gameTitle}>AEROFIGHER</Text>
              </View>
              <Text style={styles.gameSubtitle}>AIRBASE ALPHA // SUPERSONIC DOGFIGHT</Text>
            </View>

            <View style={styles.topPillRow}>
              <Pressable
                onPress={() => switchOrientation('landscape')}
                style={({ pressed }) => [styles.pillBtn, styles.pillBtnCyan, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.pillBtnTextCyan}>LANDSCAPE</Text>
              </Pressable>

              <Pressable
                onPress={toggleSound}
                style={({ pressed }) => [styles.pillBtn, sound ? styles.pillBtnAccent : styles.pillBtnDim, pressed && { opacity: 0.7 }]}
              >
                <Text style={sound ? styles.pillBtnTextAccent : styles.pillBtnTextDim}>SFX {sound ? 'ON' : 'OFF'}</Text>
              </Pressable>

              <Pressable
                onPress={toggleVibration}
                style={({ pressed }) => [styles.pillBtn, vibration ? styles.pillBtnCyan : styles.pillBtnDim, pressed && { opacity: 0.7 }]}
              >
                <Text style={vibration ? styles.pillBtnTextCyan : styles.pillBtnTextDim}>VIB {vibration ? 'ON' : 'OFF'}</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowGuide(true)}
                style={({ pressed }) => [styles.pillBtn, styles.pillBtnDim, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.pillBtnTextDim}>GUIDE</Text>
              </Pressable>
            </View>
          </View>

          <ErrorBanner message={error} />

          {/* Pilot Callsign Bar */}
          <View style={styles.callsignStrip}>
            <View style={[styles.wingBadge, { borderColor: activeLore.color }]}>
              <Text style={[styles.wingBadgeText, { color: activeLore.color }]}>{activeLore.code}</Text>
            </View>
            <Text style={styles.callsignLabel}>PILOT:</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.callsignInput}
              maxLength={16}
              placeholder="CALLSIGN (e.g. VIPER-07)"
              placeholderTextColor={theme.dim}
              autoCapitalize="characters"
            />
            <Pressable onPress={rollCallsign} style={({ pressed }) => [styles.rerollBtn, pressed && { opacity: 0.6 }]}>
              <Text style={styles.rerollText}>REROLL</Text>
            </Pressable>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>READY</Text>
            </View>
          </View>

          {/* Compact Tactical Telemetry Strip */}
          <View style={styles.telemetryStrip}>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryVal}>9 SECTORS</Text>
              <Text style={styles.telemetryLbl}>AIRSPACE</Text>
            </View>
            <View style={styles.telemetryDiv} />
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryVal}>FFA / TDM / CTF</Text>
              <Text style={styles.telemetryLbl}>MODES</Text>
            </View>
            <View style={styles.telemetryDiv} />
            <View style={styles.telemetryItem}>
              <Text style={[styles.telemetryVal, { color: '#00f5d4' }]}>HOTSPOT LAN</Text>
              <Text style={styles.telemetryLbl}>MULTIPLAYER</Text>
            </View>
          </View>

          {/* Central Hangar Stage (Fills available space) */}
          <View style={styles.portraitHangarWrap}>
            <HangarShowcase
              selectedType={planeType}
              onSelect={setPlaneType}
              compact={false}
              style={{ flex: 1 }}
            />
          </View>

          {/* Action Command Deck */}
          <View style={styles.actionGroup}>
            <Pressable
              onPress={() => {
                if (sound) playSfx('shoot', 0.4);
                go('solo');
              }}
              style={({ pressed }) => [styles.btnPrimary, pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }]}
            >
              <View style={styles.btnRow}>
                <View>
                  <Text style={styles.btnPrimaryText}>SOLO DOGFIGHT</Text>
                  <Text style={styles.btnPrimarySub}>INSTANT SCRAMBLE • AI SQUADRONS • 9 MAPS</Text>
                </View>
                <View style={styles.launchPill}>
                  <Text style={styles.btnPrimaryBadge}>SCRAMBLE ›</Text>
                </View>
              </View>
            </Pressable>

            <View style={styles.dualBtnRow}>
              <Pressable
                onPress={async () => {
                  if (sound) playSfx('shoot', 0.4);
                  setBusy(true);
                  try {
                    await hostGame();
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy || !name.trim()}
                style={({ pressed }) => [
                  styles.btnCyan,
                  (busy || !name.trim()) && { opacity: 0.4 },
                  pressed && { transform: [{ scale: 0.98 }], opacity: 0.8 },
                ]}
              >
                <Text style={styles.btnCyanText}>{busy ? 'BROADCASTING...' : 'HOST SQUADRON'}</Text>
                <Text style={styles.btnSubText}>CREATE LAN ROOM</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (sound) playSfx('shoot', 0.4);
                  go('join');
                }}
                disabled={!name.trim()}
                style={({ pressed }) => [
                  styles.btnEmerald,
                  !name.trim() && { opacity: 0.4 },
                  pressed && { transform: [{ scale: 0.98 }], opacity: 0.8 },
                ]}
              >
                <Text style={styles.btnEmeraldText}>JOIN SQUADRON</Text>
                <Text style={styles.btnSubText}>SCAN HOTSPOT</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Clean Tactical Multiplayer Instructions Modal */}
      <Modal visible={showGuide} transparent animationType="fade" onRequestClose={() => setShowGuide(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>HOTSPOT MULTIPLAYER GUIDE</Text>
              <Pressable onPress={() => setShowGuide(false)} hitSlop={10}>
                <Text style={styles.modalCloseText}>[X]</Text>
              </Pressable>
            </View>

            <View style={styles.guideStepRow}>
              <View style={styles.guideNumBadge}>
                <Text style={styles.guideNumText}>01</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guideStepTitle}>HOST TURNS ON HOTSPOT</Text>
                <Text style={styles.guideStepDesc}>Enable Wi-Fi hotspot in your phone settings. No internet or mobile data required.</Text>
              </View>
            </View>

            <View style={styles.guideStepRow}>
              <View style={styles.guideNumBadge}>
                <Text style={styles.guideNumText}>02</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guideStepTitle}>SQUAD MATES CONNECT</Text>
                <Text style={styles.guideStepDesc}>Other pilots connect their phones to the host’s Wi-Fi hotspot.</Text>
              </View>
            </View>

            <View style={styles.guideStepRow}>
              <View style={[styles.guideNumBadge, { borderColor: theme.accent }]}>
                <Text style={[styles.guideNumText, { color: theme.accent }]}>03</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.guideStepTitle, { color: theme.accent }]}>SCRAMBLE INTO BATTLE</Text>
                <Text style={styles.guideStepDesc}>Host taps HOST SQUADRON. Other pilots tap JOIN SQUADRON to auto-scan and dogfight!</Text>
              </View>
            </View>

            <Pressable
              onPress={() => setShowGuide(false)}
              style={({ pressed }) => [styles.modalConfirmBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.modalConfirmText}>ACKNOWLEDGE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#040914',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  screenLandscape: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  portraitRoot: {
    flex: 1,
    justifyContent: 'space-between',
  },
  landscapeRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  landscapeHangarCol: {
    flex: 1.15,
  },
  landscapeMenuCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titlePip: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#ffd23f',
  },
  gameTitle: {
    color: '#ffd23f',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  gameSubtitle: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  gameTitleSmall: {
    color: '#ffd23f',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  gameSubtitleSmall: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  topPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  pillBtnCyan: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  pillBtnAccent: {
    backgroundColor: 'rgba(255, 210, 63, 0.14)',
    borderColor: 'rgba(255, 210, 63, 0.45)',
  },
  pillBtnDim: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  pillBtnTextCyan: {
    color: '#00e5ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pillBtnTextAccent: {
    color: '#ffd23f',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pillBtnTextDim: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  callsignStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 18, 36, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.28)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 8,
    marginBottom: 6,
  },
  wingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  wingBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  telemetryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(7, 18, 36, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.18)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  telemetryItem: {
    alignItems: 'center',
  },
  telemetryVal: {
    color: '#ffd23f',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  telemetryLbl: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  telemetryDiv: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  callsignLabel: {
    color: '#00e5ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  callsignInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingVertical: 2,
  },
  rerollBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  rerollText: {
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 245, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 212, 0.3)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00f5d4',
  },
  statusText: {
    color: '#00f5d4',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  portraitHangarWrap: {
    flex: 1,
    marginVertical: 4,
  },
  actionGroup: {
    gap: 6,
    marginTop: 4,
  },
  btnPrimary: {
    backgroundColor: '#ffd23f',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ffe58f',
    shadowColor: '#ffd23f',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btnPrimaryText: {
    color: '#040d1a',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  btnPrimarySub: {
    color: 'rgba(4, 13, 26, 0.72)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 1,
  },
  launchPill: {
    backgroundColor: 'rgba(4, 13, 26, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnPrimaryBadge: {
    color: '#040d1a',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  dualBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnCyan: {
    flex: 1,
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: '#00e5ff',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCyanText: {
    color: '#00e5ff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  btnEmerald: {
    flex: 1,
    backgroundColor: 'rgba(0, 245, 212, 0.14)',
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: '#00f5d4',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEmeraldText: {
    color: '#00f5d4',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  btnSubText: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#071224',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#00e5ff',
    padding: 18,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 10,
  },
  modalTitle: {
    color: '#00e5ff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalCloseText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '900',
  },
  guideStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  guideNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#00e5ff',
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideNumText: {
    color: '#00e5ff',
    fontSize: 13,
    fontWeight: '900',
  },
  guideStepTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  guideStepDesc: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
  },
  modalConfirmBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#00e5ff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  modalConfirmText: {
    color: '#00e5ff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
