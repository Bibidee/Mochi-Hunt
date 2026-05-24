// ==================== Leaderboard submit pipeline ====================
// validate -> sanitize -> deterministic gate -> (GenLayer when required) ->
// mirror verified entry -> respond. GenLayer is the integrity source; the
// mirror is only a fast read store.
import { submitSchema, sanitizeName, plausibility } from './validation.js';
import { validateScoreOnGenLayer, genlayerEnabled } from '../blockchain/genlayerClient.js';
import { recordVerified } from '../leaderboard/leaderboardService.js';
import { recordEvent } from '../analytics/analytics.js';
import { config } from '../config.js';

export async function submitLeaderboard(body) {
  const data = submitSchema.parse(body); // ZodError -> 400 in errorHandler
  data.name = sanitizeName(data.name);

  // Deterministic gate (mirrors the contract; runs in both modes).
  const plaus = plausibility(data);
  if (!plaus.ok) {
    recordEvent('score_rejected', { reasons: plaus.reasons, score: data.score });
    return {
      accepted: false,
      source: config.genlayer.requireOnchain ? 'genlayer' : 'local-dev',
      reason: plaus.reasons.join(', '),
    };
  }

  let accepted;
  let source;
  let reason;

  if (config.genlayer.requireOnchain) {
    if (!genlayerEnabled()) {
      const err = new Error('On-chain validation required but GENLAYER_CONTRACT_ADDRESS is missing');
      err.status = 503;
      err.expose = true;
      throw err;
    }
    accepted = await validateScoreOnGenLayer({
      name: data.name,
      score: data.score,
      level: data.level,
      difficulty: data.difficulty,
      duration_ms: data.duration_ms,
      dots_eaten: data.dots_eaten,
      ghosts_eaten: data.ghosts_eaten,
    });
    source = 'genlayer';
    reason = accepted ? 'verified on-chain by GenLayer' : 'rejected on-chain by GenLayer';
  } else {
    accepted = true;
    source = 'local-dev';
    reason = 'deterministic validation only (on-chain disabled)';
  }

  if (accepted) {
    await recordVerified({
      name: data.name,
      score: data.score,
      level: data.level,
      difficulty: data.difficulty,
      duration_ms: data.duration_ms,
      dots_eaten: data.dots_eaten,
      ghosts_eaten: data.ghosts_eaten,
      verified: true,
      verification_source: source,
      reason,
    });
    recordEvent('score_accepted', { score: data.score, source });
  }

  return { accepted, source, reason };
}
