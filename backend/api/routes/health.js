import { Router } from 'express';
import { isCacheConnected } from '../../services/cache.js';
import { isFirebaseConfigured } from '../../services/firebaseAdmin.js';
import { genlayerEnabled } from '../../blockchain/genlayerClient.js';
import { config } from '../../config.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    mirror: isFirebaseConfigured() ? 'firebase' : 'memory',
    cache: isCacheConnected() ? 'redis' : 'memory',
    onchain: config.genlayer.requireOnchain
      ? (genlayerEnabled() ? 'enabled' : 'misconfigured')
      : 'disabled',
    uptime: Math.round(process.uptime()),
  });
});

export default router;
