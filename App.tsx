import { useEffect } from 'react';
import { BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { go, leaveToHome, useApp } from './src/store/app';
import { HomeScreen } from './src/screens/HomeScreen';
import { SoloScreen } from './src/screens/SoloScreen';
import { HostLobbyScreen } from './src/screens/HostLobbyScreen';
import { JoinScreen } from './src/screens/JoinScreen';
import { ClientLobbyScreen } from './src/screens/ClientLobbyScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { GameScreen } from './src/game/GameScreen';
import { theme } from './src/screens/ui';
import { initAudio } from './src/game/audio';

export default function App() {
  const screen = useApp((s) => s.screen);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    initAudio().catch(() => {});
  }, []);

  // Android back button: step back sensibly instead of exiting the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const s = useApp.getState().screen;
      if (s === 'home') return false;
      if (s === 'solo' || s === 'join') go('home');
      else if (s !== 'game') leaveToHome();
      return true; // in-game: ignore (use the pause button)
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar hidden />
      {screen === 'home' && <HomeScreen />}
      {screen === 'solo' && <SoloScreen />}
      {screen === 'hostLobby' && <HostLobbyScreen />}
      {screen === 'join' && <JoinScreen />}
      {screen === 'clientLobby' && <ClientLobbyScreen />}
      {screen === 'game' && <GameScreen />}
      {screen === 'results' && <ResultsScreen />}
    </View>
  );
}
