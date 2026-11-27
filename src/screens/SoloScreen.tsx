import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { BotDifficulty, GameMode, MapId } from '../sim/types';
import { go, setPlaneType, startSolo, useApp } from '../store/app';
import { LimitPicker, MapPicker, MODE_OPTIONS, PlanePicker, TIME_OPTIONS } from './common';
import { Button, Panel, Segmented, styles, Title } from './ui';

const DIFFICULTY_OPTIONS: { value: BotDifficulty; label: string }[] = [
  { value: 'easy', label: 'ROOKIE' },
  { value: 'medium', label: 'ACE' },
  { value: 'hard', label: 'VETERAN' },
];

export function SoloScreen() {
  const planeType = useApp((s) => s.planeType);
  const [mode, setMode] = useState<GameMode>('ffa');
  const [bots, setBots] = useState(3);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');
  const [timeLimit, setTime] = useState(300);
  const [killLimit, setKills] = useState(20);
  const [captureLimit, setCaps] = useState(3);
  const [map, setMap] = useState<MapId>('farmland');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
      <View>
        <Title>SOLO DOGFIGHT</Title>
        <Panel>
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
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="‹ BACK" kind="secondary" onPress={() => go('home')} style={{ flex: 1 }} />
          <Button title="SCRAMBLE JETS ✈️" onPress={() => startSolo({ mode, map, bots, difficulty, timeLimit, killLimit, captureLimit })} style={{ flex: 2 }} />
        </View>
      </View>
    </ScrollView>
  );
}
