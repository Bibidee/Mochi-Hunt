import { describe, it, expect } from 'vitest';
import { buildMaze, isWalkable, wrapCol } from '../src/game/physics/grid.js';
import { COLS, ROWS } from '../src/config.js';

describe('grid', () => {
  it('builds a maze and counts collectibles', () => {
    const { maze, dots } = buildMaze();
    expect(maze.length).toBe(ROWS);
    expect(maze[0].length).toBe(COLS);
    expect(dots).toBeGreaterThan(100);
  });

  it('treats walls as blocked and dots as walkable', () => {
    const { maze } = buildMaze();
    expect(isWalkable(maze, 0, 0)).toBe(false); // corner wall
    expect(isWalkable(maze, 1, 1)).toBe(true); // dot
  });

  it('wraps columns for the side tunnel', () => {
    expect(wrapCol(-1)).toBe(COLS - 1);
    expect(wrapCol(COLS)).toBe(0);
    const { maze } = buildMaze();
    expect(isWalkable(maze, 10, -1)).toBe(true); // tunnel row wraps to the far side
  });

  it('lets only ghosts enter the ghost house', () => {
    const { maze } = buildMaze();
    expect(isWalkable(maze, 9, 9, false)).toBe(false);
    expect(isWalkable(maze, 9, 9, true)).toBe(true);
  });
});
