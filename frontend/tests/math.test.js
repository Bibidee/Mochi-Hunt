import { describe, it, expect } from 'vitest';
import { clamp, dist } from '../src/utils/math.js';

describe('math helpers', () => {
  it('clamp keeps values within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('dist computes Euclidean distance', () => {
    expect(dist(0, 0, 3, 4)).toBe(5);
  });
});
