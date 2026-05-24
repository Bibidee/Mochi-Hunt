// ==================== Reactive game state store ====================
// Single source of truth for HUD-relevant + meta state. Components subscribe
// and re-render on change instead of reaching into globals.
import { START_LIVES } from '../config.js';

const initial = () => ({
  username: 'MOCHI',
  difficulty: 'medium',
  level: 1,
  score: 0,
  lives: START_LIVES,
  dots: 0, // dots REMAINING in the maze (for HUD + win check)
  soundOn: true,
  // menu | playing | paused | dying | won | lost
  status: 'menu',
  // --- gameplay telemetry for anti-cheat (sent to backend on submit) ---
  dotsEaten: 0,
  ghostsEaten: 0,
  startedAt: 0,
});

let state = initial();
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn(state);
}

export const store = {
  get: () => state,

  // Subscribe to changes; returns an unsubscribe fn. Fires once immediately.
  subscribe(fn) {
    listeners.add(fn);
    fn(state);
    return () => listeners.delete(fn);
  },

  // Merge a patch and notify.
  set(patch) {
    state = { ...state, ...patch };
    emit();
  },

  // Convenience mutators
  addScore(points) {
    state = { ...state, score: state.score + points };
    emit();
  },
  decDots(n = 1) {
    state = { ...state, dots: Math.max(0, state.dots - n) };
    emit();
  },
  countDotEaten() {
    state = { ...state, dotsEaten: state.dotsEaten + 1 };
    emit();
  },
  countGhostEaten() {
    state = { ...state, ghostsEaten: state.ghostsEaten + 1 };
    emit();
  },
  loseLife() {
    state = { ...state, lives: Math.max(0, state.lives - 1) };
    emit();
  },

  // Reset everything for a brand-new run (keeps username + difficulty + sound).
  resetRun() {
    const { username, difficulty, soundOn } = state;
    state = { ...initial(), username, difficulty, soundOn, startedAt: Date.now() };
    emit();
  },
};
