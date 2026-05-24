// ==================== Game loop ====================
// requestAnimationFrame loop that hands the simulation a delta-time in SECONDS,
// clamped so a backgrounded tab or a long stall can't teleport entities.

export class Loop {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.raf = 0;
    this.last = 0;
    this.running = false;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  _tick(ts) {
    if (!this.running) return;
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (dt > 0.05) dt = 0.05; // clamp to 50ms
    this.onUpdate(dt);
    if (this.running) this.raf = requestAnimationFrame(this._tick);
  }
}
