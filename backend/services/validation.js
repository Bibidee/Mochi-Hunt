// ==================== Submission validation ====================
// Shared schema + deterministic anti-cheat. The plausibility checks intentionally
// MIRROR the contract's `_deterministic_ok` so local-dev mode behaves like the
// on-chain deterministic gate.
import { z } from 'zod';

export const submitSchema = z.object({
  name: z.string().trim().min(1).max(18),
  score: z.number().int().min(0).max(10_000_000),
  level: z.number().int().min(1).max(10),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  duration_ms: z.number().int().min(0).max(86_400_000),
  dots_eaten: z.number().int().min(0).max(100_000),
  ghosts_eaten: z.number().int().min(0).max(100_000),
});

export function sanitizeName(name) {
  const cleaned = name.replace(/[\x00-\x1F\x7F<>]/g, '').slice(0, 18);
  return cleaned || 'MOCHI';
}

// Mirrors contracts/intelligent-contract/mochi_hunt.py::_deterministic_ok
export function plausibility({ score, level, duration_ms, dots_eaten, ghosts_eaten }) {
  const reasons = [];
  if (score < 0) reasons.push('negative_score');
  if (level < 1 || level > 10) reasons.push('bad_level');
  if (score % 10 !== 0) reasons.push('score_not_multiple_of_10');
  if (duration_ms < 0) reasons.push('negative_duration');
  if (dots_eaten < 0 || ghosts_eaten < 0) reasons.push('negative_telemetry');
  if (dots_eaten > 149 * level + 50) reasons.push('too_many_dots');
  if (ghosts_eaten > 16 * level + 8) reasons.push('too_many_ghosts');

  const perLevelMax = 1490 + 200 + 12000;
  const ceiling = perLevelMax * level + 2000;
  if (score > ceiling) reasons.push('score_exceeds_ceiling');

  if (score > 500) {
    const minMs = Math.min(Math.floor(score / 10) * 30, 8000);
    if (duration_ms < minMs) reasons.push('too_fast_for_score');
  }

  const accounted = dots_eaten * 10 + ghosts_eaten * 200 + 4 * 50 * level;
  const slack = 5000 + level * 1000;
  if (dots_eaten > 0 && score > accounted + slack) reasons.push('telemetry_mismatch');

  return { ok: reasons.length === 0, reasons };
}
