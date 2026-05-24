// ==================== Leaderboard client ====================
// Submits gameplay telemetry to the backend, which validates it (deterministic +
// GenLayer when enabled) and mirrors verified entries. The frontend NEVER writes
// the authoritative leaderboard directly. localStorage is only an offline
// fallback when the backend is unreachable.
import { api, apiConfigured } from '../../services/api.js';
import { readJSON, writeJSON } from '../../services/storage.js';

const LB_KEY = 'mochi_hunt_lb';

function localSave(entry) {
  const lb = readJSON(LB_KEY, []);
  lb.push({
    name: entry.name,
    score: entry.score,
    level: entry.level,
    difficulty: entry.difficulty,
    verified: false,
    verification_source: 'local',
    date: new Date().toISOString(),
  });
  lb.sort((a, b) => b.score - a.score);
  lb.splice(50);
  writeJSON(LB_KEY, lb);
}

function localTop(limit) {
  return readJSON(LB_KEY, []).slice(0, limit);
}

// payload: { name, score, level, difficulty, duration_ms, dots_eaten, ghosts_eaten }
export async function submitScore(payload) {
  if (apiConfigured) {
    try {
      const result = await api.submitScore(payload); // { accepted, source, reason }
      return { ok: result.accepted, source: 'online', result };
    } catch (err) {
      localSave(payload);
      return { ok: true, source: 'local', error: err.message };
    }
  }
  localSave(payload);
  return { ok: true, source: 'local' };
}

export async function fetchTop(limit = 10) {
  if (apiConfigured) {
    try {
      const data = await api.getLeaderboard(limit);
      const entries = Array.isArray(data) ? data : data.entries || [];
      return { entries, source: 'online' };
    } catch (err) {
      return { entries: localTop(limit), source: 'local', error: err.message };
    }
  }
  return { entries: localTop(limit), source: 'local' };
}
