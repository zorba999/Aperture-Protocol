import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, createAccount } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ENV_FILES = [".env.local", ".env"];

export function loadEnv() {
  for (const name of ENV_FILES) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (process.env[key] === undefined || process.env[key] === "") process.env[key] = value;
    }
  }
}

export function networkName() {
  return process.env.NEXT_PUBLIC_GENLAYER_NETWORK || "testnetBradbury";
}

export function chain() {
  const name = networkName();
  const found = chains[name];
  if (!found) throw new Error(`unknown genlayer network: ${name}`);
  return found;
}

export function deployerAccount() {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error("DEPLOYER_PRIVATE_KEY missing, add it to .env.local");
  return createAccount(key.startsWith("0x") ? key : `0x${key}`);
}

export function signerClient() {
  const account = deployerAccount();
  const client = createClient({ chain: chain(), account });
  return { client, account };
}

export function readerClient() {
  return createClient({ chain: chain() });
}

export function short(value) {
  const s = String(value);
  return s.length > 14 ? `${s.slice(0, 8)}..${s.slice(-6)}` : s;
}

export function gen(atto) {
  return (Number(BigInt(atto)) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export async function settle(client, hash, label) {
  process.stdout.write(`  waiting for ${label} ${short(hash)} `);
  const spin = setInterval(() => process.stdout.write("."), 4000);
  try {
    const receipt = await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      interval: 4000,
      retries: 200,
    });
    clearInterval(spin);
    const result = receipt.txExecutionResultName || receipt.execution_result || "unknown";
    if (String(result).includes("ERROR")) {
      console.log(` failed (${result})`);
      const trace = await client.debugTraceTransaction({ hash }).catch((e) => ({ error: e.message }));
      console.log(`  trace: ${JSON.stringify(trace).slice(0, 2500)}`);
      const leader = receipt?.consensus_data?.leader_receipt || receipt?.consensusData?.leaderReceipt;
      if (leader) console.log(`  leader: ${JSON.stringify(leader).slice(0, 2500)}`);
      throw new Error(`${label} reverted`);
    }
    console.log(` ok`);
    return receipt;
  } catch (err) {
    clearInterval(spin);
    throw err;
  }
}

/**
 * Time allocation for calls that do real work inside a non-deterministic block.
 *
 * The default preset assumes something cheap. An audit loads an image, drives a
 * headless browser over the reported page and then runs a vision prompt, and
 * every validator repeats all of it. On the default budget that returned
 * VALIDATORS_TIMEOUT rather than a verdict, which looks like a broken contract
 * and is really just a transaction that was not given enough room.
 */
export const HEAVY_METHODS = new Set(["file_claim", "contest_claim", "request_quote"]);

export async function heavyFees(client) {
  try {
    const estimate = await client.estimateTransactionFees({
      leaderTimeunitsAllocation: 2000n,
      validatorTimeunitsAllocation: 4000n,
      rotations: [0n],
    });
    return { distribution: estimate.distribution, feeValue: estimate.feeValue };
  } catch (err) {
    console.log(`  fee estimate unavailable, using defaults (${String(err.message).slice(0, 80)})`);
    return null;
  }
}

/**
 * The consensus contract occasionally reverts the outer EVM transaction when
 * several writes are submitted back to back (tight gas estimate plus a moving
 * nonce). Retrying with a short backoff clears it.
 */
export async function sendWrite(client, params, label, attempts = 3) {
  if (HEAVY_METHODS.has(params.functionName) && !params.fees) {
    const fees = await heavyFees(client);
    if (fees) params = { ...params, fees };
  }
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const hash = await client.writeContract(params);
      return await settle(client, hash, label);
    } catch (err) {
      lastError = err;
      const retryable = /reverted|nonce|429|-32/i.test(String(err.message));
      if (!retryable || i === attempts - 1) throw err;
      const wait = 6000 * (i + 1);
      console.log(`  retrying ${label} in ${wait / 1000}s (${err.message.split("\n")[0].slice(0, 90)})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastError;
}

export function saveDeployment(record) {
  const dir = path.join(ROOT, "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${record.network}.json`), JSON.stringify(record, null, 2));

  const envFile = path.join(ROOT, ".env.local");
  let body = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  if (/^NEXT_PUBLIC_CONTRACT_ADDRESS=.*$/m.test(body)) {
    body = body.replace(/^NEXT_PUBLIC_CONTRACT_ADDRESS=.*$/m, `NEXT_PUBLIC_CONTRACT_ADDRESS=${record.address}`);
  } else {
    body += `\nNEXT_PUBLIC_CONTRACT_ADDRESS=${record.address}\n`;
  }
  fs.writeFileSync(envFile, body);
}

export function contractSource() {
  return fs.readFileSync(path.join(ROOT, "contracts", "aperture.py"), "utf8");
}

export function contractAddress() {
  const fromEnv = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (fromEnv) return fromEnv;
  const file = path.join(ROOT, "deployments", `${networkName()}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")).address;
  throw new Error("no contract address, run `npm run deploy:contract` first");
}
