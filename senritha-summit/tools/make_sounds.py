"""Cut, clean and pack the recorded sounds for Last Summit into small MP3 sprites.

usage: python3 -I tools/make_sounds.py <wav_cache_dir> <raw_dir> sounds js/sounds.js

<raw_dir> holds the original Wikimedia Commons files, saved under these names:
  snow_walk.mp3       File:Walking through snow.mp3 (Lukas Beck, CC BY 4.0)
  gravel_step.mp3     File:Footstep on Gravel (Gravity Sound).mp3 (Gravity Sound, CC BY 4.0)
  fire_grass.ogg      File:Dry grass burning in open fireplace.ogg (ezwa, public domain)
  door_creak.ogg      File:Door handle creaking.ogg (stephan, public domain)
  door_close_old.ogg  File:Closing an old door.ogg (ezwa, public domain)
  chair_creak.ogg     File:Creaky wooden swivel chair.ogg (chocoholic, public domain)
Needs ffmpeg (with libmp3lame) and numpy.
"""
import sys, os, json, struct, subprocess
import numpy as np

WAV, RAW, OUT, MAN = sys.argv[1:5]
SR = 44100
rng = np.random.default_rng(7)
os.makedirs(OUT, exist_ok=True)


def load(name):
    p = os.path.join(WAV, name + '.wav')
    if not os.path.exists(p):
        src = [f for f in os.listdir(RAW) if f.startswith(name + '.')]
        if not src:
            return None
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(RAW, src[0]), '-ac', '1', '-ar', str(SR), '-c:a', 'pcm_f32le', p], check=True)
    raw = open(p, 'rb').read()
    i = raw.find(b'data')
    n = struct.unpack('<I', raw[i + 4:i + 8])[0]
    return np.frombuffer(raw[i + 8:i + 8 + n], dtype='<f4').astype(np.float64)


def env(x, ms=25):
    w = max(1, int(ms / 1000 * SR))
    return np.sqrt(np.convolve(x * x, np.ones(w) / w, 'same'))


def highpass(x, f=120):
    # one-pole high-pass to remove rumble and DC
    a = np.exp(-2 * np.pi * f / SR)
    y = np.zeros_like(x)
    prev_x = prev_y = 0.0
    for i, v in enumerate(x):
        prev_y = a * (prev_y + v - prev_x)
        prev_x = v
        y[i] = prev_y
    return y


def fade(x, fin=0.004, fout=0.06):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a: x[:a] *= np.linspace(0, 1, a)
    if b: x[-b:] *= np.linspace(1, 0, b) ** 2
    return x


def norm_rms(x, target):
    r = np.sqrt((x * x).mean()) + 1e-9
    y = x * (target / r)
    pk = np.abs(y).max()
    return y * (0.95 / pk) if pk > 0.95 else y


def onsets(x, min_gap, rel, ms=25):
    e = env(x, ms)
    thr = e.max() * rel
    out, last = [], -1e9
    i = 0
    while i < len(e):
        if e[i] > thr and i - last > min_gap * SR:
            j = min(len(e), i + int(0.12 * SR))
            pk = i + int(np.argmax(e[i:j]))
            # walk back to where the attack starts
            k = pk
            while k > 0 and e[k] > e[pk] * 0.18 and pk - k < int(0.08 * SR):
                k -= 1
            out.append((k, e[pk]))
            last = pk
            i = pk + int(min_gap * SR)
        else:
            i += 1
    return out


sprites = {}
def pack(name, clips, gap=0.08):
    """Concatenate clips into one file and record [start, duration] for each."""
    parts, offs, t = [], [], 0.0
    sil = np.zeros(int(gap * SR))
    for c in clips:
        offs.append([round(t, 4), round(len(c) / SR, 4)])
        parts += [c, sil]
        t += (len(c) + len(sil)) / SR
    y = np.concatenate(parts)
    write_mp3(name, y)
    sprites[name] = offs


