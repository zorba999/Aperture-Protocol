import fs from "node:fs";
import { spawnSync } from "node:child_process";
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

/**
 * Pull the contract's own error text out of a debug trace.
 *
 * GenVM hands back the message inside `return_data` as hex, so an assertion
 * that wants to know *why* a call was rejected has to decode it.
 */
export function revertReason(trace) {
  const hex = String(trace?.return_data || "").replace(/^0x/, "");
  if (!hex) return "";
  let text = "";
  try {
    text = Buffer.from(hex, "hex").toString("utf8");
  } catch {
    return "";
  }
  // Plain scanning rather than a regex. The payload is binary with the message
  // embedded in it, and escaping a printable-ASCII class through two layers of
  // quoting is how this quietly started swallowing its own leading bracket.
  const printable = (ch) => ch >= " " && ch <= "~";
  for (const tag of ["[EXPECTED]", "[EXTERNAL]", "[TRANSIENT]", "[LLM_ERROR]"]) {
    const at = text.indexOf(tag);
    if (at === -1) continue;
    let end = at + tag.length;
    while (end < text.length && printable(text[end]) && end - at < 220) end += 1;
    return text.slice(at, end).trim();
  }
  let best = "";
  let run = "";
  for (const ch of text) {
    if (printable(ch)) {
      run += ch;
      if (run.length > best.length) best = run;
    } else {
      run = "";
    }
  }
  return best.length >= 12 ? best.trim() : "";
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
      const reason = revertReason(trace);
      if (reason) console.log(`  reason: ${reason}`);
      else console.log(`  trace: ${JSON.stringify(trace).slice(0, 1200)}`);
      // Carry the contract's own message, not just the label. Assertions that
      // match on "reverted" pass for any reason at all, which is how four
      // lifecycle guards looked green while proving nothing.
      const error = new Error(reason ? `${label} reverted: ${reason}` : `${label} reverted`);
      error.revertReason = reason || "";
      throw error;
    }
    console.log(` ok`);
    return receipt;
  } catch (err) {
    clearInterval(spin);
    throw err;
  }
}

/**
 * genlayer-js 1.1.8 exposes no time allocation on writeContract, only
 * `leaderOnly` and `consensusMaxRotations`, so a heavy non-deterministic call
 * cannot be given more room from the client. The work has to fit the default
 * budget, which is why the audit uses HTTP rather than a headless browser.
 */

/**
 * The consensus contract occasionally reverts the outer EVM transaction when
 * several writes are submitted back to back (tight gas estimate plus a moving
 * nonce). Retrying with a short backoff clears it.
 */
export async function sendWrite(client, params, label, attempts = 3) {
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

/**
 * What actually goes on chain.
 *
 * Bradbury refuses large deploy payloads, and the ceiling moves: a 51KB build
 * of this contract deployed fine one morning and was refused with `intrinsic
 * gas too low` the same evening, while a 3.5KB contract went through in the
 * same minute. Comments and docstrings are pure payload, so they are stripped
 * before deployment and kept in the repository where they are useful.
 *
 * The stripped artifact is regenerated here and committed, so the deployed
 * bytes can be diffed against the readable source without trusting anything.
 */
export function contractSource() {
  const source = path.join(ROOT, "contracts", "aperture.py");
  const built = path.join(ROOT, "build", "aperture.min.py");
  const result = spawnSync("python", [path.join(ROOT, "scripts", "minify_contract.py"), source, built], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.log(result.stdout || "");
    console.log(result.stderr || "");
    throw new Error("could not build the deployable contract");
  }
  process.stdout.write(result.stdout);
  return fs.readFileSync(built, "utf8");
}

export function contractAddress() {
  const fromEnv = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (fromEnv) return fromEnv;
  const file = path.join(ROOT, "deployments", `${networkName()}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")).address;
  throw new Error("no contract address, run `npm run deploy:contract` first");
}
