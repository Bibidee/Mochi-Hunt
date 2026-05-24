// ==================== Cache (Redis + in-memory fallback) ====================
// Connects to Redis if REDIS_URL is set and reachable; otherwise an in-memory
// Map with TTL is used so local dev works without Redis.
import Redis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../logger.js';

let redis = null;
let connected = false;
const mem = new Map(); // key -> { value, expiresAt }

export async function initCache() {
  if (!config.redisUrl) {
    logger.warn('REDIS_URL not set — falling back to in-memory cache');
    return false;
  }
  redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    retryStrategy: () => null,
  });
  redis.on('error', (err) => logger.debug({ err: err.message }, 'redis error'));
  try {
    await redis.connect();
    await redis.ping();
    connected = true;
    logger.info('Redis connected');
    return true;
  } catch (err) {
    logger.warn({ err: err.message }, 'Redis unavailable — falling back to in-memory cache');
    connected = false;
    try { redis.disconnect(); } catch { /* noop */ }
    redis = null;
    return false;
  }
}

export const isCacheConnected = () => connected;

export async function cacheGet(key) {
  if (connected) {
    const v = await redis.get(key);
    return v ? JSON.parse(v) : null;
  }
  const e = mem.get(key);
  if (!e) return null;
  if (e.expiresAt && e.expiresAt < Date.now()) { mem.delete(key); return null; }
  return e.value;
}

export async function cacheSet(key, value, ttlSec) {
  if (connected) {
    if (ttlSec) await redis.set(key, JSON.stringify(value), 'EX', ttlSec);
    else await redis.set(key, JSON.stringify(value));
    return;
  }
  mem.set(key, { value, expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : 0 });
}

export async function cacheDel(key) {
  if (connected) { await redis.del(key); return; }
  mem.delete(key);
}

export async function closeCache() {
  if (redis) { redis.disconnect(); redis = null; connected = false; }
}
