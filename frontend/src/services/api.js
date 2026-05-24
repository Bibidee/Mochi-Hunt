// ==================== Backend API client ====================
// Thin fetch wrapper around the Mochi Hunt REST API. Base URL comes from Vite
// env (VITE_API_BASE_URL). All methods throw on non-2xx so callers can fall back.

// Empty base = same-origin (works behind the nginx `/api` proxy in prod and the
// Vite dev proxy locally). Set VITE_API_BASE_URL only to target a remote API.
const BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

// Always attempt the backend; callers fall back to localStorage on failure.
export const apiConfigured = true;

async function request(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) detail = data.error;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  // payload: { name, score, level, difficulty, duration_ms, dots_eaten, ghosts_eaten }
  submitScore(payload) {
    return request('/api/leaderboard/submit', { method: 'POST', body: payload });
  },
  getLeaderboard(limit = 10) {
    return request(`/api/leaderboard?limit=${encodeURIComponent(limit)}`);
  },
  health() {
    return request('/api/health');
  },
};
