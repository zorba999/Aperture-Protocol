/**
 * Adversarial tests for the audit path, run against the live contract.
 *
 * The first version of this contract could be made to put a licence into
 * breach from a page the reporter wrote themselves. These tests exist to prove
 * that specific attack is dead, and to pin the rest of the claim lifecycle so
 * it cannot regress quietly.
 *
 *   node scripts/adversarial.mjs
 *
 * The deterministic cases are cheap. The three that exercise the model cost a
 * few minutes each because every validator independently loads two images and
 * reruns the judgment.
 */
import {
  loadEnv,
  signerClient,
  contractAddress,
  sendWrite,
  settle,
  gen,
} from "./_shared.mjs";

loadEnv();

const { client, account } = signerClient();
const address = contractAddress();
const me = account.address.toLowerCase();

const ORIGIN = (process.env.APP_ORIGIN || "https://aperture-protocol.vercel.app").replace(/\/$/, "");
const FIXTURE = {
  textOnly: `${ORIGIN}/fixtures/text-only.html`,
  thirdParty: `${ORIGIN}/fixtures/third-party.html`,
  holder: `${ORIGIN}/fixtures/holder-campaign.html`,
};

const ASSET = "katla-caldera";
const BRAND = "Meridian Bank";

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (detail) console.log(`        ${detail}`);
};

const read = async (fn, args = []) =>
  JSON.parse(String(await client.readContract({ address, functionName: fn, args })));

/** Assert that a write is rejected, and that it is rejected for the right reason. */
async function expectRevert(name, params, expect) {
  try {
    await sendWrite(client, { value: 0n, ...params }, name, 1);
    record(name, false, "the call was accepted, it should have been rejected");
  } catch (err) {
    const message = String(err.message || "");
    const matched = !expect || message.toLowerCase().includes(expect.toLowerCase());
    record(name, matched, matched ? "rejected as expected" : `rejected, but for: ${message.slice(0, 160)}`);
  }
}

/**
 * File one claim and hand back what the contract wrote. A transaction that
 * stalls in consensus is reported as a failed check rather than aborting the
 * run, otherwise one slow verdict hides every result after it.
 */
async function fileAndRead(label, evidenceUrl) {
  const before = (await read("list_claims")).length;
  try {
    await sendWrite(
      client,
      { address, functionName: "file_claim", args: [licence.id, evidenceUrl], value: bond },
      `file_claim (${label})`,
      1,
    );
  } catch (err) {
    console.log(`        submission problem: ${String(err.message).slice(0, 150)}`);
  }
  return waitForClaim(before);
}

