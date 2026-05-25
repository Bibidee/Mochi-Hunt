// ==================== Wallet + on-chain contract client ====================
// Fully client-side: the PLAYER's wallet (MetaMask / any EIP-1193 provider) signs
// every write. Reads use a throwaway read client (no signing, no gas).
//
// Two write txns: register_username(name) and validate_score(...). Reads:
// get_top(n), get_username(addr), get_stats().
//
// Network: GenLayer studionet (chainId 61999). Contract address comes from
// VITE_GENLAYER_CONTRACT_ADDRESS (set it after deploying mochi_hunt.py v0.3.0).
import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionStatus } from 'genlayer-js/types';

const CONTRACT = (import.meta.env?.VITE_GENLAYER_CONTRACT_ADDRESS || '').trim();

let writeClient = null;
let readClient = null;
let account = null;
let onChange = null;

// Register a callback fired when the wallet account changes/disconnects.
export function setWalletChangeHandler(fn) { onChange = fn; }

// Forget the wallet locally (MetaMask has no programmatic disconnect; this
// clears our session so the UI resets and reconnecting re-prompts).
export function disconnect() {
  account = null;
  writeClient = null;
}

function requireContract() {
  if (!CONTRACT) {
    throw new Error('Contract address not set (VITE_GENLAYER_CONTRACT_ADDRESS)');
  }
  return CONTRACT;
}

function getReadClient() {
  if (!readClient) {
    // A generated account is only used to shape read calldata; it never signs.
    readClient = createClient({ chain: studionet, account: createAccount() });
  }
  return readClient;
}

export const contractConfigured = Boolean(CONTRACT);
export const isWalletAvailable = () => typeof window !== 'undefined' && !!window.ethereum;
export const getAddress = () => account;
export const isConnected = () => Boolean(writeClient && account);

export function shortAddress(addr = account) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export async function connectWallet() {
  if (!isWalletAvailable()) {
    throw new Error('No wallet found — install MetaMask to play on-chain.');
  }
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts || !accounts.length) throw new Error('Wallet connection was rejected.');
  account = accounts[0];
  writeClient = createClient({ chain: studionet, account, provider: window.ethereum });
  // Ask the wallet to add/switch to studionet if the SDK supports it.
  try {
    if (typeof writeClient.connect === 'function') await writeClient.connect('studionet');
  } catch (err) {
    console.warn('[wallet] network switch:', err?.message || err);
  }
  // Reflect account changes from the wallet UI.
  window.ethereum.on?.('accountsChanged', (accs) => {
    account = accs && accs.length ? accs[0] : null;
    writeClient = account ? createClient({ chain: studionet, account, provider: window.ethereum }) : null;
    if (onChange) onChange(account);
  });
  return account;
}

async function sendWrite(functionName, args) {
  if (!isConnected()) throw new Error('Connect your wallet first.');
  const address = requireContract();
  const hash = await writeClient.writeContract({ address, functionName, args });
  const receipt = await writeClient.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 100,
    interval: 3000,
  });
  return { hash, receipt };
}

export async function registerUsername(name) {
  const { hash } = await sendWrite('register_username', [name]);
  return hash;
}

// payload: { score, level, difficulty, duration_ms, dots_eaten, ghosts_eaten }
export async function submitScore(p) {
  const { hash, receipt } = await sendWrite('validate_score', [
    p.score, p.level, p.difficulty, p.duration_ms, p.dots_eaten, p.ghosts_eaten,
  ]);
  const ret =
    receipt?.data?.returned ?? receipt?.returnValue ?? receipt?.result ?? receipt?.data?.result;
  return { hash, accepted: Boolean(ret) };
}

export async function fetchTop(limit = 10) {
  const raw = await getReadClient().readContract({
    address: requireContract(),
    functionName: 'get_top',
    args: [limit],
  });
  const entries = typeof raw === 'string' ? JSON.parse(raw) : raw || [];
  return Array.isArray(entries) ? entries : [];
}

export async function getRegisteredName(addr = account) {
  if (!addr) return '';
  const raw = await getReadClient().readContract({
    address: requireContract(),
    functionName: 'get_username',
    args: [addr],
  });
  return typeof raw === 'string' ? raw : '';
}
