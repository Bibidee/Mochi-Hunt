import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { _resetMemory } from '../leaderboard/mirrorStore.js';

let app;

beforeAll(() => {
  _resetMemory();
  app = createApp();
});

describe('API (local-dev mode)', () => {
  it('GET /api/health reports disabled on-chain', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.onchain).toBe('disabled');
  });

  it('accepts a plausible score', async () => {
    const res = await request(app).post('/api/leaderboard/submit').send({
      name: 'MOCHIKING', score: 1230, level: 2, difficulty: 'hard',
      duration_ms: 45000, dots_eaten: 100, ghosts_eaten: 3,
    });
    expect(res.status).toBe(201);
    expect(res.body.accepted).toBe(true);
    expect(res.body.source).toBe('local-dev');
  });

  it('rejects an implausible score with reasons', async () => {
    const res = await request(app).post('/api/leaderboard/submit').send({
      name: 'CHEAT', score: 9_999_990, level: 1, difficulty: 'easy',
      duration_ms: 1000, dots_eaten: 2, ghosts_eaten: 0,
    });
    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe(false);
    expect(res.body.reason).toMatch(/score_exceeds_ceiling|telemetry_mismatch/);
  });

  it('sanitizes an XSS-style name before storing', async () => {
    const res = await request(app).post('/api/leaderboard/submit').send({
      name: '<b>HAX</b>', score: 120, level: 1, difficulty: 'easy',
      duration_ms: 8000, dots_eaten: 12, ghosts_eaten: 0,
    });
    expect(res.body.accepted).toBe(true);
  });

  it('GET /api/leaderboard returns only verified entries (no cheat)', async () => {
    const res = await request(app).get('/api/leaderboard?limit=10');
    expect(res.status).toBe(200);
    const names = res.body.entries.map((e) => e.name);
    expect(names).toContain('MOCHIKING');
    expect(names).toContain('bHAX/b'); // sanitized
    expect(names).not.toContain('CHEAT');
    expect(res.body.entries[0].verification_source).toBe('local-dev');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
  });
});
