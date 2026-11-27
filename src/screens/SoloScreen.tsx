import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotDifficulty, GameMode, MapId } from '../sim/types';
import { go, setOrientation, setPlaneType, startSolo, useApp } from '../store/app';
import { LimitPicker, MapPicker, MODE_OPTIONS, PlanePicker, TIME_OPTIONS } from './common';
import { Button, Panel, Segmented, styles, theme, Title } from './ui';
import { playSfx } from '../game/audio';

const DIFFICULTY_OPTIONS: { value: BotDifficulty; label: string }[] = [
  { value: 'easy', label: 'ROOKIE' },
  { value: 'medium', label: 'ACE' },
  { value: 'hard', label: 'VETERAN' },
];

export function SoloScreen() {
  const planeType = useApp((s) => s.planeType);
  const sound = useApp((s) => s.sound);
  const orientation = useApp((s) => s.orientation);
  const [mode, setMode] = useState<GameMode>('ffa');
  const [bots, setBots] = useState(3);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');
  const [timeLimit, setTime] = useState(300);
  const [killLimit, setKills] = useState(20);
  const [captureLimit, setCaps] = useState(3);
  const [map, setMap] = useState<MapId>('farmland');

  const switchOrientation = (target: 'portrait' | 'landscape') => {
    if (sound && target !== orientation) playSfx('special', 0.4);
    setOrientation(target);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
      <View>
        <Title>SOLO DOGFIGHT</Title>
        <Panel>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.label}>DISPLAY ORIENTATION</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <Pressable
                onPress={() => switchOrientation('portrait')}
                style={({ pressed }) => [
                  soloStyles.orientBtn,
                  orientation === 'portrait' ? soloStyles.orientBtnActive : soloStyles.orientBtnInactive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[soloStyles.orientText, orientation === 'portrait' && { color: theme.accent, fontWeight: '900' }]}>
                  PORTRAIT {orientation === 'portrait' ? '●' : ''}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => switchOrientation('landscape')}
                style={({ pressed }) => [
                  soloStyles.orientBtn,
                  orientation === 'landscape' ? soloStyles.orientBtnActive : soloStyles.orientBtnInactive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[soloStyles.orientText, orientation === 'landscape' && { color: theme.cyan, fontWeight: '900' }]}>
                  LANDSCAPE {orientation === 'landscape' ? '●' : ''}
                </Text>
              </Pressable>
            </View>
          </View>
          <Segmented label="Mode" value={mode} onChange={setMode} options={MODE_OPTIONS} />
          <Segmented label="Difficulty" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTIONS} />
          <Segmented label="Bots" value={bots} onChange={setBots} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))} />
          <Segmented label="Time limit" value={timeLimit} onChange={setTime} options={TIME_OPTIONS} />
          <LimitPicker
            mode={mode}
            killLimit={killLimit}
            captureLimit={captureLimit}
            onChange={(c) => {
              if (c.killLimit) setKills(c.killLimit);
              if (c.captureLimit) setCaps(c.captureLimit);
            }}
          />
          <MapPicker value={map} onChange={setMap} />
        </Panel>
      </View>
      <View>
        <Title>SELECT YOUR AIRCRAFT</Title>
        <PlanePicker value={planeType} onChange={setPlaneType} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <Button
            title="‹ BACK"
            kind="secondary"
            onPress={() => {
              if (sound) playSfx('pickup', 0.4);
              go('home');
            }}
            style={{ flex: 1 }}
          />
          <Button
            title="SCRAMBLE JETS ›"
            onPress={() => {
              if (sound) playSfx('shoot', 0.5);
              startSolo({ mode, map, bots, difficulty, timeLimit, killLimit, captureLimit });
            }}
            style={{ flex: 2 }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const soloStyles = StyleSheet.create({
  orientBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  orientBtnActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.16)',
    borderColor: '#00e5ff',
  },
  orientBtnInactive: {
    backgroundColor: '#0c1a2e',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  orientText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
