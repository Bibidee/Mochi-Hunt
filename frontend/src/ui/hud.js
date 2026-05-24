// ==================== HUD ====================
// Subscribes to the store and reflects it into the DOM. Text fields update via
// textContent (XSS-safe); life icons are only rebuilt when the count changes
// (the original rebuilt them on every dot eaten).
import { $, setText, clearChildren, el } from '../utils/dom.js';
import { store } from '../state/store.js';

function renderLives(container, lives, spriteUrl) {
  if (!container) return;
  clearChildren(container);
  for (let i = 0; i < Math.max(0, lives); i++) {
    container.appendChild(el('img', { className: 'life-icon', attrs: { src: spriteUrl, alt: 'life' } }));
  }
}

export function initHud(spriteUrl) {
  let prevLives = -1;
  let prevName = null;

  store.subscribe((s) => {
    const score = s.score.toLocaleString();
    setText($('hud-score'), score);
    setText($('hud-score-m'), score);
    setText($('hud-level'), s.level);
    setText($('hud-level-m'), s.level);
    setText($('hud-dots'), s.dots);
    setText($('hud-dots-m'), s.dots);

    if (s.username !== prevName) {
      setText($('hud-name'), s.username);
      setText($('hud-name-m'), s.username);
      prevName = s.username;
    }
    if (s.lives !== prevLives) {
      renderLives($('hud-lives'), s.lives, spriteUrl);
      renderLives($('hud-lives-m'), s.lives, spriteUrl);
      prevLives = s.lives;
    }
  });
}
