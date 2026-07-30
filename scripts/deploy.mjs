import {
  loadEnv,
  chain,
  networkName,
  signerClient,
  contractSource,
  settle,
  saveDeployment,
  gen,
} from "./_shared.mjs";

loadEnv();

const { client, account } = signerClient();
const c = chain();

console.log("");
console.log("  Deploying APERTURE PROTOCOL");
console.log("  ------------------------------------------------");
console.log(`  network   ${networkName()} (chain ${c.id})`);
console.log(`  deployer  ${account.address}`);

const balance = await client.getBalance({ address: account.address }).catch(() => 0n);
console.log(`  balance   ${gen(balance)} GEN`);
if (balance === 0n) {
  console.log("");
  console.log("  No GEN. Claim from https://testnet-faucet.genlayer.foundation/ and retry.");
  process.exit(1);
}

const code = contractSource();
console.log(`  contract  contracts/aperture.py (${code.length} bytes)`);
console.log("");

const hash = await client.deployContract({
  code,
  args: ["Aperture Protocol"],
});

const receipt = await settle(client, hash, "deploy");

const address =
  receipt?.data?.contract_address ||
  receipt?.contract_address ||
  receipt?.to_address ||
  receipt?.recipient;

if (!address) {
  console.log("");
  console.log("  Deployment settled but no contract address in the receipt. Raw receipt:");
  console.log(JSON.stringify(receipt, null, 2).slice(0, 3000));
  process.exit(1);
}

// ACCEPTED is a consensus milestone, not an indexing one. For a minute or so
// after it the RPC still answers "contract not found at address", which makes
// an immediately chained `npm run seed` fail on a contract that is perfectly
// healthy. Poll a cheap view until the code is actually readable.
process.stdout.write("  waiting for the contract to be readable ");
let live = false;
for (let i = 0; i < 60 && !live; i += 1) {
  try {
    await client.readContract({ address, functionName: "get_meta", args: [] });
    live = true;
  } catch {
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 5000));
  }
}
console.log(live ? " ok" : " timed out (the address is saved, retry the seed later)");

saveDeployment({
  network: networkName(),
  chainId: c.id,
  address,
  deployer: account.address,
  txHash: hash,
  deployedAt: new Date().toISOString(),
});

console.log("");
console.log("  ------------------------------------------------");
console.log(`  contract  ${address}`);
console.log(`  explorer  ${c.blockExplorers?.default?.url || ""}address/${address}`);
console.log("");
console.log("  Written to .env.local as NEXT_PUBLIC_CONTRACT_ADDRESS.");
console.log("  Next: npm run seed");
console.log("");
