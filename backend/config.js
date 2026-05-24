// ==================== Backend configuration ====================
// Loads the repo-root .env and exposes a typed config object with sane defaults.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Don't load the real .env during tests — keeps tests deterministic and avoids
// pulling in developer secrets / real service URLs.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const num = (v, d) => (v == null || v === '' ? d : Number(v));
const bool = (v, d) => (v == null ? d : v === 'true' || v === '1');

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',

  host: process.env.API_HOST || '0.0.0.0',
  port: num(process.env.API_PORT, 4000),

  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
    .split(',').map((s) => s.trim()).filter(Boolean),

  redisUrl: process.env.REDIS_URL || '',
  leaderboardCacheTtl: num(process.env.LEADERBOARD_CACHE_TTL_SECONDS, 30),

  rateLimit: {
    windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: num(process.env.RATE_LIMIT_MAX, 60),
    scoreSubmitPerMin: num(process.env.SCORE_SUBMIT_MAX_PER_MIN, 10),
  },

  // GenLayer is the integrity source. When requireOnchain is true the backend
  // MUST call the contract and a contract address MUST be set.
  genlayer: {
    network: process.env.GENLAYER_NETWORK || 'localnet', // localnet | testnet
    rpcUrl: process.env.GENLAYER_RPC_URL || '',
    contractAddress: process.env.GENLAYER_CONTRACT_ADDRESS || '',
    privateKey: process.env.GENLAYER_PRIVATE_KEY || '',
    requireOnchain: bool(process.env.REQUIRE_ONCHAIN_VALIDATION, false),
  },

  // Firebase is the fast read mirror. Written ONLY by the backend (Admin SDK).
  // If unset, the backend uses an in-memory mirror so local dev works.
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || '',
  },

  log: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
    pretty: bool(process.env.LOG_PRETTY, true),
  },
};
