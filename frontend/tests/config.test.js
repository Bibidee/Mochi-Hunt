import { describe, it, expect } from 'vitest';
import { getDifficultyParams, DIFFICULTY, GHOST_SPEED_CAP } from '../src/config.js';

describe('getDifficultyParams', () => {
  it('uses base ghost speed at level 1 and caps at high levels', () => {
    expect(getDifficultyParams('medium', 1).ghostSpeed).toBeCloseTo(DIFFICULTY.medium.ghostSpeed);
    expect(getDifficultyParams('hard', 20).ghostSpeed).toBeLessThanOrEqual(GHOST_SPEED_CAP);
  });

  it('adds a ghost every 3 levels, capped at 4', () => {
    expect(getDifficultyParams('easy', 1).numGhosts).toBe(2);
    expect(getDifficultyParams('easy', 7).numGhosts).toBe(4);
    expect(getDifficultyParams('hard', 10).numGhosts).toBe(4);
  });

  it('respects power/release floors', () => {
    const p = getDifficultyParams('hard', 20);
    expect(p.powerDuration).toBeGreaterThanOrEqual(1500);
    expect(p.releaseInterval).toBeGreaterThanOrEqual(1000);
  });

  it('ramps harder each level (more/faster ghosts, shorter power)', () => {
    const l1 = getDifficultyParams('medium', 1);
    const l5 = getDifficultyParams('medium', 5);
    expect(l5.ghostSpeed).toBeGreaterThan(l1.ghostSpeed);
    expect(l5.numGhosts).toBeGreaterThanOrEqual(l1.numGhosts);
    expect(l5.powerDuration).toBeLessThan(l1.powerDuration);
    expect(l5.releaseInterval).toBeLessThan(l1.releaseInterval);
  });
});
