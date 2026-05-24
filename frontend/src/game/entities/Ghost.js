// ==================== Ghost entity ====================
// Grid-locked, dt-scaled movement with greedy target-seeking AI, frighten and
// eaten states, and tunnel wrapping. All timers are in SECONDS.
import { CELL, COLS, ROWS, W, GHOST_COLORS } from '../../config.js';
import { isWalkable, wrapCol } from '../physics/grid.js';
import { choice } from '../../utils/math.js';

const DIRS = [
  { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
];

export class Ghost {
  constructor(idx) {
    this.idx = idx;
    this.color = GHOST_COLORS[idx % GHOST_COLORS.length];
    this.homeCol = 8 + (idx % 3);
    this.homeRow = 9;
    this.reset({ speed: 3, releaseDelay: 0 });
  }

  reset({ speed, releaseDelay }) {
    this.speed = speed;
    this.fromCol = this.homeCol; this.fromRow = this.homeRow;
    this.toCol = this.homeCol; this.toRow = this.homeRow;
    this.pct = 0;
    this.dx = 0; this.dy = -1;
    this.released = false;
    this.releaseDelay = releaseDelay;
    this.frightened = false; this.frightenTimer = 0;
    this.eaten = false; this.eatenTimer = 0;
    this.waveT = 0;
    this.targetRow = 1; this.targetCol = 1;
    this._updatePixel();
  }

  frighten(durationSec) {
    if (this.eaten) return;
    this.frightened = true;
    this.frightenTimer = durationSec;
  }

  markEaten() {
    this.eaten = true;
    this.frightened = false;
    this.eatenTimer = 3; // seconds before respawn
  }

  _respawn() {
    this.eaten = false;
    this.frightened = false;
    this.fromCol = this.homeCol; this.fromRow = this.homeRow;
    this.toCol = this.homeCol; this.toRow = this.homeRow;
    this.pct = 0;
    this._updatePixel();
  }

  _setTarget(playerRow, playerCol) {
    if (this.frightened) {
      this.targetRow = ROWS - 2;
      this.targetCol = Math.floor(Math.random() * COLS);
      return;
    }
    switch (this.idx) {
      case 0: this.targetRow = playerRow; this.targetCol = playerCol; break;
      case 1: this.targetRow = playerRow - 2; this.targetCol = playerCol + 2; break;
      case 2: this.targetRow = playerRow + 2; this.targetCol = playerCol - 2; break;
      default: this.targetRow = ROWS - 3; this.targetCol = 1; break;
    }
  }

  _moveStep(maze) {
    const rev = { dx: -this.dx, dy: -this.dy };
    let valid = DIRS.filter((d) => {
      if (d.dx === rev.dx && d.dy === rev.dy) return false;
      return isWalkable(maze, this.fromRow + d.dy, this.fromCol + d.dx, true);
    });
    if (!valid.length) {
      valid = DIRS.filter((d) => isWalkable(maze, this.fromRow + d.dy, this.fromCol + d.dx, true));
    }
    if (!valid.length) return;

    let best;
    if (this.frightened) {
      best = choice(valid);
    } else {
      let bestD = Infinity;
      for (const d of valid) {
        const nr = this.fromRow + d.dy;
        const nc = this.fromCol + d.dx;
        const dd = (nr - this.targetRow) ** 2 + (nc - this.targetCol) ** 2;
        if (dd < bestD) { bestD = dd; best = d; }
      }
    }
    this.dx = best.dx; this.dy = best.dy;
    this.toCol = this.fromCol + best.dx;
    this.toRow = this.fromRow + best.dy;
  }

  _arrive() {
    this.pct = 0;
    this.fromCol = wrapCol(this.toCol);
    this.fromRow = this.toRow;
    this.toCol = this.fromCol;
    this.toRow = this.fromRow;
  }

  _updatePixel() {
    this.x = (this.fromCol + (this.toCol - this.fromCol) * this.pct) * CELL + CELL / 2;
    this.y = (this.fromRow + (this.toRow - this.fromRow) * this.pct) * CELL + CELL / 2;
    if (this.x < 0) this.x += W;
    if (this.x >= W) this.x -= W;
  }

  update(dt, maze, playerRow, playerCol) {
    this.waveT += dt * 3;

    if (!this.released) {
      this.releaseDelay -= dt;
      if (this.releaseDelay <= 0) this.released = true;
      return;
    }
    if (this.eaten) {
      this.eatenTimer -= dt;
      if (this.eatenTimer <= 0) this._respawn();
      return;
    }
    if (this.frightened) {
      this.frightenTimer -= dt;
      if (this.frightenTimer <= 0) this.frightened = false;
    }

    this._setTarget(playerRow, playerCol);

    const effSpeed = this.frightened ? this.speed * 0.6 : this.speed;
    let remaining = effSpeed * dt;
    let guard = 0;
    do {
      if (this.pct === 0 && this.toCol === this.fromCol && this.toRow === this.fromRow) {
        this._moveStep(maze);
      }
      const need = 1 - this.pct;
      if (remaining < need) { this.pct += remaining; remaining = 0; }
      else { remaining -= need; this._arrive(); }
      guard++;
    } while (remaining > 0 && guard < 8);

    this._updatePixel();
  }

  draw(ctx) {
    if (!this.released && !this.eaten) return;
    const x = this.x;
    const y = this.y + Math.sin(this.waveT) * 2;
    const r = CELL * 0.42;
    ctx.save();
    if (this.eaten) {
      ctx.globalAlpha = 0.5;
      this._drawEyes(ctx, x, y, r);
      ctx.restore();
      return;
    }
    const blinking = this.frightened && this.frightenTimer < 2 && Math.floor(performance.now() / 200) % 2 === 0;
    const col = this.frightened ? (blinking ? '#fff' : '#0022ff') : this.color;
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.1, r, Math.PI, 0);
    const segs = 4;
    for (let i = 0; i <= segs; i++) {
      const px = x + r * (1 - (i * 2) / segs);
      const py = y + r * 0.9 + (i % 2 === 0 ? r * 0.25 : -r * 0.25);
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    this._drawEyes(ctx, x, y, r);
    ctx.restore();
  }

  _drawEyes(ctx, x, y, r) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.1, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.28, y - r * 0.1, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#00f5ff';
    ctx.beginPath(); ctx.arc(x - r * 0.22, y - r * 0.08, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.34, y - r * 0.08, r * 0.12, 0, Math.PI * 2); ctx.fill();
  }
}
