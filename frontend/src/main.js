// ==================== Bootstrap ====================
import './styles/main.css';
import { W, H } from './config.js';
import { store } from './state/store.js';
import { audio } from './game/engine/Audio.js';
import { preloadAll } from './game/engine/AssetLoader.js';
import { Game } from './game/engine/Game.js';
import { Input } from './game/engine/Input.js';
import { initHud } from './ui/hud.js';
import { showScreen } from './ui/screens.js';
import { showOverlay, hideOverlay } from './ui/overlay.js';
import { renderLeaderboard } from './ui/leaderboardView.js';
import { submitScore } from './game/leaderboard/leaderboardClient.js';
import { verificationMessage } from './game/blockchain/genlayerClient.js';
import { $, setText } from './utils/dom.js';

const SPRITE_URL = '/assets/sprites/mochi.jpg';

function resizeCanvas(canvas) {
  if (!canvas) return;
  const isMobile = window.innerWidth <= 700 || window.innerHeight <= 700;
  let scale;
  if (isMobile) {
    const avW = window.innerWidth - 12;
    const avH = window.innerHeight - 320; // room for HUD + actions + dpad
    scale = Math.min(avW / W, avH / H, 1);
  } else {
    scale = Math.min(1, (window.innerWidth - 220) / W, (window.innerHeight - 40) / H);
  }
  scale = Math.max(scale, 0.3);
  canvas.style.width = Math.floor(W * scale) + 'px';
  canvas.style.height = Math.floor(H * scale) + 'px';
}

async function handleEnd(win, snapshot) {
  // Submit on both win AND game-over — a run's score counts either way.
  // Skip only an empty (0) score so we don't pollute the leaderboard.
  if (snapshot.score <= 0) {
    showOverlay({ win, snapshot, genlayerMsg: null });
    return;
  }
  showOverlay({ win, snapshot, genlayerMsg: '⏳ Submitting score…' });
  const result = await submitScore({
    name: snapshot.username,
    score: snapshot.score,
    level: snapshot.level,
    difficulty: snapshot.difficulty,
    duration_ms: snapshot.durationMs,
    dots_eaten: snapshot.dotsEaten,
    ghosts_eaten: snapshot.ghostsEaten,
  });
  const msg = verificationMessage(result);
  if (msg) setText($('ov-genlayer'), msg);
}

async function init() {
  const canvas = $('game-canvas');
  const assets = await preloadAll({ mochi: SPRITE_URL });

  const game = new Game({
    canvas,
    assets,
    callbacks: {
      onWin: (snap) => handleEnd(true, snap),
      onLose: (snap) => handleEnd(false, snap),
    },
  });

  initHud(SPRITE_URL);
  resizeCanvas(canvas);
  window.addEventListener('resize', () => resizeCanvas(canvas));

  // Reflect pause state onto the game area (CSS overlay).
  store.subscribe((s) => {
    $('game-area')?.classList.toggle('paused', s.status === 'paused');
  });

  // Auto-pause when the tab is hidden mid-game.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && store.get().status === 'playing') game.pause();
  });

  // ---- Input (movement) ----
  const input = new Input({
    canvas,
    isActive: () => store.get().status === 'playing',
    onDirection: (dir) => game.setDirection(dir),
    onPause: () => game.togglePause(),
  });
  input.attach();

  // ---- Start screen ----
  $('start-btn').addEventListener('click', () => {
    const name = ($('username-input').value.trim() || 'MOCHI').toUpperCase();
    store.set({ username: name });
    store.resetRun();
    audio.unlock();
    showScreen('game-screen');
    resizeCanvas(canvas);
    game.startRun();
  });
  $('username-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('start-btn').click();
  });
  document.querySelectorAll('.diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      store.set({ difficulty: btn.dataset.diff });
    });
  });

  // ---- Leaderboard ----
  $('lb-btn').addEventListener('click', () => { showScreen('lb-screen'); renderLeaderboard(); });
  $('lb-back-btn').addEventListener('click', () => showScreen('start-screen'));

  // ---- In-game controls (desktop + mobile share handlers) ----
  const toMenu = () => { game.stop(); hideOverlay(); store.set({ status: 'menu' }); showScreen('start-screen'); };
  const doRestart = () => { hideOverlay(); game.restartRun(); };
  const toggleSound = () => {
    const on = !store.get().soundOn;
    store.set({ soundOn: on });
    audio.setEnabled(on);
    setText($('sound-btn'), on ? '🔊 Sound ON' : '🔇 Sound OFF');
    setText($('sound-btn-m'), on ? '🔊' : '🔇');
  };

  $('restart-btn').addEventListener('click', doRestart);
  $('restart-btn-m').addEventListener('click', doRestart);
  $('menu-btn').addEventListener('click', toMenu);
  $('menu-btn-m').addEventListener('click', toMenu);
  $('sound-btn').addEventListener('click', toggleSound);
  $('sound-btn-m').addEventListener('click', toggleSound);
  $('pause-btn').addEventListener('click', () => game.togglePause());
  $('pause-btn-m').addEventListener('click', () => game.togglePause());

  // ---- Overlay buttons ----
  $('ov-next-btn').addEventListener('click', () => { hideOverlay(); game.nextLevel(); });
  $('ov-restart-btn').addEventListener('click', doRestart);
  $('ov-menu-btn').addEventListener('click', toMenu);

  // Dev-only debug handle for tests/E2E (stripped from production builds).
  if (import.meta.env?.DEV) window.__mochi = { game, store };
}

init().catch((err) => {
  console.error('[mochi-hunt] init failed:', err);
});
