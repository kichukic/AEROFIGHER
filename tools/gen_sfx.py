"""Synthesizes arcade combat sound effects and BGM loop into assets/sfx (no external deps).
Run: python3 tools/gen_sfx.py"""
import math, random, struct, wave, os

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx')
os.makedirs(OUT, exist_ok=True)
random.seed(7)


def write(name, samples, gain=0.9):
    peak = max(1e-6, max(abs(s) for s in samples))
    k = gain / peak
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s * k)) * 32767)) for s in samples))


def env(i, n, attack=0.01, power=2.0):
    t = i / n
    a = min(1.0, t / attack) if attack > 0 else 1.0
    return a * (1 - t) ** power


def noise_lp(n, alpha):
    out, y = [], 0.0
    for _ in range(n):
        y += alpha * (random.uniform(-1, 1) - y)
        out.append(y)
    return out


def sweep(n, f0, f1, wave_fn=math.sin):
    ph, out = 0.0, []
    for i in range(n):
        f = f0 + (f1 - f0) * i / n
        ph += 2 * math.pi * f / SR
        out.append(wave_fn(ph))
    return out


def sq(p):
    return 1.0 if math.sin(p) >= 0 else -1.0


def saw(p):
    return 2.0 * ((p / (2 * math.pi)) % 1.0) - 1.0


# 1) 20mm M61 Vulcan Cannon (Fighter): realistic supersonic crack + chamber punch + bolt clack
n = int(SR * 0.12)
nz_hi = noise_lp(n, 0.85)
nz_lo = noise_lp(n, 0.18)
sw = sweep(n, 320, 52)
samples_shoot = []
for i in range(n):
    t = i / SR
    crack = nz_hi[i] * math.exp(-t * 95.0) * 1.4
    thump = (sw[i] * 0.8 + nz_lo[i] * 0.9) * math.exp(-t * 34.0)
    bolt = math.sin(2 * math.pi * 1650 * t) * math.exp(-max(0.0, t - 0.012) * 180.0) * (0.28 if t > 0.012 else 0.0)
    tail = nz_lo[i] * math.exp(-t * 18.0) * 0.35
    samples_shoot.append(math.tanh((crack + thump + bolt + tail) * 1.35))
write('shoot', samples_shoot)

# 2) 30mm GAU-8 / Heavy Autocannon (Bomber & Gunship): deep chest-thumping percussive boom + rotary bark
n = int(SR * 0.16)
nz_hi = noise_lp(n, 0.72)
nz_lo = noise_lp(n, 0.12)
sw = sweep(n, 175, 36)
samples_heavy = []
for i in range(n):
    t = i / SR
    blast = nz_hi[i] * math.exp(-t * 65.0) * 1.3
    boom = (sw[i] * 1.15 + nz_lo[i] * 1.0) * math.exp(-t * 22.0)
    breech = math.sin(2 * math.pi * 920 * t) * math.exp(-max(0.0, t - 0.016) * 140.0) * (0.25 if t > 0.016 else 0.0)
    samples_heavy.append(math.tanh((blast + boom + breech) * 1.5))
write('shoot_heavy', samples_heavy)

# 3) High-Velocity 25mm Twin Sabot / Interceptor Cannon: sharp supersonic whip-crack + tight kinetic snap
n = int(SR * 0.11)
nz_hi = noise_lp(n, 0.92)
nz_mid = noise_lp(n, 0.35)
sw = sweep(n, 480, 75)
samples_fast = []
for i in range(n):
    t = i / SR
    whip = nz_hi[i] * math.exp(-t * 125.0) * 1.5
    snap = (sw[i] * 0.75 + nz_mid[i] * 0.7) * math.exp(-t * 42.0)
    ring = math.sin(2 * math.pi * 2200 * t) * math.exp(-t * 85.0) * 0.22
    samples_fast.append(math.tanh((whip + snap + ring) * 1.3))
write('shoot_laser', samples_fast)

# 4) Armor Hit: metallic clank + low impact thud
n = int(SR * 0.10)
nz = noise_lp(n, 0.22)
sw = sweep(n, 220, 65)
write('hit', [(nz[i] * 0.75 + sw[i] * 0.85) * env(i, n, 0.001, 2.4) for i in range(n)])

# 5) Explosion: layered sub-bass boom + crackling mid debris
n = int(SR * 0.95)
sub = sweep(n, 110, 26)
a, b = noise_lp(n, 0.055), noise_lp(n, 0.32)
write('explode', [(sub[i] * 0.65 + a[i] * 1.1 + b[i] * 0.55 * (1 - i / n)) * env(i, n, 0.004, 1.45) for i in range(n)])

