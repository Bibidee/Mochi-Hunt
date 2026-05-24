// ==================== Maze grid helpers ====================
// Pure functions over a 2D maze array. No globals, no rendering.
import { MAZE_BASE, ROWS, COLS, WALL, DOT, POWER, GHOST_HOUSE } from '../../config.js';

// Build a fresh mutable maze + count of collectible tiles (dots + power pellets).
export function buildMaze() {
  const maze = MAZE_BASE.map((row) => row.slice());
  let dots = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (maze[r][c] === DOT || maze[r][c] === POWER) dots++;
    }
  }
  return { maze, dots };
}

// Horizontal wrap (the side tunnel). Rows do not wrap.
export function wrapCol(c) {
  if (c < 0) return c + COLS;
  if (c >= COLS) return c - COLS;
  return c;
}

// A cell is walkable if it is inside the vertical bounds and not a wall.
// Columns wrap so the side tunnel works. Ghost-house tiles are walkable for
// ghosts but not the player — callers pass `allowGhostHouse` accordingly.
export function isWalkable(maze, r, c, allowGhostHouse = false) {
  if (r < 0 || r >= ROWS) return false;
  const cc = wrapCol(c);
  const t = maze[r][cc];
  if (t === WALL) return false;
  if (t === GHOST_HOUSE && !allowGhostHouse) return false;
  return true;
}

export function tileAt(maze, r, c) {
  if (r < 0 || r >= ROWS) return WALL;
  return maze[r][wrapCol(c)];
}
