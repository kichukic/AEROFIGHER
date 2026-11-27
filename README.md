# AeroFighter

Top-down 2D aerial dogfight game for Android (React Native + Expo). Play solo against bots, or with up to 8 players on phones connected to one phone's Wi-Fi hotspot. No internet connection is needed.

## Features

- **Modes:** Free-for-all, Team Deathmatch, Capture the Flag, and Solo vs Bots in any of these modes.
- **Planes:**
  - Interceptor: fast. Special: **DASH**, an afterburner burst of speed.
  - Fighter: balanced. Special: **FLARE**, which breaks all missile locks on you.
  - Bomber: tough. Special: **FLAK**, a ring of bullets fired in every direction.
- **Maps:** Open Ocean, Desert Mesas, Arctic Peaks, Red Canyon and Night Raid. Rocks block bullets and damage planes that hit them.
- **Power-ups:** repair, shield, missiles and boost.
- **Rematch** with the same players in one tap.
- **Sound and vibration:** guns, explosions, missile lock warning and flag events, plus screen shake. Each can be switched on or off on the home screen.

## Run it

This project needs a **development build**. Expo Go won't work because the game uses native socket modules.

```bash
npm install
npx expo run:android          # builds and installs on a USB-connected phone
# or build an APK:
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=3
# -> android/app/build/outputs/apk/release/app-release.apk (runs standalone, no dev server needed)
# Requires a JDK 17–21 with javac (JAVA_HOME). Fewer workers and one CPU architecture keep memory use down.
```

Install the same APK on every phone.

## Playing together

1. Phone A turns on its **Wi-Fi hotspot**, opens the game and taps **HOST GAME**.
2. Phones B, C and so on connect to that hotspot, open the game and tap **JOIN GAME**. The host's game appears in the list automatically. If it doesn't, type the host's IP; it's often `192.168.43.1`, or the gateway address that comes pre-filled.
3. Each player picks a team and plane and taps **READY**. The host can add bots, then taps **START BATTLE**.

## Architecture

| Path | What |
|---|---|
| `src/sim/` | Pure TypeScript game logic: the fixed 30 Hz deterministic tick, flight model, guns, homing missiles, power-ups, FFA and TDM rules, and bot AI. It has no React or network code. |
| `src/net/protocol.ts` | Message types, compact snapshot encoding, and the newline-delimited JSON framing. |
| `src/net/discovery.ts` | UDP discovery on port 47777. Joiners broadcast probes and the host replies by unicast. The host also announces itself once per second. |
| `src/net/hostServer.ts` | TCP server on port 47778 for the lobby, player inputs and snapshot broadcast. |
| `src/net/client.ts` | TCP client connection, including ping. |
| `src/game/session.ts` | `LocalSession` runs the authoritative sim for solo play and for the host. `RemoteSession` mirrors the host's snapshots and predicts the player's own plane locally. |
| `src/game/render.ts` | Skia renderer: world, planes, effects, off-screen enemy arrows and minimap. |
| `src/game/Controls.tsx` | Multi-touch floating joystick plus FIRE and MISSILE buttons. |
| `src/screens/` | Menu, solo setup, host and client lobbies, join screen, and results. |

**Netcode:** the host runs the simulation. Clients send their input about 30 times a second, and the host sends snapshots 20 times a second. All in-game traffic uses TCP with `noDelay`, which is reliable and plenty fast on a local hotspot. UDP is used only for discovery. If the host leaves, the match ends for everyone.

## Dev commands

```bash
npm test            # sim + protocol unit tests
npm run typecheck
npm run lint
```

## Art

Sound effects in `assets/sfx` are synthesized placeholders; to regenerate them, run `python3 tools/gen_sfx.py`. Plane shapes and colours are placeholder vectors defined in `src/game/render.ts` (`COLORS`, `planePath`). They'll be replaced to match the reference art.
