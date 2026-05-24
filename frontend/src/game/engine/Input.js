// ==================== Input system ====================
// Unifies keyboard, swipe, and on-screen D-pad into a single direction stream.
// Movement input is only emitted when `isActive()` returns true (i.e. playing).
import { $ } from '../../utils/dom.js';

const KEY_DIRS = {
  ArrowUp: { dx: 0, dy: -1 }, ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 }, ArrowRight: { dx: 1, dy: 0 },
  w: { dx: 0, dy: -1 }, s: { dx: 0, dy: 1 }, a: { dx: -1, dy: 0 }, d: { dx: 1, dy: 0 },
};

const DPAD_DIRS = {
  'dp-up': { dx: 0, dy: -1 }, 'dp-down': { dx: 0, dy: 1 },
  'dp-left': { dx: -1, dy: 0 }, 'dp-right': { dx: 1, dy: 0 },
};

export class Input {
  constructor({ canvas, isActive, onDirection, onPause }) {
    this.canvas = canvas;
    this.isActive = isActive;
    this.onDirection = onDirection;
    this.onPause = onPause;
    this._touch = { x: 0, y: 0 };
    this._dpadTimers = new Map();
    this._bound = [];
  }

  _emit(dx, dy) {
    if (this.isActive()) this.onDirection({ dx, dy });
  }

  _on(target, type, handler, opts) {
    target.addEventListener(type, handler, opts);
    this._bound.push(() => target.removeEventListener(type, handler, opts));
  }

  attach() {
    // --- Keyboard ---
    this._on(document, 'keydown', (e) => {
      // Never hijack keys while the user is typing in a form field
      // (otherwise W/A/S/D/P never reach the username input).
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'p' || e.key === 'Escape') { this.onPause?.(); return; }

      const dir = KEY_DIRS[key];
      if (!dir) return;
      if (!this.isActive()) return; // only capture movement keys during play
      e.preventDefault();
      this.onDirection({ dx: dir.dx, dy: dir.dy });
    });

    // --- Swipe on the canvas only (not UI) ---
    this._on(this.canvas, 'touchstart', (e) => {
      e.preventDefault();
      this._touch.x = e.touches[0].clientX;
      this._touch.y = e.touches[0].clientY;
    }, { passive: false });

    this._on(this.canvas, 'touchend', (e) => {
      e.preventDefault();
      const dx = e.changedTouches[0].clientX - this._touch.x;
      const dy = e.changedTouches[0].clientY - this._touch.y;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; // tap, not swipe
      if (Math.abs(dx) > Math.abs(dy)) this._emit(dx > 0 ? 1 : -1, 0);
      else this._emit(0, dy > 0 ? 1 : -1);
    }, { passive: false });

    // --- D-pad (touch + mouse, held = repeat) ---
    Object.entries(DPAD_DIRS).forEach(([id, dir]) => {
      const elNode = $(id);
      if (!elNode) return;
      const press = () => {
        this._emit(dir.dx, dir.dy);
        elNode.classList.add('pressed');
        clearInterval(this._dpadTimers.get(id));
        this._dpadTimers.set(id, setInterval(() => this._emit(dir.dx, dir.dy), 80));
      };
      const release = () => {
        clearInterval(this._dpadTimers.get(id));
        this._dpadTimers.delete(id);
        elNode.classList.remove('pressed');
      };
      this._on(elNode, 'touchstart', (e) => { e.preventDefault(); e.stopPropagation(); press(); }, { passive: false });
      this._on(elNode, 'touchend', (e) => { e.preventDefault(); e.stopPropagation(); release(); }, { passive: false });
      this._on(elNode, 'touchcancel', (e) => { e.preventDefault(); release(); }, { passive: false });
      this._on(elNode, 'mousedown', (e) => { e.preventDefault(); press(); });
      this._on(elNode, 'mouseup', release);
      this._on(elNode, 'mouseleave', release);
    });
  }

  detach() {
    this._bound.forEach((off) => off());
    this._bound = [];
    this._dpadTimers.forEach((t) => clearInterval(t));
    this._dpadTimers.clear();
  }
}
