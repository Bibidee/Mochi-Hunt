// ==================== Leaderboard view ====================
// Renders rows with textContent only — no innerHTML — closing the original
// stored-XSS hole where attacker-controlled player names were injected as HTML.
import { $, clearChildren, setText, el } from '../utils/dom.js';
import { fetchTop } from '../game/leaderboard/leaderboardClient.js';

const COLSPAN = 6;

function messageRow(cls, text) {
  const tr = document.createElement('tr');
  const td = el('td', { className: cls, text });
  td.setAttribute('colspan', String(COLSPAN));
  tr.appendChild(td);
  return tr;
}

function verifyBadge(entry) {
  const verified = !!entry.verified;
  const onchain = entry.verification_source === 'genlayer';
  const td = el('td');
  const badge = el('span', {
    className: 'verify-badge',
    text: verified ? (onchain ? '⛓' : '✓') : '·',
  });
  badge.title = verified
    ? (onchain ? `Verified on-chain by GenLayer${entry.reason ? `: ${entry.reason}` : ''}` : 'Verified (local-dev)')
    : 'Unverified (offline)';
  if (verified && onchain) badge.style.color = 'var(--neon-cyan)';
  else if (verified) badge.style.color = 'var(--neon-purple)';
  else badge.style.color = 'rgba(255,255,255,0.3)';
  td.appendChild(badge);
  return td;
}

export async function renderLeaderboard(limit = 10) {
  const body = $('lb-body');
  const source = $('lb-source');
  if (!body) return;

  setText(source, '');
  clearChildren(body);
  body.appendChild(messageRow('lb-loading', 'LOADING...'));

  const { entries, source: origin, error } = await fetchTop(limit);
  clearChildren(body);

  if (!entries.length) {
    body.appendChild(messageRow('lb-empty', 'No scores yet — play to earn your spot!'));
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

  setText(source, origin === 'online' ? '● live' : `● local${error ? ' (offline)' : ''}`);
}