# 6) Missile launch: roaring ignition whoosh + rising seeker tone
n = int(SR * 0.48)
nz = noise_lp(n, 0.28)
sw = sweep(n, 260, 1100)
write('missile', [(nz[i] * 0.85 + sw[i] * 0.3) * env(i, n, 0.04, 1.15) for i in range(n)])

# 7) Pickup: bright rising arcade arpeggio
notes = [660, 880, 1320, 1760]
out = []
for f in notes:
    m = int(SR * 0.055)
    out += [(sq(2 * math.pi * f * i / SR) * 0.35 + math.sin(2 * math.pi * f * i / SR) * 0.45) * env(i, m, 0.008, 1.0) for i in range(m)]
write('pickup', out)

# 8) Special ability: sci-fi power surge
n = int(SR * 0.38)
sw = sweep(n, 220, 1550, saw)
sub_sw = sweep(n, 110, 440)
write('special', [(sw[i] * 0.45 + sub_sw[i] * 0.45) * env(i, n, 0.02, 1.2) for i in range(n)])

# 9) Flag taken / returned: crisp two-tone chime
out = []
for f in (784, 1046):
    m = int(SR * 0.16)
    out += [math.sin(2 * math.pi * f * i / SR) * env(i, m, 0.01, 1.5) for i in range(m)]
write('flag', out)

# 10) Capture: celebratory 4-note fanfare
out = []
for f, d in ((523, 0.1), (659, 0.1), (784, 0.1), (1046, 0.36)):
    m = int(SR * d)
    out += [(sq(2 * math.pi * f * i / SR) * 0.35 + math.sin(2 * math.pi * f * 2 * i / SR) * 0.25) * env(i, m, 0.01, 0.8) for i in range(m)]
write('capture', out)

# 11) Missile warning beep
n = int(SR * 0.12)
write('warn', [sq(2 * math.pi * 1500 * i / SR) * 0.5 * env(i, n, 0.005, 0.5) for i in range(n)])

# 12) Lock acquired: crisp twin high-tech radar chirp
out = []
for f, d in ((1320, 0.045), (1760, 0.07)):
    m = int(SR * d)
    out += [math.sin(2 * math.pi * f * i / SR) * env(i, m, 0.004, 1.2) for i in range(m)]
write('lock', out)

# 13) Kill confirm: punchy arcade confirm chord
n = int(SR * 0.24)
out = []
for i in range(n):
    s1 = math.sin(2 * math.pi * 523.25 * i / SR)
    s2 = math.sin(2 * math.pi * 783.99 * i / SR)
    s3 = sq(2 * math.pi * 1046.5 * i / SR) * 0.3
    out.append((s1 + s2 + s3) * env(i, n, 0.005, 1.4))
write('kill', out)

# 14) Seamless 128 BPM Synthwave / Tactical Dogfight BGM Loop (16 beats = 7.5s)
BPM = 128
BEAT = 60.0 / BPM
BEATS = 16
N_BGM = int(SR * BEAT * BEATS)
# Bass progression in D minor: D2, D2, Bb1, C2 (4 beats each)
bass_freqs = [73.42, 73.42, 58.27, 65.41]
arp_notes = [293.66, 349.23, 440.00, 523.25, 440.00, 349.23, 293.66, 440.00]
bgm = [0.0] * N_BGM
step_samples = int(SR * BEAT / 2)  # 8th-note grid

for i in range(N_BGM):
    t = i / SR
    beat_idx = int(t / BEAT) % BEATS
    bar_idx = beat_idx // 4
    bf = bass_freqs[bar_idx]
    step_idx = int(t / (BEAT / 2))
    step_pos = (i % step_samples) / max(1, step_samples)

    # Driving 8th-note synth bass
    bass_env = (1.0 - step_pos) ** 1.4
    bass = (saw(2 * math.pi * bf * t) * 0.55 + math.sin(2 * math.pi * bf * t) * 0.55) * bass_env * 0.45

    # Subtle 16th-note tactical arp
    arp_f = arp_notes[step_idx % len(arp_notes)] * (0.9 if bar_idx == 2 else 1.0)
    arp_env = math.exp(-step_pos * 5.0)
    arp = math.sin(2 * math.pi * arp_f * t) * arp_env * 0.16

    # Four-on-the-floor kick + crisp hi-hat on off-beats
    beat_pos = (t % BEAT) / BEAT
    kick = math.sin(2 * math.pi * (110 * math.exp(-beat_pos * 18) + 42) * beat_pos * BEAT) * math.exp(-beat_pos * 12) * 0.42
    hat = (random.uniform(-1, 1) * math.exp(-max(0, beat_pos - 0.5) * 45) * 0.10) if beat_pos >= 0.5 else 0.0

    bgm[i] = bass + arp + kick + hat

write('bgm', bgm, gain=0.72)
print('ok', sorted(os.listdir(OUT)))
