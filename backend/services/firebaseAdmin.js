// ==================== Firebase Admin ====================
// The leaderboard mirror is written ONLY here, on the backend, via the Admin
// SDK — the frontend never writes it. If credentials are absent, we fall back
// to an in-memory mirror so local dev (REQUIRE_ONCHAIN_VALIDATION=false) works.
import admin from 'firebase-admin';
import { config } from '../config.js';
import { logger } from '../logger.js';

let configured = false;

export function initFirebase() {
  const { projectId, clientEmail, privateKey, databaseURL } = config.firebase;
  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    logger.warn('Firebase not configured — using in-memory leaderboard mirror');
    return false;
  }
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        // env stores the key with literal \n; restore real newlines.
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      databaseURL,
    });
    configured = true;
    logger.info('Firebase Admin initialized');
    return true;
  } catch (err) {
    logger.warn({ err: err.message }, 'Firebase init failed — using in-memory leaderboard mirror');
    configured = false;
    return false;
  }
}

export const isFirebaseConfigured = () => configured;

export function leaderboardRef() {
  return admin.database().ref('leaderboard');
}

export const serverTimestamp = () => admin.database.ServerValue.TIMESTAMP;
