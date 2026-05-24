// ==================== Global game configuration ====================
// Pure constants only — no DOM, no state. Imported everywhere.

export const CELL = 32;
export const COLS = 19;
export const ROWS = 21;
export const W = COLS * CELL;
export const H = ROWS * CELL;

export const MAX_LEVEL = 10;
export const START_LIVES = 3;

// Tile types
export const WALL = 0;
export const DOT = 1;
export const EMPTY = 2;
export const POWER = 3;
export const GHOST_HOUSE = 4;

// Scoring
export const SCORE_DOT = 10;
export const SCORE_POWER = 50;
export const SCORE_GHOST = 200;

// Theme colors (kept in sync with CSS custom properties)
export const COLORS = {
  cyan: '#00f5ff',
  purple: '#bf5fff',
  pink: '#ff2d78',
  yellow: '#ffe600',
  wall: '#0d0820',
  wallGlow: 'rgba(61,26,255,0.6)',
};

export const GHOST_COLORS = ['#ff2d78', '#ff9500', '#00f5ff', '#bf5fff'];

// Base maze template (0=wall,1=dot,2=empty,3=power pellet,4=ghost house)
export const MAZE_BASE = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0],
  [0,3,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,3,0],
  [0,1,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,1,0],
  [0,1,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,1,0],
  [0,0,0,0,1,0,0,0,2,0,2,0,0,0,1,0,0,0,0],
  [0,0,0,0,1,0,2,2,2,2,2,2,2,0,1,0,0,0,0],
  [0,0,0,0,1,0,2,0,4,4,4,0,2,0,1,0,0,0,0],
  [2,2,2,2,1,2,2,0,4,4,4,0,2,2,1,2,2,2,2],
  [0,0,0,0,1,0,2,0,0,0,0,0,2,0,1,0,0,0,0],
  [0,0,0,0,1,0,2,2,2,2,2,2,2,0,1,0,0,0,0],
  [0,0,0,0,1,0,2,0,0,0,0,0,2,0,1,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1,0],
  [0,3,1,0,1,1,1,1,1,2,1,1,1,1,1,0,1,3,0],
  [0,0,1,0,1,0,1,0,0,0,0,0,1,0,1,0,1,0,0],
  [0,1,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,1,0],
  [0,1,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// Player spawn (row, col)
export const PLAYER_SPAWN = { row: 16, col: 9 };

// Difficulty presets. Speeds are in CELLS PER SECOND (frame-rate independent).
// Durations are in milliseconds.
export const DIFFICULTY = {
  easy:   { playerSpeed: 4.0, ghostSpeed: 2.4, numGhosts: 2, powerDuration: 8000, releaseInterval: 5000 },
  medium: { playerSpeed: 4.8, ghostSpeed: 3.1, numGhosts: 3, powerDuration: 6000, releaseInterval: 4000 },
  hard:   { playerSpeed: 5.6, ghostSpeed: 4.0, numGhosts: 4, powerDuration: 4000, releaseInterval: 3000 },
};

export const GHOST_SPEED_CAP = 7.5; // cells/sec ceiling after level scaling

// Compute effective difficulty parameters for a given base difficulty + level.
// Difficulty ramps harder each level: ghosts get faster (steeper ramp), more
// ghosts arrive sooner (+1 every 2 levels), power pellets wear off faster, and
// ghosts leave the house sooner. Player speed stays constant so skilled juking
// at intersections remains the counterplay.
export function getDifficultyParams(difficulty, level) {
  const d = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  const factor = 1 + (level - 1) * 0.16;
  return {
    playerSpeed: d.playerSpeed,
    ghostSpeed: Math.min(d.ghostSpeed * factor, GHOST_SPEED_CAP),
    numGhosts: Math.min(d.numGhosts + Math.floor((level - 1) / 2), 4),
    powerDuration: Math.max(d.powerDuration - (level - 1) * 500, 1500),
    releaseInterval: Math.max(d.releaseInterval - (level - 1) * 300, 1000),
  };
}
