// ==================== GenLayer client (frontend) ====================
// The browser never talks to the chain directly — the backend submits scores to
// the GenLayer Intelligent Contract and returns the verification result. This
// module turns that result into a user-facing message for the win overlay.

export const BLOCKCHAIN_ENABLED = import.meta.env?.VITE_ENABLE_BLOCKCHAIN !== 'false';

// submitResult: { ok, source: 'online'|'local', result?: { accepted, source, reason }, error? }
export function verificationMessage(submitResult) {
  if (!BLOCKCHAIN_ENABLED) return null;

  if (submitResult?.source === 'online') {
    const r = submitResult.result || {};
    if (!r.accepted) {
      return `⚠️ Score not verified${r.reason ? `: ${r.reason}` : ''}`;
    }
    if (r.source === 'genlayer') {
      return '🏆 Verified on-chain by GenLayer — testnet points earned!';
    }
    return '🏆 Score accepted (local-dev). Deploy GenLayer for on-chain verification.';
  }

  return '🏆 Saved locally — start the backend for verified scoring.';
}
