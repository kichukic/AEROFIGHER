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


# 1) Standard Vulcan Gun (Fighter): crisp punch + snappy transient
n = int(SR * 0.085)
nz = noise_lp(n, 0.55)
sw = sweep(n, 240, 80)
write('shoot', [(nz[i] * 0.75 + sw[i] * 0.65) * env(i, n, 0.002, 2.8) for i in range(n)])

# 2) Heavy Autocannon / 30mm Gatling (Bomber & Gunship): deep bass thump + mechanical bark
n = int(SR * 0.11)
nz = noise_lp(n, 0.35)
sw = sweep(n, 150, 48)
write('shoot_heavy', [(nz[i] * 0.7 + sw[i] * 0.9 + sq(2 * math.pi * 65 * i / SR) * 0.25) * env(i, n, 0.003, 2.2) for i in range(n)])

# 3) High-Tech Plasma / Railgun (Interceptor & Stealth): crisp sci-fi zap
n = int(SR * 0.09)
nz = noise_lp(n, 0.7)
sw = sweep(n, 1450, 240, saw)
write('shoot_laser', [(sw[i] * 0.65 + nz[i] * 0.35) * env(i, n, 0.002, 2.4) for i in range(n)])

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
