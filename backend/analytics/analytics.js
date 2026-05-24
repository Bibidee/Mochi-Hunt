// ==================== Analytics ====================
// Lightweight structured event recording. Currently emits via the logger so
// events are queryable in log aggregation; can be pointed at a queue/warehouse
// later without changing call sites.
import { logger } from '../logger.js';

export function recordEvent(type, data = {}) {
  logger.info({ evt: type, ...data }, `analytics:${type}`);
}
