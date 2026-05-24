import { Router } from 'express';
import { z } from 'zod';
import { getLeaderboard } from '../../leaderboard/leaderboardService.js';
import { submitLeaderboard } from '../../services/leaderboardSubmitService.js';
import { scoreLimiter } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';

const router = Router();

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// Read leaderboard (frontend reads through the backend; never Firebase directly).
router.get('/', asyncHandler(async (req, res) => {
  const { limit } = querySchema.parse(req.query);
  const data = await getLeaderboard(limit);
  res.json(data);
}));

// Submit a score: validate -> GenLayer (if required) -> mirror.
router.post('/submit', scoreLimiter, asyncHandler(async (req, res) => {
  const result = await submitLeaderboard(req.body || {});
  res.status(result.accepted ? 201 : 200).json(result);
}));

export default router;
