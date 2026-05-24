// ==================== Collision system ====================
// Detects player <-> ghost contact and reports events. Pure (no side effects);
// the caller decides what to do with the events.
import { CELL } from '../../config.js';
import { dist2 } from '../../utils/math.js';

const HIT_DIST = CELL * 0.7;
const HIT_DIST_SQ = HIT_DIST * HIT_DIST;

// Returns an array of events: { type: 'eat', ghost } | { type: 'death' }.
export function detectCollisions(player, ghosts) {
  const events = [];
  if (player.dead) return events;
  for (const g of ghosts) {
    if (g.eaten || !g.released) continue;
    if (dist2(player.x, player.y, g.x, g.y) < HIT_DIST_SQ) {
      if (g.frightened) events.push({ type: 'eat', ghost: g });
      else { events.push({ type: 'death' }); break; }
    }
  }
  return events;
}
