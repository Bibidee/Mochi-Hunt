import { describe, it, expect } from 'vitest';
import { Player } from '../src/game/entities/Player.js';
import { buildMaze } from '../src/game/physics/grid.js';

function simulate(player, maze, speed, totalTime, dt) {
  let t = 0;
  while (t < totalTime - 1e-9) {
    const step = Math.min(dt, totalTime - t);
    player.update(step, maze, speed);
    t += step;
  }
}

describe('Player movement', () => {
  it('is frame-rate independent (same distance for same elapsed time)', () => {
    const { maze } = buildMaze();
    const make = () => { const p = new Player({ row: 1, col: 1 }); p.setDir(1, 0); return p; };

    const a = make(); simulate(a, maze, 5, 1.0, 1 / 60);
    const b = make(); simulate(b, maze, 5, 1.0, 1 / 120);

    expect(a.gridCol).toBe(b.gridCol);
    expect(a.x).toBeCloseTo(b.x, 4);
  });

  it('wraps through the side tunnel', () => {
    const { maze } = buildMaze();
    const p = new Player({ row: 10, col: 1 });
    p.setDir(-1, 0);
    simulate(p, maze, 5, 2.0, 1 / 60);
    expect(p.gridRow).toBe(10);
    expect(p.gridCol).toBeGreaterThan(10); // came back around the far side
  });

  it('stops at a wall', () => {
    const { maze } = buildMaze();
    const p = new Player({ row: 1, col: 1 });
    p.setDir(-1, 0); // col 0 is a wall
    simulate(p, maze, 5, 1.0, 1 / 60);
    expect(p.gridCol).toBe(1);
  });
});
