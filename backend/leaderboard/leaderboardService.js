// ==================== Leaderboard service ====================
// Reads the verified mirror (Firebase or in-memory), cached in Redis/memory for
// a short TTL, and slices for any requested limit. Writes go through
// recordVerified() which mirrors then invalidates the cache.
import { recordVerified as mirrorWrite, topVerified } from './mirrorStore.js';
import { cacheGet, cacheSet, cacheDel } from '../services/cache.js';
import { config } from '../config.js';

const MAX_LIMIT = 50;
const CACHE_KEY = 'lb:top';

export async function getLeaderboard(limit = 10) {
  const want = Math.min(Math.max(limit, 1), MAX_LIMIT);

  let all = await cacheGet(CACHE_KEY);
  let cached = true;
  if (!all) {
    const rows = await topVerified(MAX_LIMIT);
    all = rows.map((r) => ({
      name: r.name,
      score: r.score,
      level: r.level,
      difficulty: r.difficulty,
      verified: !!r.verified,
      verification_source: r.verification_source || null,
      reason: r.reason || null,
    }));
    await cacheSet(CACHE_KEY, all, config.leaderboardCacheTtl);
    cached = false;
  }

  return { entries: all.slice(0, want), cached };
}

export async function recordVerified(entry) {
  await mirrorWrite(entry);
  await cacheDel(CACHE_KEY);
}
