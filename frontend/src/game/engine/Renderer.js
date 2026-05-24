// ==================== Renderer ====================
// Canvas 2D renderer. Static walls are baked once to an offscreen layer per
// maze (the original redrew all 399 wall cells every frame); dots/power are
// drawn live because they change/animate.
import { CELL, COLS, ROWS, W, H, WALL, DOT, POWER } from '../../config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = W;
    canvas.height = H;
    this.ctx.imageSmoothingEnabled = true;

    this.wallLayer = document.createElement('canvas');
    this.wallLayer.width = W;
    this.wallLayer.height = H;
    this.wallCtx = this.wallLayer.getContext('2d');
  }

  // Bake the immutable wall geometry and index pellet cells. Call once whenever
  // the maze is (re)built. Indexing pellets here means the per-frame draw only
  // visits ~190 pellet cells instead of scanning all ROWS*COLS each frame.
  bakeWalls(maze) {
    const c = this.wallCtx;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#0d0820';
    c.strokeStyle = 'rgba(61,26,255,0.6)';
    c.lineWidth = 1;
    this.pellets = [];
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const t = maze[r][col];
        if (t === WALL) {
          const x = col * CELL;
          const y = r * CELL;
          c.fillRect(x, y, CELL, CELL);
          c.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
        } else if (t === DOT || t === POWER) {
          this.pellets.push({ r, col });
        }
      }
    }
  }

  _drawPellets(maze) {
    const ctx = this.ctx;
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.005);
    const pellets = this.pellets || [];
    for (let i = 0; i < pellets.length; i++) {
      const { r, col } = pellets[i];
      const t = maze[r][col];
      if (t === DOT) {
        ctx.fillStyle = 'rgba(0,245,255,0.7)';
        ctx.beginPath();
        ctx.arc(col * CELL + CELL / 2, r * CELL + CELL / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (t === POWER) {
        ctx.fillStyle = `rgba(255,230,0,${pulse})`;
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(col * CELL + CELL / 2, r * CELL + CELL / 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  render({ maze, player, ghosts, powerActive, mascotImg }) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.wallLayer, 0, 0);
    this._drawPellets(maze);
    for (const g of ghosts) g.draw(ctx);
    player.draw(ctx, mascotImg, powerActive);
  }
}
