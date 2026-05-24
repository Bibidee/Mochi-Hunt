// ==================== Audio engine (WebAudio SFX) ====================
// Synthesised tones — no audio files needed. Handles the suspended-context
// case (iOS/Safari) by resuming on the first user gesture.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  setEnabled(on) {
    this.enabled = on;
  }

  // Must be called from within a user gesture (click/touch) at least once.
  unlock() {
    const ctx = this._ctx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  _ctx() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  tone(freq, type, duration, vol = 0.3, delay = 0) {
    if (!this.enabled) return;
    const ctx = this._ctx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = freq;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.start(t);
      osc.stop(t + duration + 0.01);
    } catch {
      /* ignore audio failures */
    }
  }

  dot()      { this.tone(880, 'sine', 0.06, 0.15); }
  power()    { this.tone(440, 'square', 0.3, 0.25); this.tone(660, 'square', 0.3, 0.2, 0.1); }
  ghostEat() { this.tone(200, 'sawtooth', 0.2, 0.3); this.tone(400, 'sawtooth', 0.2, 0.3, 0.1); }
  die()      { [300, 250, 200, 150, 100].forEach((f, i) => this.tone(f, 'sawtooth', 0.15, 0.4, i * 0.12)); }
  win()      { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 'sine', 0.35, 0.4, i * 0.18)); }
  levelUp()  { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 'sine', 0.3, 0.35, i * 0.14)); }
}

export const audio = new AudioEngine();
