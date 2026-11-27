import { create } from 'zustand';
import { HostServer } from '../net/hostServer';
import { ClientConnection } from '../net/client';
import { LobbyState } from '../net/protocol';
import { GameSession, LocalSession, RemoteSession } from '../game/session';
import { configFor, standings } from '../sim/world';
import { BotDifficulty, GameMode, MapId, MatchConfig, Plane, PlaneType, PlayerSlot } from '../sim/types';

export type Screen = 'home' | 'solo' | 'hostLobby' | 'join' | 'clientLobby' | 'game' | 'results';

export interface Results {
  kind: 'solo' | 'host' | 'client';
  mode: GameMode;
  myId: string;
  planes: Plane[];
  teamScores: [number, number];
  winner: string | null;
  winnerTeam: number | null;
}

interface AppState {
  screen: Screen;
  playerName: string;
  planeType: PlaneType;
  host: HostServer | null;
  client: ClientConnection | null;
  lobby: LobbyState | null;
  session: GameSession | null;
  results: Results | null;
  error: string | null;
  sound: boolean;
  vibration: boolean;
}

export const useApp = create<AppState>(() => ({
  screen: 'home',
  playerName: 'Pilot' + Math.floor(Math.random() * 900 + 100),
  planeType: 'fighter',
  host: null,
  client: null,
  lobby: null,
  session: null,
  results: null,
  error: null,
  sound: true,
  vibration: true,
}));

const set = useApp.setState;
const get = useApp.getState;

export const go = (screen: Screen) => set({ screen, error: null });
export const setName = (playerName: string) => set({ playerName: playerName.slice(0, 16) });
export const setPlaneType = (planeType: PlaneType) => set({ planeType });
export const toggleSound = () => set((s) => ({ sound: !s.sound }));
export const toggleVibration = () => set((s) => ({ vibration: !s.vibration }));
export const clearError = () => set({ error: null });

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

// ---------- Solo ----------
export interface SoloOptions {
  mode: GameMode;
  map: MapId;
  bots: number;
  timeLimit: number;
  killLimit: number;
  captureLimit: number;
  difficulty?: BotDifficulty;
}

let lastSolo: SoloOptions | null = null;

export function startSolo(opts: SoloOptions) {
  lastSolo = opts;
  const { playerName, planeType } = get();
  const config: MatchConfig = configFor(opts.mode, opts.map, {
    timeLimit: opts.timeLimit,
    killLimit: opts.killLimit,
    captureLimit: opts.captureLimit,
    botDifficulty: opts.difficulty ?? 'medium',
  });
  const slots: PlayerSlot[] = [{ id: 'me', name: playerName, team: 0, type: planeType, isBot: false }];
  const types: PlaneType[] = ['fighter', 'interceptor', 'bomber'];
  const names = ['Viper', 'Falcon', 'Ghost', 'Raptor', 'Hawk', 'Talon', 'Blaze'];
  for (let i = 0; i < opts.bots; i++) {
    const t0 = slots.filter((s) => s.team === 0).length;
    const t1 = slots.filter((s) => s.team === 1).length;
    slots.push({ id: 'bot' + i, name: 'Bot ' + names[i % names.length], team: t0 <= t1 ? 0 : 1, type: types[i % 3], isBot: true });
  }
  set({ session: new LocalSession('me', config, slots, newSeed()), screen: 'game', results: null });
}

// ---------- Host ----------
export async function hostGame() {
  const { playerName, planeType } = get();
  const host = new HostServer(playerName, planeType);
  host.setListener({
    onLobby: (lobby) => set({ lobby }),
    onError: (msg) => set({ error: msg }),
  });
  try {
    await host.start();
  } catch (e) {
    host.stop();
    set({ error: 'Could not start host: ' + String((e as Error)?.message ?? e) });
    return;
  }
  set({ host, lobby: { ...host.lobby, players: [...host.lobby.players] }, screen: 'hostLobby' });
}

export function hostStartMatch() {
  const { host } = get();
  if (!host) return;
  const seed = newSeed();
  const slots = host.startMatch(seed);
  set({ session: new LocalSession('host', host.lobby.config, slots, seed, host), screen: 'game', results: null });
}

// ---------- Client ----------
export async function joinGame(ip: string, port?: number) {
  const { playerName } = get();
  const client = new ClientConnection();
  client.setListener({
    onLobby: (lobby) => set({ lobby }),
    onStart: (config, slots, seed) => {
      // A rematch can arrive while we're still showing the end of the last match.
      get().session?.dispose();
      set({ session: new RemoteSession(client.id, config, slots, seed, client), screen: 'game', results: null });
    },
    onSnap: (s, e) => {
      const sess = get().session;
      if (sess instanceof RemoteSession) sess.onSnap(s, e);
    },
    onClosed: (reason) => {
      get().session?.dispose();
      set({ client: null, session: null, lobby: null, screen: 'home', error: reason });
    },
  });
  await client.connect(ip.trim(), playerName, port);
  set({ client, lobby: client.lobby, screen: 'clientLobby' });
}

export function clientSetup(s: { team?: number; type?: PlaneType; ready?: boolean }) {
  get().client?.send({ t: 'setup', ...s });
  if (s.type) set({ planeType: s.type });
}

// ---------- Match flow ----------
export function finishMatch() {
  const { session } = get();
  if (!session) return;
  const w = session.world;
  const results: Results = {
    kind: session.kind,
    mode: w.config.mode,
    myId: session.myId,
    planes: standings(w).map((p) => ({ ...p })),
    teamScores: [...w.teamScores] as [number, number],
    winner: w.winner,
    winnerTeam: w.winnerTeam,
  };
  session.dispose();
  set({ session: null, results, screen: 'results' });
}

export function backToLobby() {
  const { host, client } = get();
  if (host) {
    host.endMatch();
    set({ screen: 'hostLobby' });
  } else if (client) {
    set({ screen: 'clientLobby', lobby: client.lobby });
  } else {
    set({ screen: 'solo' });
  }
}

/** Instant rematch: same players and settings, new match. */
export function rematch() {
  const { host } = get();
  if (host) {
    host.rematch();
    hostStartMatch();
  } else if (lastSolo) {
    startSolo(lastSolo);
  }
}

/** Leave whatever we're in and return to the main menu. */
export function leaveToHome() {
  const { host, client, session } = get();
  session?.dispose();
  host?.stop();
  if (client) {
    client.setListener({});
    client.close();
  }
  set({ host: null, client: null, session: null, lobby: null, screen: 'home' });
}
