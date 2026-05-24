// ==================== Screen switching ====================
import { qsa, $ } from '../utils/dom.js';

export function showScreen(id) {
  qsa('.screen').forEach((s) => s.classList.remove('active'));
  $(id)?.classList.add('active');
}
