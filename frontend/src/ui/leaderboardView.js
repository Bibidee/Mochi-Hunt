// ==================== Leaderboard view (on-chain) ====================
// Reads verified entries straight from the GenLayer contract (get_top). Rows are
// built with textContent only (no innerHTML) — XSS-safe.
import { $, clearChildren, setText, el } from '../utils/dom.js';
import { fetchTop, contractConfigured } from '../game/blockchain/wallet.js';

const COLSPAN = 6;

function messageRow(cls, text) {
  const tr = document.createElement('tr');
  const td = el('td', { className: cls, text });
  td.setAttribute('colspan', String(COLSPAN));
  tr.appendChild(td);
  return tr;
}

function verifyBadge(entry) {
  const td = el('td');
  const badge = el('span', { className: 'verify-badge', text: '⛓' });
  badge.title = `Verified on-chain by GenLayer${entry.reason ? `: ${entry.reason}` : ''}`;
  badge.style.color = 'var(--neon-cyan)';
  td.appendChild(badge);
  return td;
}

export async function renderLeaderboard(limit = 10) {
  const body = $('lb-body');
  const source = $('lb-source');
  if (!body) return;

  setText(source, '');
  clearChildren(body);

  if (!contractConfigured) {
    body.appendChild(messageRow('lb-error', 'Leaderboard unavailable — contract address not configured'));
    return;
  }

  body.appendChild(messageRow('lb-loading', 'LOADING…'));

  try {
    const entries = await fetchTop(limit);
    clearChildren(body);
    if (!entries.length) {
      body.appendChild(messageRow('lb-empty', 'No scores yet — be the first on-chain!'));
    } else {
      entries.forEach((e, i) => {
        const tr = document.createElement('tr');
        const rank = el('td');
        rank.appendChild(el('span', { className: 'rank-badge', text: i + 1 }));
        const name = el('td', { text: e.name ?? '—' });
        const scoreCell = el('td', { text: Number(e.score || 0).toLocaleString() });
        scoreCell.style.color = 'var(--neon-yellow)';
        const level = el('td', { text: 'Lv.' + (e.level ?? 1) });
        const diff = el('td', { text: e.difficulty ?? '—' });
        tr.append(rank, name, scoreCell, level, diff, verifyBadge(e));
        body.appendChild(tr);
      });
    }
    setText(source, '● on-chain · studionet');
  } catch (err) {
    clearChildren(body);
    body.appendChild(messageRow('lb-error', `Failed to load: ${err.message}`));
  }
}