def write_mp3(name, y, br='96k'):
    tmp = os.path.join(OUT, name + '.tmp.wav')
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    with open(tmp, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 36 + len(pcm)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, SR, SR * 2, 2, 16) + b'data' + struct.pack('<I', len(pcm)) + pcm)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-c:a', 'libmp3lame', '-b:a', br, '-ac', '1', os.path.join(OUT, name + '.mp3')], check=True)
    os.remove(tmp)


# ------------------------------------------------------------------ snow steps
snow = highpass(load('snow_walk'), 90)
ons = onsets(snow, 0.42, 0.16)
top = max(p for _, p in ons)
clips = []
for k, (s, pk) in enumerate(ons):
    if pk < top * 0.3:
        continue
    nxt = ons[k + 1][0] if k + 1 < len(ons) else len(snow)
    a = max(0, s - int(0.015 * SR))
    b = min(nxt - int(0.03 * SR), a + int(0.62 * SR))
    if b - a < int(0.18 * SR):
        continue
    clips.append(fade(norm_rms(snow[a:b], 0.11), 0.003, 0.09))
print('snow steps', len(clips), [round(len(c) / SR, 2) for c in clips])
pack('snow_steps', clips)

# ------------------------------------------------------------------ rock / gravel step
rock = highpass(load('gravel_step'), 80)
e = env(rock, 10)
s = max(0, int(np.argmax(e > e.max() * 0.08)) - int(0.01 * SR))
rock = fade(norm_rms(rock[s:s + int(0.45 * SR)], 0.12), 0.002, 0.12)
rock_clips = [rock]
# two slightly different takes: tighter attack and a softer, duller scuff
rock_clips.append(fade(norm_rms(rock[int(0.01 * SR):int(0.33 * SR)], 0.12), 0.002, 0.08))
lp = np.convolve(rock, np.ones(6) / 6, 'same')
rock_clips.append(fade(norm_rms(lp, 0.1), 0.002, 0.12))
pack('rock_steps', rock_clips)

# ------------------------------------------------------------------ wooden floor steps
# The recorded boot click (start of the gravel step) excites a synthetic floorboard: a set of
# damped resonances like a timber floor on joists, plus a short sole scuff.
click = rock[:int(0.035 * SR)] * np.hanning(int(0.035 * SR) * 2)[int(0.035 * SR):]
wood_clips = []
for v in range(6):
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    ir = np.zeros(n)
    for f, d, g in [(78, 0.09, 1.0), (124, 0.07, 0.8), (186, 0.05, 0.55), (262, 0.04, 0.4), (420, 0.025, 0.25), (780, 0.012, 0.12), (1500, 0.006, 0.05)]:
        ff = f * (1 + rng.uniform(-0.12, 0.12))
        ir += g * np.sin(2 * np.pi * ff * t + rng.uniform(0, 6.28)) * np.exp(-t / (d * rng.uniform(0.8, 1.25)))
    heel = np.convolve(click, ir)[:n]
    # toe roll ~70-110 ms later, softer
    toe = np.zeros(n)
    dt = int(rng.uniform(0.07, 0.11) * SR)
    toe[dt:] = heel[:n - dt] * rng.uniform(0.25, 0.4)
    scuff = rng.normal(0, 1, n) * np.exp(-t / 0.03) * 0.02
    scuff = np.convolve(scuff, np.ones(3) / 3, 'same')
    y = heel + toe + scuff
    wood_clips.append(fade(norm_rms(y, 0.1), 0.001, 0.1))
pack('wood_steps', wood_clips)

