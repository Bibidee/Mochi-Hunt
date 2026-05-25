// ==================== Exercise the deployed contract ====================
// Smoke-test: register_username -> validate_score -> reads, against a deployed
// contract. Writes cost gas, so GENLAYER_PRIVATE_KEY must be a FUNDED account.
// Usage:
//   GENLAYER_PRIVATE_KEY=0x... GENLAYER_CONTRACT_ADDRESS=0x... node deployment/interact.mjs
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
const contractAddress = process.env.GENLAYER_CONTRACT_ADDRESS || '0xB9603189BBe8334B69542b4173F79a76e61f0AF7';

const pk = process.env.GENLAYER_PRIVATE_KEY;
if (!pk) {
  console.error('Set GENLAYER_PRIVATE_KEY to a funded account (writes cost gas).');
  process.exit(1);
}
const account = createAccount(pk);

async function write(client, functionName, args) {
  console.log(`-> ${functionName}(${JSON.stringify(args)})`);
  const hash = await client.writeContract({ address: contractAddress, functionName, args });
  await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 100, interval: 3000 });
}

async function main() {
  const client = createClient({ chain, account });

  // txn #1: claim a username for this wallet.
  await write(client, 'register_username', ['TESTER']);

  // txn #2: submit a plausible score (recorded only if it's a new personal best).
  await write(client, 'validate_score', [1230, 2, 'medium', 45000, 120, 3]);

  console.log('username:', await client.readContract({ address: contractAddress, functionName: 'get_username', args: [account.address] }));
  console.log('top:', await client.readContract({ address: contractAddress, functionName: 'get_top', args: [10] }));
  console.log('stats:', await client.readContract({ address: contractAddress, functionName: 'get_stats', args: [] }));
}

main().catch((err) => {
  console.error('Interaction failed:', err);
  process.exit(1);
});
