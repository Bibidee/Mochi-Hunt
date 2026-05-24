import { Router } from 'express';
import health from './health.js';
import leaderboard from './leaderboard.js';

const router = Router();

router.use('/health', health);
router.use('/leaderboard', leaderboard);

export default router;
