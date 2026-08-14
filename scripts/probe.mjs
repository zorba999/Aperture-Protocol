/**
 * Deploy contracts/probe.py and call each method once.
 *
 * Answers, per primitive: does it exist, does it fit in the budget, and what
 * does it hand back. Everything else about the audit was guesswork until this
 * ran.
 *
 *   node scripts/probe.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv, signerClient, settle, ROOT, short } from "./_shared.mjs";

loadEnv();

const { client, account } = signerClient();

const FRAME = "https://aperture-protocol.vercel.app/frames/katla-caldera.jpg";
const PAGE = "https://aperture-protocol.vercel.app/fixtures/holder-campaign.html";
const OTHER = "https://aperture-protocol.vercel.app/frames/shuto-0400.jpg";

console.log("");
console.log("  Bradbury primitive probe");
console.log("  ------------------------------------------------");

const code = fs.readFileSync(path.join(ROOT, "contracts", "probe.py"), "utf8");
const deployHash = await client.deployContract({ code, args: [] });
const receipt = await settle(client, deployHash, "deploy probe");
const address =
  receipt?.data?.contract_address ||
  receipt?.contract_address ||
  receipt?.to_address ||
  receipt?.recipient;
if (!address) {
  console.log("  no contract address in the receipt, keys were:");
  console.log(`  ${Object.keys(receipt || {}).join(", ")}`);
  console.log(`  data keys: ${Object.keys(receipt?.data || {}).join(", ")}`);
  process.exit(1);
}
console.log(`  probe at ${address}`);

for (let i = 0; i < 40; i += 1) {
  try {
    await client.readContract({ address, functionName: "get_last", args: [] });
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 5000));
  }
}
console.log("");

const cases = [
  ["probe_html", [PAGE], "fetch the page over plain HTTP and scrape its image"],
  ["probe_vision_bytes", [FRAME, FRAME], "two images over HTTP, one vision call, same scene"],
  ["probe_vision_bytes", [FRAME, OTHER], "two images over HTTP, one vision call, different scene"],
];

for (const [fn, args, blurb] of cases) {
  process.stdout.write(`  ${fn.padEnd(18)} ${blurb}\n`);
  const started = Date.now();
  try {
    const hash = await client.writeContract({ address, functionName: fn, args, value: 0n });
    await settle(client, hash, fn);
    const value = await client.readContract({ address, functionName: "get_last", args: [] });
    console.log(`      OK  ${Math.round((Date.now() - started) / 1000)}s  ${String(value).slice(0, 220)}`);
  } catch (err) {
    console.log(`      FAILED  ${Math.round((Date.now() - started) / 1000)}s`);
    console.log(`      ${String(err.message).split("\n")[0].slice(0, 200)}`);
  }
  console.log("");
}

console.log("  ------------------------------------------------");
console.log(`  probe contract ${address}`);
console.log(`  deployer ${short(account.address)}`);
console.log("");
