// feedback.js — umpan balik suara dan getar

const SOUNDS = {
  catch: 'assets/sfx/catch.mp3',
  fail: 'assets/sfx/fail.mp3',
  spawn: 'assets/sfx/spawn.mp3',
};

export class Feedback {
  constructor() {
    this.sounds = {};
    for (const [name, src] of Object.entries(SOUNDS)) {
      const a = new Audio(src);
      a.preload = 'auto';
      this.sounds[name] = a;
    }
    this.unlocked = false;
  }

  /**
   * Browser HP (terutama iPhone) hanya mengizinkan suara setelah ada sentuhan pengguna.
   * Panggil ini di dalam handler tombol "Mulai".
   */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    for (const a of Object.values(this.sounds)) {
      a.muted = true;
      a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; })
        .catch(() => { a.muted = false; });
    }
  }

  play(name) {
    const a = this.sounds[name];
    if (!a) return;
    try {
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch { /* abaikan */ }
  }

  /** Getar (Android). iPhone tidak mendukung navigator.vibrate, jadi diabaikan dengan aman. */
  vibrate(pattern) {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(pattern); } catch { /* abaikan */ }
    }
  }
}
