import { loadEnv, chain, deployerAccount, readerClient, networkName, gen } from "./_shared.mjs";

loadEnv();

const account = deployerAccount();
const client = readerClient();
const c = chain();

let balance = 0n;
try {
  balance = await client.getBalance({ address: account.address });
} catch (err) {
  console.log(`  balance lookup failed: ${err.message}`);
}

console.log("");
console.log("  APERTURE deployer");
console.log("  ------------------------------------------------");
console.log(`  network   ${networkName()}  (chain ${c.id})`);
console.log(`  rpc       ${c.rpcUrls.default.http[0]}`);
console.log(`  address   ${account.address}`);
console.log(`  balance   ${gen(balance)} GEN`);
console.log(`  explorer  ${c.blockExplorers?.default?.url || "n/a"}address/${account.address}`);
console.log("");
if (balance === 0n) {
  console.log("  Balance is zero. Claim testnet GEN at:");
  console.log("  https://testnet-faucet.genlayer.foundation/");
  console.log("");
}
