import { describe, it, expect } from 'vitest';
import { PowerSystem } from '../src/game/systems/PowerSystem.js';

const makeGhost = () => ({ frightened: false, frighten(d) { this.frightened = true; this.dur = d; } });

describe('PowerSystem', () => {
  it('doubles the ghost-eat score within one window', () => {
    const ps = new PowerSystem();
    ps.activate(6, [makeGhost(), makeGhost()]);
    expect(ps.scoreForEat()).toBe(200);
    expect(ps.scoreForEat()).toBe(400);
    expect(ps.scoreForEat()).toBe(800);
    expect(ps.scoreForEat()).toBe(1600);
  });

  it('frightens all ghosts on activate', () => {
    const g = makeGhost();
    new PowerSystem().activate(6, [g]);
    expect(g.frightened).toBe(true);
  });

  it('deactivates when the timer elapses', () => {
    const ps = new PowerSystem();
    ps.activate(1, []);
    expect(ps.active).toBe(true);
    ps.update(1.1);
    expect(ps.active).toBe(false);
  });

  it('resets the combo on each activation', () => {
    const ps = new PowerSystem();
    ps.activate(6, []);
    ps.scoreForEat();
    ps.activate(6, []);
    expect(ps.scoreForEat()).toBe(200);
  });
});
