"""
Generator efek suara orisinal (disintesis dari gelombang sinus, lisensi CC0).

Menghasilkan:
  assets/sfx/catch.mp3  -> berhasil menangkap (arpeggio naik)
  assets/sfx/fail.mp3   -> gagal / terlalu jauh (dua nada turun)
  assets/sfx/spawn.mp3  -> makhluk muncul ("pop")

Butuh Python 3 + numpy. Konversi ke MP3 memakai ffmpeg jika tersedia;
jika tidak, file .wav tetap dibuat (ubah path di js/feedback.js ke .wav).
    python tools/make_sfx.py
"""
import os
import shutil
import subprocess
import wave

import numpy as np

SR = 44100


def env(n, attack=0.01, release=0.08):
    e = np.ones(n)
    a, r = int(SR * attack), int(SR * release)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def tone(freq, dur, harmonics=(1, 0.3, 0.12), vol=0.5, attack=0.005, release=0.06):
    t = np.arange(int(SR * dur)) / SR
    f = np.broadcast_to(freq, t.shape) if np.ndim(freq) == 0 else freq
    phase = 2 * np.pi * np.cumsum(f) / SR
    sig = sum(a * np.sin(phase * (k + 1)) for k, a in enumerate(harmonics))
    return vol * sig / sum(harmonics) * env(len(t), attack, release)


def note(name):
    names = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    return 440 * 2 ** ((names[name[0]] + 12 * (int(name[1]) - 4)) / 12)


def mix(parts, total):
    out = np.zeros(int(SR * total))
    for start, sig in parts:
        s = int(SR * start)
        out[s:s + len(sig)] += sig[: len(out) - s]
    return out


def make_catch():
    seq = ["C5", "E5", "G5", "C6"]
    parts = [(i * 0.08, tone(note(n), 0.16, vol=0.45)) for i, n in enumerate(seq)]
    chord = sum(tone(note(n), 0.45, vol=0.22, release=0.35) for n in ["C5", "E5", "G5", "C6"])
    parts.append((0.32, chord))
    sparkle = tone(note("E6") * 2, 0.12, harmonics=(1,), vol=0.12)
    parts += [(0.36, sparkle), (0.46, sparkle * 0.7)]
    return mix(parts, 0.85)


def make_fail():
    n1 = tone(330, 0.14, harmonics=(1, 0.5, 0.33, 0.25), vol=0.4)
    n2 = tone(247, 0.22, harmonics=(1, 0.5, 0.33, 0.25), vol=0.4, release=0.12)
    return mix([(0, n1), (0.16, n2)], 0.42)


def make_spawn():
    dur = 0.18
    sweep = np.linspace(380, 950, int(SR * dur))
    pop = tone(sweep, dur, harmonics=(1, 0.2), vol=0.5, attack=0.003, release=0.1)
    ding = tone(note("A5"), 0.2, harmonics=(1,), vol=0.18, release=0.15)
    return mix([(0, pop), (0.12, ding)], 0.36)


def save(sig, path_wav):
    sig = np.clip(sig / max(1e-9, np.abs(sig).max()) * 0.85, -1, 1)
    with wave.open(path_wav, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((sig * 32767).astype("<i2").tobytes())
    if shutil.which("ffmpeg"):
        mp3 = path_wav[:-4] + ".mp3"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path_wav,
                        "-codec:a", "libmp3lame", "-b:a", "96k", mp3], check=True)
        os.remove(path_wav)
        print("  " + mp3)
    else:
        print("  " + path_wav + "  (ffmpeg tidak ada, file tetap .wav)")


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "assets", "sfx")
    os.makedirs(out, exist_ok=True)
    print("Membuat suara:")
    save(make_catch(), os.path.join(out, "catch.wav"))
    save(make_fail(), os.path.join(out, "fail.wav"))
    save(make_spawn(), os.path.join(out, "spawn.wav"))