async function waitForClaim(before) {
  for (let i = 0; i < 40; i += 1) {
    const list = await read("list_claims");
    if (list.length > before) return list[list.length - 1];
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

console.log("");
console.log("  Aperture adversarial suite");
console.log("  ------------------------------------------------");
console.log(`  contract  ${address}`);
console.log(`  fixtures  ${ORIGIN}/fixtures/`);
console.log("");

const meta = await read("get_meta");
const bond = BigInt(meta.min_bond);
console.log(`  min bond  ${gen(bond)} GEN`);
console.log(`  window    ${meta.claim_window_s}s`);
console.log("");

// ---------------------------------------------------------------------------
// Set up a licence to attack. Owned channels only, so anything showing a
// broadcast usage is an escalation.
// ---------------------------------------------------------------------------

console.log("  setup: buying a BRANDED_WEB licence");
const quotesBefore = (await read("list_quotes", [me])).length;
await sendWrite(
  client,
  {
    address,
    functionName: "request_quote",
    args: [
      ASSET,
      "Six second cutdown for our own Instagram grid and the homepage hero of our website. Nothing boosted, no paid distribution behind it.",
    ],
    value: 0n,
  },
  "request_quote",
);

let quote = null;
for (let i = 0; i < 40 && !quote; i += 1) {
  const list = await read("list_quotes", [me]);
  if (list.length > quotesBefore) quote = list[list.length - 1];
  else await new Promise((r) => setTimeout(r, 3000));
}
if (!quote || quote.status !== "OPEN") {
  console.log(`  setup failed, quote was ${quote ? quote.status : "never written"}`);
  process.exit(1);
}
console.log(`    quote ${quote.id} ${quote.tier_code} at ${gen(quote.atto_price)} GEN`);

await sendWrite(
  client,
  {
    address,
    functionName: "purchase",
    // The holder declares one exact page. Everything else on the internet is
    // somebody else's until a page names this brand.
    args: [quote.id, BRAND, FIXTURE.holder],
    value: BigInt(quote.atto_price),
  },
  "purchase",
);

const licences = await read("list_licences", [me]);
const licence = licences[licences.length - 1];
console.log(`    licence ${licence.id} ${licence.tier_code} as "${licence.holder_name}"`);
console.log("");

// ---------------------------------------------------------------------------
// Deterministic guards. No model involved, so these are fast.
// ---------------------------------------------------------------------------

console.log("  deterministic guards");

await expectRevert(
  "a claim with no bond is rejected",
  { address, functionName: "file_claim", args: [licence.id, FIXTURE.textOnly], value: 0n },
  "bond",
);

await expectRevert(
  "a claim with a non http url is rejected",
  { address, functionName: "file_claim", args: [licence.id, "javascript:alert(1)"], value: bond },
  "http",
);

await expectRevert(
  "a claim against an unknown licence is rejected",
  { address, functionName: "file_claim", args: ["L99999", FIXTURE.textOnly], value: bond },
  "unknown licence",
);

await expectRevert(
  "settling a licence with no upheld claim is rejected",
  { address, functionName: "settle_breach", args: ["c00001"], value: 0n },
  "",
);

console.log("");

// ---------------------------------------------------------------------------
// The attack itself.
// ---------------------------------------------------------------------------

console.log("  attack 1: a page the reporter wrote, naming the clip, showing nothing");
let claim = await fileAndRead("text only", FIXTURE.textOnly);
if (!claim) {
  record("text only page cannot breach a licence", false, "no claim was written");
} else {
  const licenceNow = (await read("list_licences", [me])).find((l) => l.id === licence.id);
  const ok = claim.verdict === "NO_MEDIA_MATCH" && licenceNow.status === "ACTIVE";
  record(
    "text only page cannot breach a licence",
    ok,
    `verdict ${claim.verdict}, media_match ${claim.media_match}, licence ${licenceNow.status}, bond ${claim.bond_state}`,
  );
  console.log(`        model: ${String(claim.reasoning).slice(0, 150)}`);
}
console.log("");

console.log("  attack 2: the real footage, published by someone with no licence");
claim = await fileAndRead("third party", FIXTURE.thirdParty);
if (!claim) {
  record("third party page cannot breach this holder", false, "no claim was written");
} else {
  const licenceNow = (await read("list_licences", [me])).find((l) => l.id === licence.id);
  const ok = claim.verdict !== "ALLEGED_OUT_OF_SCOPE" && licenceNow.status !== "BREACH";
  record(
    "third party page cannot breach this holder",
    ok,
    `verdict ${claim.verdict}, attribution ${claim.attribution}, licence ${licenceNow.status}`,
  );
  console.log(`        model: ${String(claim.reasoning).slice(0, 150)}`);
}
console.log("");

console.log("  case 3: the holder's own declared page, showing a broadcast usage");
claim = await fileAndRead("declared", FIXTURE.holder);
let liveClaim = null;
if (!claim) {
  record("a genuine escalation is recorded", false, "no claim was written");
} else {
  const licenceNow = (await read("list_licences", [me])).find((l) => l.id === licence.id);
  const ok = claim.verdict === "ALLEGED_OUT_OF_SCOPE" && licenceNow.status === "DISPUTED";
  liveClaim = ok ? claim : null;
  record(
    "a genuine escalation opens a window rather than a breach",
    ok,
    `verdict ${claim.verdict}, attribution ${claim.attribution}, licence ${licenceNow.status}, shortfall ${gen(claim.atto_shortfall)} GEN`,
  );
  record(
    "a licence is never sent straight to breach",
    licenceNow.status !== "BREACH",
    `licence is ${licenceNow.status}`,
  );
  console.log(`        model: ${String(claim.reasoning).slice(0, 150)}`);
}
console.log("");

// ---------------------------------------------------------------------------
// Lifecycle guards that only make sense once a claim is open.
// ---------------------------------------------------------------------------

console.log("  lifecycle guards");

await expectRevert(
  "the same page cannot be filed twice",
  { address, functionName: "file_claim", args: [licence.id, FIXTURE.holder], value: bond },
  "already filed",
);

await expectRevert(
  "a url that only differs by query string is still a replay",
  {
    address,
    functionName: "file_claim",
    args: [licence.id, `${FIXTURE.holder}?utm_source=twitter`],
    value: bond,
  },
  "already filed",
);

if (liveClaim) {
  await expectRevert(
    "a claim cannot be finalized before its window closes",
    { address, functionName: "finalize_claim", args: [liveClaim.id], value: 0n },
    "still has until",
  );

  await expectRevert(
    "a claim still open cannot be settled",
    { address, functionName: "settle_breach", args: [liveClaim.id], value: 0n },
    "nothing to settle",
  );
}

console.log("");

// ---------------------------------------------------------------------------

const passed = results.filter((r) => r.ok).length;
const finalMeta = await read("get_meta");
console.log("  ------------------------------------------------");
console.log(`  ${passed} of ${results.length} checks passed`);
console.log(`  claims ${finalMeta.claims} / settled ${gen(finalMeta.atto_settled)} GEN / recovered ${gen(finalMeta.atto_recovered)} GEN`);
console.log("");

if (passed !== results.length) {
  console.log("  failures:");
  for (const r of results.filter((x) => !x.ok)) console.log(`    ${r.name}\n      ${r.detail}`);
  console.log("");
  process.exit(1);
}
