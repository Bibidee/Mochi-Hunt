// ==================== Win/Lose overlay ====================
import { $, setText } from '../utils/dom.js';

export function showOverlay({ win, snapshot, genlayerMsg }) {
  const title = $('ov-title');
  setText(title, win ? '🎉 YOU WIN!' : '💀 GAME OVER');
  title.className = 'overlay-title ' + (win ? 'win' : 'lose');

  setText(
    $('ov-msg'),
    win
      ? `Level ${snapshot.level} cleared, ${snapshot.username}!`
      : `Better luck next time, ${snapshot.username}!`,
  );
  setText($('ov-score'), `Score: ${snapshot.score.toLocaleString()}`);

  const gl = $('ov-genlayer');
  if (genlayerMsg) {
    setText(gl, genlayerMsg);
    gl.style.display = 'block';
  } else {
    gl.style.display = 'none';
  }

  $('ov-next-btn').style.display = win && snapshot.canAdvance ? 'inline-block' : 'none';
  $('overlay').classList.add('active');
}

export function hideOverlay() {
  $('overlay').classList.remove('active');
}