# ------------------------------------------------------------------ fireplace loop + crackles
fire = highpass(load('fire_grass'), 60)
L, F = int(20.0 * SR), int(1.6 * SR)
a = int(1.5 * SR)
seg = fire[a:a + L + F]
y = seg[:L].copy()
r = np.linspace(0, 1, F)
y[:F] = seg[:F] * np.sqrt(r) + seg[L:L + F] * np.sqrt(1 - r)
y = norm_rms(y, 0.07)
P = int(0.15 * SR)
padded = np.concatenate([y[-P:], y, y[:P]])
write_mp3('fire_loop', padded, '112k')
fire_loop = {'start': round(P / SR, 5), 'end': round((P + L) / SR, 5)}

# crackles: the sharpest transients in the fire recording
d = np.abs(np.diff(fire, prepend=0))
de = env(d, 4)
cands = []
gap = int(0.15 * SR)
order = np.argsort(de)[::-1]
taken = np.zeros(len(de), bool)
for i in order:
    if len(cands) >= 14:
        break
    if taken[max(0, i - gap):i + gap].any() or i < 0.02 * SR or i > len(fire) - 0.2 * SR:
        continue
    taken[i] = True
    s = i - int(0.008 * SR)
    cands.append(fade(norm_rms(fire[s:s + int(0.16 * SR)], 0.09), 0.001, 0.1))
pack('fire_crackles', cands, 0.05)

# ------------------------------------------------------------------ door and cabin creaks
door = highpass(load('door_creak'), 100)
door_open = fade(norm_rms(door[int(0.12 * SR):int(2.55 * SR)], 0.09), 0.01, 0.3)
clips = [door_open]
close = load('door_close_old')
if close is None:
    close = load('door_close_gs')
if close is not None:
    close = highpass(close, 60)
    e = env(close, 10)
    pk = int(np.argmax(e))
    s = max(0, pk - int(0.25 * SR))
    clips.append(fade(norm_rms(close[s:pk + int(0.7 * SR)], 0.12), 0.01, 0.25))
    door_src = 'recorded'
else:
    # heavy timber door meeting its frame: a big wooden thump plus the latch
    n = int(0.6 * SR); t = np.arange(n) / SR
    ir = sum(g * np.sin(2 * np.pi * f * t) * np.exp(-t / dd) for f, dd, g in [(62, 0.12, 1), (97, 0.09, 0.7), (151, 0.06, 0.5), (240, 0.04, 0.3), (610, 0.015, 0.15)])
    thump = np.convolve(click * 1.4, ir)[:n]
    latch = np.zeros(n); li = int(0.012 * SR)
    latch[li:li + len(click)] += np.diff(click, prepend=0) * 3
    clips.append(fade(norm_rms(thump + latch, 0.12), 0.001, 0.2))
    door_src = 'synth'
pack('door', clips)

chair = highpass(load('chair_creak'), 120)
ons = onsets(chair, 0.5, 0.2, 30)
creaks = []
for k, (s, pk) in enumerate(ons):
    nxt = ons[k + 1][0] if k + 1 < len(ons) else len(chair)
    b = min(nxt - int(0.02 * SR), s + int(0.9 * SR))
    if b - s > int(0.15 * SR):
        creaks.append(fade(norm_rms(chair[max(0, s - int(0.01 * SR)):b], 0.07), 0.01, 0.15))
print('creaks', len(creaks))
pack('creaks', creaks)

manifest = {'sprites': sprites, 'fireLoop': fire_loop, 'doorClose': door_src}
with open(MAN, 'w') as f:
    f.write('// Generated by the sound build step: offsets [start, duration] in seconds inside each sprite file.\n')
    body = ',\n'.join(f'\t\t{k}: {json.dumps(v)}' for k, v in sprites.items())
    f.write('export const SOUNDS = {\n\tsprites: {\n' + body + ',\n\t},\n')
    f.write(f"\tfireLoop: {json.dumps(fire_loop)},\n}};\n")
print(json.dumps({k: len(v) for k, v in sprites.items()}), fire_loop, door_src)
for fn in sorted(os.listdir(OUT)):
    print(fn, os.path.getsize(os.path.join(OUT, fn)) // 1024, 'KB')
