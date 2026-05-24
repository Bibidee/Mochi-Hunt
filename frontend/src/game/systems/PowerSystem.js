// ==================== Power-pellet system ====================
// Tracks the frightened window and the ghost-eat combo multiplier
// (200 -> 400 -> 800 -> 1600 within a single power window, like classic Pac-Man).
import { SCORE_GHOST } from '../../config.js';

export class PowerSystem {
  constructor() {
    this.active = false;
    this.timer = 0;       // seconds remaining
    this.eatenCount = 0;  // ghosts eaten in the current window
  }

  reset() {
    this.active = false;
    this.timer = 0;
    this.eatenCount = 0;
  }

  // Activate for `durationSec`, frightening all live ghosts.
  activate(durationSec, ghosts) {
    this.active = true;
    this.timer = durationSec;
    this.eatenCount = 0;
    ghosts.forEach((g) => g.frighten(durationSec));
  }

  update(dt) {
    if (!this.active) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.active = false;
      this.timer = 0;
      this.eatenCount = 0;
    }
  }

  // Score for eating one ghost, doubling per ghost in this window.
  scoreForEat() {
    const points = SCORE_GHOST * 2 ** this.eatenCount;
    this.eatenCount += 1;
    return points;
  }
}
