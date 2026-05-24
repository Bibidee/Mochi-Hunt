// ==================== Deploy the Mochi Hunt Intelligent Contract ====================
// Usage (run yourself when ready — this is NOT executed during the build):
//   cd contracts && npm install
//   # localnet (GenLayer Studio running locally):
//   node deployment/deploy.mjs
//   # Asimov testnet (needs your funded account key):
//   GENLAYER_NETWORK=testnet GENLAYER_PRIVATE_KEY=0x... node deployment/deploy.mjs
//
// After it prints the contract address, put it in the repo-root .env as
// GENLAYER_CONTRACT_ADDRESS=... so the backend can call the contract.
import { createClient, createAccount } from 'genlayer-js';
import * as chains from 'genlayer-js/chains';
import { TransactionStatus } from 'genlayer-js/types';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = path.resolve(__dirname, '../intelligent-contract/mochi_hunt.py');

const network = process.env.GENLAYER_NETWORK || 'studionet';
const chainMap = {
  localnet: chains.localnet,
  studionet: chains.studionet,
  testnet: chains.testnetAsimov,
  asimov: chains.testnetAsimov,
  bradbury: chains.testnetBradbury,
};
const chain = chainMap[network] || chains.studionet;

const pk = process.env.GENLAYER_PRIVATE_KEY;
const account = pk ? createAccount(pk) : createAccount();

async function main() {
  const client = createClient({ chain, account });

  const code = readFileSync(CONTRACT_PATH, 'utf-8');
  console.log(`Deploying mochi_hunt.py to ${network} as ${account.address} ...`);

  const hash = await client.deployContract({ code, args: [], leaderOnly: false });
  console.log('Deploy tx hash:', hash);

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 60,
    interval: 3000,
  });

  const address =
    receipt?.data?.contract_address ||
    receipt?.contractAddress ||
    receipt?.address ||
    null;

  console.log('\n--- Deployment complete ---');
  console.log('Contract address:', address ?? '(see receipt below)');
  if (!address) console.dir(receipt, { depth: 5 });
  console.log('\nNext: set GENLAYER_CONTRACT_ADDRESS in your .env to the address above.');
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
