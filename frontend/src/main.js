// ==================== Bootstrap (client-side wallet dApp) ====================
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
import {
  connectWallet, registerUsername, submitScore, getRegisteredName,
  isWalletAvailable, isConnected, shortAddress, contractConfigured,
} from './game/blockchain/wallet.js';
import { $, setText } from './utils/dom.js';

const SPRITE_URL = '/assets/sprites/mochi.jpg';

let registered = false;     // current wallet has a registered username
let lastSnapshot = null;    // last game-end snapshot, for the submit button

function resizeCanvas(canvas) {
  if (!canvas) return;
  const isMobile = window.innerWidth <= 700 || window.innerHeight <= 700;
  let scale;
  if (isMobile) {
    scale = Math.min((window.innerWidth - 12) / W, (window.innerHeight - 320) / H, 1);
  } else {
    scale = Math.min(1, (window.innerWidth - 220) / W, (window.innerHeight - 40) / H);
  }
  scale = Math.max(scale, 0.3);
  canvas.style.width = Math.floor(W * scale) + 'px';
  canvas.style.height = Math.floor(H * scale) + 'px';
}

function setNote(text, isError = false) {
  const note = $('onchain-note');
  setText(note, text);
  note.classList.toggle('error', isError);
}

function refreshGate() {
  // Launch requires a connected wallet with a registered username.
  $('start-btn').disabled = !(isConnected() && registered);
  $('register-btn').disabled = !isConnected();
}

async function handleEnd(win, snapshot) {
  lastSnapshot = snapshot;
  showOverlay({ win, snapshot, genlayerMsg: null });
  const submitBtn = $('ov-submit-btn');
  if (snapshot.score <= 0) { submitBtn.style.display = 'none'; return; }
  submitBtn.style.display = 'inline-block';
  submitBtn.disabled = !(isConnected() && registered);
  submitBtn.textContent = '⛓ Submit Score On-Chain';
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
  store.subscribe((s) => $('game-area')?.classList.toggle('paused', s.status === 'paused'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && store.get().status === 'playing') game.pause();
  });

  const input = new Input({
    canvas,
    isActive: () => store.get().status === 'playing',
    onDirection: (dir) => game.setDirection(dir),
    onPause: () => game.togglePause(),
  });
  input.attach();

  // ---- Initial gate state ----
  if (!contractConfigured) {
    setNote('Contract address not set (VITE_GENLAYER_CONTRACT_ADDRESS).', true);
  } else if (!isWalletAvailable()) {
    setNote('No wallet detected — install MetaMask to play on-chain.', true);
  }
  refreshGate();

  // ---- Connect wallet ----
  $('connect-btn').addEventListener('click', async () => {
    const btn = $('connect-btn');
    btn.disabled = true;
    try {
      const addr = await connectWallet();
      setText($('wallet-status'), `Connected: ${shortAddress(addr)}`);
      $('wallet-status').classList.add('connected');
      // If this wallet already registered a name, adopt it.
      try {
        const existing = await getRegisteredName(addr);
        if (existing) {
          $('username-input').value = existing;
          store.set({ username: existing.toUpperCase() });
          registered = true;
          setNote(`Registered as "${existing}". Ready to play!`);
        } else {
          setNote('Enter a username and register it on-chain to play.');
        }
      } catch { setNote('Enter a username and register it on-chain to play.'); }
    } catch (err) {
      setNote(err.message, true);
    } finally {
      btn.disabled = false;
      refreshGate();
    }
  });

  // ---- Register username (on-chain txn #1) ----
  $('register-btn').addEventListener('click', async () => {
    const name = ($('username-input').value || '').trim();
    if (!name) { setNote('Enter a username first.', true); return; }
    const btn = $('register-btn');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Registering… confirm in wallet';
    setNote('Confirm the transaction in your wallet… (this can take ~30–60s)');
    try {
      await registerUsername(name);
      registered = true;
      store.set({ username: name.toUpperCase() });
      setNote(`Registered as "${name}" on-chain. Ready to play!`);
    } catch (err) {
      registered = false;
      setNote(`Registration failed: ${err.message}`, true);
    } finally {
      btn.textContent = original;
      refreshGate();
    }
  });

  $('username-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !$('register-btn').disabled) $('register-btn').click();
  });

  // ---- Difficulty ----
  document.querySelectorAll('.diff-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      store.set({ difficulty: b.dataset.diff });
    });
  });

  // ---- Launch ----
  $('start-btn').addEventListener('click', () => {
    if (!(isConnected() && registered)) { setNote('Connect + register first.', true); return; }
    store.resetRun();
    audio.unlock();
    showScreen('game-screen');
    resizeCanvas(canvas);
    game.startRun();
  });

  // ---- Leaderboard ----
  $('lb-btn').addEventListener('click', () => { showScreen('lb-screen'); renderLeaderboard(); });
  $('lb-back-btn').addEventListener('click', () => showScreen('start-screen'));

  // ---- In-game controls ----
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

  // ---- Submit score (on-chain txn #2) ----
  $('ov-submit-btn').addEventListener('click', async () => {
    if (!lastSnapshot) return;
    if (!(isConnected() && registered)) { setText($('ov-genlayer'), '⚠️ Connect + register to submit.'); $('ov-genlayer').style.display = 'block'; return; }
    const btn = $('ov-submit-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Submitting… confirm in wallet';
    const gl = $('ov-genlayer');
    gl.style.display = 'block';
    setText(gl, 'Confirm in wallet — GenLayer is judging your score (~30–60s)…');
    try {
      const result = await submitScore({
        score: lastSnapshot.score,
        level: lastSnapshot.level,
        difficulty: lastSnapshot.difficulty,
        duration_ms: lastSnapshot.durationMs,
        dots_eaten: lastSnapshot.dotsEaten,
        ghosts_eaten: lastSnapshot.ghostsEaten,
      });
      if (result.accepted) {
        setText(gl, '🏆 Verified on-chain by GenLayer — you made the leaderboard!');
        btn.textContent = '✓ Submitted';
      } else {
        setText(gl, '⚠️ Score rejected on-chain (anti-cheat). Not recorded.');
        btn.textContent = '⛓ Submit Score On-Chain';
        btn.disabled = false;
      }
    } catch (err) {
      setText(gl, `Submit failed: ${err.message}`);
      btn.textContent = '⛓ Submit Score On-Chain';
      btn.disabled = false;
    }
  });

  // ---- Overlay buttons ----
  $('ov-next-btn').addEventListener('click', () => { hideOverlay(); game.nextLevel(); });
  $('ov-restart-btn').addEventListener('click', doRestart);
  $('ov-menu-btn').addEventListener('click', toMenu);

  if (import.meta.env?.DEV) window.__mochi = { game, store };
}

init().catch((err) => console.error('[mochi-hunt] init failed:', err));
