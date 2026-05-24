// ==================== GenLayer client (backend) ====================
// The route layer only ever calls validateScoreOnGenLayer(input) -> boolean and
// never touches low-level GenLayer details. The contract's validate_score()
// returns True only if the score passes the deterministic + LLM consensus gates.
//
// genlayer-js is imported lazily so the backend boots fine in local-dev mode
// (REQUIRE_ONCHAIN_VALIDATION=false) without the SDK doing any network work.
import { config } from '../config.js';
import { logger } from '../logger.js';

export const genlayerEnabled = () => Boolean(config.genlayer.contractAddress);

let clientPromise = null;

async function getClient() {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    const { createClient, createAccount } = await import('genlayer-js');
    const chains = await import('genlayer-js/chains');
    const chainMap = {
      localnet: chains.localnet,
      studionet: chains.studionet,
      testnet: chains.testnetAsimov,
      asimov: chains.testnetAsimov,
      bradbury: chains.testnetBradbury,
    };
    const chain = chainMap[config.genlayer.network] || chains.localnet;
    const account = config.genlayer.privateKey
      ? createAccount(config.genlayer.privateKey)
      : createAccount();
    // 1.1.8+ resolves the consensus contract from the static chain definition,
    // so initializeConsensusSmartContract() is no longer needed.
    return createClient({ chain, account });
  })();
  return clientPromise;
}

// input: { name, score, level, difficulty, duration_ms, dots_eaten, ghosts_eaten }
export async function validateScoreOnGenLayer(input) {
  if (!genlayerEnabled()) {
    throw new Error('GENLAYER_CONTRACT_ADDRESS is not set');
  }
  const { TransactionStatus } = await import('genlayer-js/types');
  const client = await getClient();

  const args = [
    input.name,
    input.score,
    input.level,
    input.difficulty,
    input.duration_ms,
    input.dots_eaten,
    input.ghosts_eaten,
  ];

  logger.info({ score: input.score, level: input.level }, 'calling GenLayer validate_score');
  const hash = await client.writeContract({
    address: config.genlayer.contractAddress,
    functionName: 'validate_score',
    args,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 60,
    interval: 3000,
  });

  // validate_score returns a bool; surface it from whichever receipt field carries it.
  const ret =
    receipt?.data?.returned ??
    receipt?.returnValue ??
    receipt?.result ??
    receipt?.data?.result;
  return Boolean(ret);
}
