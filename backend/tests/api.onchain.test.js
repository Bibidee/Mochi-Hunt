import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

// On-chain mode REQUIRED but no contract address configured -> must reject safely.
let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.REQUIRE_ONCHAIN_VALIDATION = 'true';
  delete process.env.GENLAYER_CONTRACT_ADDRESS;
  vi.resetModules(); // force config + app to re-read the env above
  const mod = await import('../app.js');
  app = mod.createApp();
});

describe('API (on-chain required, misconfigured)', () => {
  it('rejects submit with a clear 503 instead of silently accepting', async () => {
    const res = await request(app).post('/api/leaderboard/submit').send({
      name: 'P', score: 120, level: 1, difficulty: 'easy',
      duration_ms: 8000, dots_eaten: 12, ghosts_eaten: 0,
    });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/GENLAYER_CONTRACT_ADDRESS/);
  });
});
