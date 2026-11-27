"""Synthesizes placeholder sound effects into assets/sfx (no external deps).
Run: python3 tools/gen_sfx.py"""
import math, random, struct, wave, os

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx')
random.seed(7)

def write(name, samples):
    peak = max(1e-6, max(abs(s) for s in samples))
    k = 0.9 / peak
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR)
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

sq = lambda p: 1.0 if math.sin(p) >= 0 else -1.0

# Gun: short punchy noise + low click
n = int(SR * 0.07)
nz = noise_lp(n, 0.5)
write('shoot', [(nz[i] * 0.8 + math.sin(2 * math.pi * 140 * i / SR) * 0.5) * env(i, n, 0.002, 3) for i in range(n)])

# Hit: dull thud
n = int(SR * 0.09)
nz = noise_lp(n, 0.15)
write('hit', [(nz[i] + math.sin(2 * math.pi * 90 * i / SR)) * env(i, n, 0.001, 2.5) for i in range(n)])

# Explosion: long rumbling low-passed noise
n = int(SR * 0.8)
a, b = noise_lp(n, 0.06), noise_lp(n, 0.3)
write('explode', [(a[i] * 1.0 + b[i] * 0.4 * (1 - i / n)) * env(i, n, 0.005, 1.6) for i in range(n)])

# Missile launch: whoosh with rising tone
n = int(SR * 0.45)
nz = noise_lp(n, 0.25)
sw = sweep(n, 300, 900)
write('missile', [(nz[i] * 0.8 + sw[i] * 0.25) * env(i, n, 0.05, 1.2) for i in range(n)])

# Pickup: rising arpeggio
notes = [660, 880, 1320]
out = []
for f in notes:
    m = int(SR * 0.07)
    out += [sq(2 * math.pi * f * i / SR) * 0.5 * env(i, m, 0.01, 1) for i in range(m)]
write('pickup', out)

# Special: sci-fi sweep
n = int(SR * 0.35)
sw = sweep(n, 200, 1400, sq)
write('special', [sw[i] * 0.4 * env(i, n, 0.02, 1.2) for i in range(n)])

# Flag taken / returned: two-tone chime
out = []
for f in (784, 1046):
    m = int(SR * 0.16)
    out += [math.sin(2 * math.pi * f * i / SR) * env(i, m, 0.01, 1.5) for i in range(m)]
write('flag', out)

# Capture: short fanfare
out = []
for f, d in ((523, 0.1), (659, 0.1), (784, 0.1), (1046, 0.35)):
    m = int(SR * d)
    out += [(sq(2 * math.pi * f * i / SR) * 0.35 + math.sin(2 * math.pi * f * 2 * i / SR) * 0.2) * env(i, m, 0.01, 0.8) for i in range(m)]
write('capture', out)

# Missile warning beep
n = int(SR * 0.12)
write('warn', [sq(2 * math.pi * 1500 * i / SR) * 0.5 * env(i, n, 0.005, 0.5) for i in range(n)])
print('ok', sorted(os.listdir(OUT)))
