// ==================== Player entity ====================
// Grid-locked movement with smooth interpolation. Speed is in cells/second and
// scaled by real delta-time, so the game runs identically at 30/60/120/144 Hz.
import { CELL, W } from '../../config.js';
import { isWalkable, wrapCol } from '../physics/grid.js';

export class Player {
  constructor(spawn) {
    this.spawn = spawn;
    this.reset();
  }

  reset() {
    const { row, col } = this.spawn;
    this.fromCol = col; this.fromRow = row;
    this.toCol = col; this.toRow = row;
    this.pct = 0;
    this.dx = 0; this.dy = 0;     // current heading
    this.ndx = 0; this.ndy = 0;   // buffered input
    this.dead = false; this.deadTimer = 0;
    this.bobT = 0;
    this.radius = CELL * 0.42;
    this._updatePixel();
  }

  setDir(dx, dy) { this.ndx = dx; this.ndy = dy; }

  get gridRow() { return this.fromRow; }
  get gridCol() { return this.fromCol; }

  _chooseNext(maze) {
    // Prefer buffered input if it is walkable.
    if (this.ndx || this.ndy) {
      if (isWalkable(maze, this.fromRow + this.ndy, this.fromCol + this.ndx)) {
        this.dx = this.ndx; this.dy = this.ndy;
        this.ndx = 0; this.ndy = 0;
        this.toCol = this.fromCol + this.dx;
        this.toRow = this.fromRow + this.dy;
        return;
      }
      // keep buffer — player may reach a junction shortly
    }
    // Otherwise continue current heading if possible.
    if (this.dx || this.dy) {
      if (isWalkable(maze, this.fromRow + this.dy, this.fromCol + this.dx)) {
        this.toCol = this.fromCol + this.dx;
        this.toRow = this.fromRow + this.dy;
        return;
      }
      this.dx = 0; this.dy = 0; // blocked
    }
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

  // Advance by dt seconds at `speed` cells/sec. Returns an array of {r,c}
  // cells newly arrived at this tick (for dot collection).
  update(dt, maze, speed) {
    if (this.dead) { this.deadTimer += dt; return []; }
    this.bobT += dt * 5;

    const arrived = [];
    let remaining = (this.dx || this.dy || this.ndx || this.ndy) ? speed * dt : 0;
    let guard = 0;

    do {
      if (this.pct === 0 && this.toCol === this.fromCol && this.toRow === this.fromRow) {
        this._chooseNext(maze);
      }
      if (!(this.dx || this.dy)) break;

      const need = 1 - this.pct;
      if (remaining < need) { this.pct += remaining; remaining = 0; }
      else {
        remaining -= need;
        this._arrive();
        arrived.push({ r: this.fromRow, c: this.fromCol });
      }
      guard++;
    } while (remaining > 0 && guard < 8);

    this._updatePixel();
    return arrived;
  }

  draw(ctx, img, powerActive) {
    if (this.dead) return;
    const bob = Math.sin(this.bobT) * 3;
    const r = this.radius;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y + bob, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 12;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, this.x - r, this.y + bob - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = '#bf5fff';
      ctx.fill();
    }
    ctx.restore();
    if (powerActive) {
      ctx.beginPath();
      ctx.arc(this.x, this.y + bob, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,245,255,${0.4 + 0.3 * Math.sin(performance.now() * 0.01)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
