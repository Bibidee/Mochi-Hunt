// ==================== Exercise the deployed contract ====================
// Smoke-test validate_score + reads against a deployed contract.
// Usage (run yourself after deploying):
//   GENLAYER_CONTRACT_ADDRESS=0x... node deployment/interact.mjs
//   GENLAYER_NETWORK=testnet GENLAYER_PRIVATE_KEY=0x... GENLAYER_CONTRACT_ADDRESS=0x... node deployment/interact.mjs
import { createClient, createAccount } from 'genlayer-js';
import * as chains from 'genlayer-js/chains';
import { TransactionStatus } from 'genlayer-js/types';

const network = process.env.GENLAYER_NETWORK || 'studionet';
const chainMap = {
  localnet: chains.localnet,
  studionet: chains.studionet,
  testnet: chains.testnetAsimov,
  asimov: chains.testnetAsimov,
  bradbury: chains.testnetBradbury,
};
const chain = chainMap[network] || chains.studionet;
const contractAddress = process.env.GENLAYER_CONTRACT_ADDRESS || '0xE5f8D7DEc9fb414d1A1E3feb2e01c0032B664a09';

if (!contractAddress) {
  console.error('Set GENLAYER_CONTRACT_ADDRESS first.');
  process.exit(1);
}

const pk = process.env.GENLAYER_PRIVATE_KEY;
const account = pk ? createAccount(pk) : createAccount();

async function main() {
  const client = createClient({ chain, account });

  // A plausible score (should be accepted + recorded).
  const args = ['TESTER', 1230, 2, 'medium', 45000, 120, 3];
  console.log('Calling validate_score with', args);
  const hash = await client.writeContract({
    address: contractAddress,
    functionName: 'validate_score',
    args,
  });
  await client.waitForTransactionReceipt({
    hash, status: TransactionStatus.ACCEPTED, retries: 60, interval: 3000,
  });

  const top = await client.readContract({
    address: contractAddress,
    functionName: 'get_top',
    args: [10],
  });
  const stats = await client.readContract({
    address: contractAddress,
    functionName: 'get_stats',
    args: [],
  });

  console.log('Top entries:', top);
  console.log('Stats:', stats);
}

main().catch((err) => {
  console.error('Interaction failed:', err);
  process.exit(1);
});
