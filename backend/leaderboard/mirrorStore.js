// ==================== Leaderboard mirror store ====================
// Verified entries live in Firebase Realtime Database under `leaderboard/{id}`
// (backend-only writes). When Firebase isn't configured, an in-memory array is
// used so local dev works without credentials.
import { isFirebaseConfigured, leaderboardRef, serverTimestamp } from '../services/firebaseAdmin.js';

const mem = [];
let memId = 0;

export async function recordVerified(entry) {
  if (isFirebaseConfigured()) {
    const ref = leaderboardRef().push();
    await ref.set({ ...entry, created_at: serverTimestamp() });
    return { id: ref.key };
  }
  const rec = { id: String(++memId), ...entry, created_at: Date.now() };
  mem.push(rec);
  return { id: rec.id };
}

export async function topVerified(limit) {
  if (isFirebaseConfigured()) {
    const snap = await leaderboardRef().orderByChild('score').limitToLast(limit).get();
    const val = snap.val() || {};
    const arr = Object.entries(val).map(([id, v]) => ({ id, ...v }));
    arr.sort((a, b) => b.score - a.score);
    return arr.slice(0, limit);
  }
  return [...mem].sort((a, b) => b.score - a.score).slice(0, limit);
}

// Test helper.
export function _resetMemory() {
  mem.length = 0;
  memId = 0;
}
