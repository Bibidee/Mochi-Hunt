// ==================== Game orchestrator ====================
// Owns the live simulation (maze, player, ghosts, systems) and the lifecycle:
// build level -> play -> death/respawn -> win/lose. Meta state (score, lives,
// level, dots, status) lives in the reactive store; lifecycle moments are
// reported to the UI via the callbacks passed in.
import {
  PLAYER_SPAWN, DOT, POWER, EMPTY,
  SCORE_DOT, SCORE_POWER, MAX_LEVEL, START_LIVES,
  getDifficultyParams,
} from '../../config.js';
import { store } from '../../state/store.js';
import { buildMaze } from '../physics/grid.js';
import { Player } from '../entities/Player.js';
import { Ghost } from '../entities/Ghost.js';
import { PowerSystem } from '../systems/PowerSystem.js';
import { detectCollisions } from '../systems/CollisionSystem.js';
import { Renderer } from './Renderer.js';
import { Loop } from './Loop.js';
import { audio } from './Audio.js';

const DEATH_PAUSE_SEC = 1.5;

export class Game {
  constructor({ canvas, assets, callbacks = {} }) {
    this.renderer = new Renderer(canvas);
    this.assets = assets || {};
    this.callbacks = callbacks;
    this.power = new PowerSystem();
    this.player = new Player(PLAYER_SPAWN);
    this.ghosts = [];
    this.maze = null;
    this.params = getDifficultyParams('medium', 1);
    this.deathTimer = 0;
    this.loop = new Loop((dt) => this._update(dt));
  }

  // ---- Lifecycle ----------------------------------------------------------

  // Start a fresh run from level 1 (caller has already reset score/lives via store.resetRun()).
  startRun() {
    this._buildLevel();
    store.set({ status: 'playing' });
    this.loop.start();
  }

  // Advance to the next level, keeping score; reset lives to full like the original.
  nextLevel() {
    const { level } = store.get();
    const next = Math.min(level + 1, MAX_LEVEL);
    store.set({ level: next, lives: START_LIVES });
    audio.levelUp();
    this._buildLevel();
    store.set({ status: 'playing' });
    this.loop.start();
  }

  // Restart the whole run at level 1 (score 0, lives full).
  restartRun() {
    store.set({ level: 1, score: 0, lives: START_LIVES });
    this.startRun();
  }

  pause() {
    if (store.get().status !== 'playing') return;
    store.set({ status: 'paused' });
    this.loop.stop();
  }

  resume() {
    if (store.get().status !== 'paused') return;
    store.set({ status: 'playing' });
    this.loop.start();
  }

  togglePause() {
    const s = store.get().status;
    if (s === 'playing') this.pause();
    else if (s === 'paused') this.resume();
  }

  stop() {
    this.loop.stop();
  }

  setDirection({ dx, dy }) {
    this.player.setDir(dx, dy);
  }

  // ---- Internals ----------------------------------------------------------

  _buildLevel() {
    const { difficulty, level } = store.get();
    this.params = getDifficultyParams(difficulty, level);

    const { maze, dots } = buildMaze();
    this.maze = maze;
    store.set({ dots });
    this.renderer.bakeWalls(maze);

    this.player.reset();
    this.power.reset();

    const releaseSec = this.params.releaseInterval / 1000;
    this.ghosts = [];
    for (let i = 0; i < this.params.numGhosts; i++) {
      const g = new Ghost(i);
      g.reset({ speed: this.params.ghostSpeed, releaseDelay: i * releaseSec });
      this.ghosts.push(g);
    }
    this.deathTimer = 0;
    this._renderOnce();
  }

  _respawn() {
    this.player.reset();
    this.power.reset();
    const releaseSec = this.params.releaseInterval / 1000;
    this.ghosts.forEach((g, i) => g.reset({ speed: this.params.ghostSpeed, releaseDelay: i * releaseSec }));
    store.set({ status: 'playing' });
  }

  _collect({ r, c }) {
    const t = this.maze[r][c];
    if (t === DOT) {
      this.maze[r][c] = EMPTY;
      store.addScore(SCORE_DOT);
      store.decDots();
      store.countDotEaten();
      audio.dot();
    } else if (t === POWER) {
      this.maze[r][c] = EMPTY;
      store.addScore(SCORE_POWER);
      store.decDots();
      audio.power();
      this.power.activate(this.params.powerDuration / 1000, this.ghosts);
    }
  }

  _death() {
    this.player.dead = true;
    store.loseLife();
    audio.die();
    store.set({ status: 'dying' });
    this.deathTimer = DEATH_PAUSE_SEC;
  }

  _afterDeath() {
    if (store.get().lives <= 0) this._lose();
    else this._respawn();
  }

  _win() {
    store.set({ status: 'won' });
    audio.win();
    this.loop.stop();
    this.callbacks.onWin?.(this._snapshot());
  }

  _lose() {
    store.set({ status: 'lost' });
    this.loop.stop();
    this.callbacks.onLose?.(this._snapshot());
  }

  _snapshot() {
    const s = store.get();
    return {
      username: s.username,
      score: s.score,
      level: s.level,
      difficulty: s.difficulty,
      canAdvance: s.level < MAX_LEVEL,
      // telemetry for the backend anti-cheat / GenLayer gates
      durationMs: s.startedAt ? Date.now() - s.startedAt : 0,
      dotsEaten: s.dotsEaten,
      ghostsEaten: s.ghostsEaten,
    };
  }

  _renderOnce() {
    this.renderer.render({
      maze: this.maze,
      player: this.player,
      ghosts: this.ghosts,
      powerActive: this.power.active,
      mascotImg: this.assets.mochi,
    });
  }

  _update(dt) {
    const status = store.get().status;

    if (status === 'dying') {
      this.deathTimer -= dt;
      this._renderOnce();
      if (this.deathTimer <= 0) this._afterDeath();
      return;
    }
    if (status !== 'playing') return;

    const arrived = this.player.update(dt, this.maze, this.params.playerSpeed);
    for (const cell of arrived) this._collect(cell);
    if (store.get().dots <= 0) { this._win(); return; }

    this.power.update(dt);

    const pr = this.player.gridRow;
    const pc = this.player.gridCol;
    for (const g of this.ghosts) g.update(dt, this.maze, pr, pc);

    for (const e of detectCollisions(this.player, this.ghosts)) {
      if (e.type === 'eat') {
        e.ghost.markEaten();
        store.addScore(this.power.scoreForEat());
        store.countGhostEaten();
        audio.ghostEat();
      } else if (e.type === 'death') {
        this._death();
        break;
      }
    }

    this._renderOnce();
  }
}
