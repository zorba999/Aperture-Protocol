# Aperture Protocol

Adaptive licensing for archival and aerial footage, built as a GenLayer Intelligent Contract on
**Testnet Bradbury** with a Next.js front end.

A buyer describes their intended use in plain language. Validators independently classify that
description against the creator's prose rate card. The price falls out of a deterministic table.
After the licence is issued, anyone can submit a URL as evidence of a usage beyond the licensed
tier, and the contract judges it and assesses the shortfall.

```
0xb523dCaCd5b83c7d674973f63743618Ff8312529   Testnet Bradbury, chain 4221
```

---

## Why this needs GenLayer

The price of a clip is not a property of the footage. It is a property of the sentence describing
what someone intends to do with it. Every stock platform answers that with twelve dropdowns that
never fit, or with "contact sales" and a three week wait.

Three things here cannot be done with a normal smart contract:

1. **The rate card is prose, not a table.** It is stored verbatim on chain and treated as the
   governing law of the asset.
2. **The input is a sentence.** No form could hold "eight seconds, national TV spot in Italy,
   banking client, six months with social cutdowns".
3. **The contract keeps judging after settlement.** It renders an arbitrary public page and decides
   what usage that page evidences.

---

## The consensus design

This is the part that decides whether the project works at all.

### The model never produces a price

If you ask an LLM "how much is this licence" one validator says 2,400 and another says 2,800 and
consensus never converges. Instead the model returns:

- one **tier code** from a closed set of six
- zero or more **modifier codes** from a closed set of five
- free text reasoning, which is stored but never compared

Classification converges across validators. Free form numbers do not. The price is then plain
integer arithmetic (`base * (100 + sum(uplifts)) / 100`) performed after consensus, in
`_price_for`.

### Every non deterministic call is comparative

Both `request_quote` and `file_claim` use `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` where
the validator **reruns the whole task** and compares decision fields:

| Method | Compared | Ignored |
| --- | --- | --- |
| `request_quote` | tier, sorted modifiers | reasoning prose |
| `file_claim` | the derived verdict (`WITHIN_SCOPE` / `OUT_OF_SCOPE:<tier>` / `INCONCLUSIVE`) | references, confident and tier taken separately, reasoning prose |

The `file_claim` row is the more interesting one. Comparing `references` and `confident` field by
field looked stricter and was worse in practice: two validators can disagree on whether an obvious
non match counts as "confident" while both land on the same `INCONCLUSIVE` outcome, and that
disagreement rotated the leader indefinitely. The contract only ever acts on the derived verdict,
so the derived verdict is what validators have to agree on. When the verdict is `OUT_OF_SCOPE` the
tier is folded into the compared string, because there the exact tier does change the money.

Schema-only validation was deliberately avoided. Checking that the leader returned a legal enum
value proves the leader formatted its answer correctly, not that the answer is right, and it lets
one leader decide alone.

### Untrusted input is fenced

There are two layers, and the order matters.

First a **deterministic gate** (`_detect_injection`) runs before any non deterministic block. It
scans the text for instruction shaped phrases and for internal tier or modifier codes, which a
buyer describing a real use never types. A hit short circuits: the request never reaches a model,
the quote is written straight to storage as `FLAGGED` at zero price, and no validator burns an LLM
call on it. This lives in code rather than in the prompt on purpose. Models are unreliable when
asked meta questions about their own input, and making validators agree on "was that manipulation"
was a source of disagreement and leader rotation. A string scan always converges.

Second, whatever survives the gate is wrapped in explicit markers, labelled as data that is never
an instruction, and `<<<` / `>>>` sequences inside it are neutralised before the prompt is built.
The model is left with the single job it is good at: classifying the underlying use.

`purchase` refuses any quote with status `FLAGGED`.

Try the **Injection** preset on any asset page to watch this happen on chain.

### Errors are classified

`[EXPECTED]`, `[EXTERNAL]`, `[TRANSIENT]` and `[LLM_ERROR]` prefixes let validators agree on
deterministic failures, tolerate transient network failures, and always disagree on LLM
misbehaviour so consensus rotates to a new leader.

### The patrol is pull, not push

The contract cannot crawl the internet, and GenLayer contracts do not self trigger on Bradbury.
So the search happens off chain (anyone can spot a violation) and only the **judgment** happens on
chain. That split is also what makes the incentive work: a spotter has a reason to look.

---

## Contract surface

`contracts/aperture.py`

| Method | Kind | Notes |
| --- | --- | --- |
| `register_asset` | write | Creator registers a clip, a prose rate card and a base price per tier |
| `request_quote` | write, **nondet** | Classifies a plain language use, prices it deterministically |
| `purchase` | write, payable | Issues a licence, routes the fee to the creator |
| `file_claim` | write, **nondet** | Renders an evidence page and judges the usage it shows |
| `settle_breach` | write, payable | Holder pays the assessed shortfall, licence returns to active |
| `get_meta`, `list_assets`, `get_asset`, `quote_preview`, `list_quotes`, `get_quote`, `list_licences`, `list_claims` | view | All return JSON strings so the front end never has to guess at calldata shapes |

Tiers: `EDU_NONCOMMERCIAL`, `INDIE_DOC`, `BRANDED_WEB`, `BRANDED_PAID_MEDIA`,
`BROADCAST_NATIONAL`, `RESTRICTED`.

Modifiers: `SECTOR_SENSITIVE` +50%, `EXCLUSIVITY` +100%, `PERPETUAL` +75%, `TERRITORY_GLOBAL` +40%,
`AI_TRAINING` (forces `RESTRICTED`).

---

## Running it

### 1. Install

```bash
npm install
```

### 2. Configure

Copy `.env.example` to `.env.local`:

```
DEPLOYER_PRIVATE_KEY=0x...
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_GENLAYER_NETWORK=testnetBradbury
```

Check the deployer and its balance:

```bash
npm run whoami
```

Fund it at <https://testnet-faucet.genlayer.foundation/> if the balance is zero.

### 3. Lint, deploy, seed

```bash
pip install genvm-linter
genvm-lint check contracts/aperture.py
npm run deploy:contract
npm run seed
```

`deploy:contract` writes the address back into `.env.local` and into
`deployments/testnetBradbury.json`.

### 4. Run

```bash
npm run dev
```

Stop the dev server before running `npm run build`. Both write to `.next`, and running them at
the same time leaves the dev server serving 404s for its own chunks. If that happens, delete
`.next` and restart.

### 5. Optional end to end check

```bash
npm run seed
node scripts/demo.mjs
```

`demo.mjs` runs three classifications (national ad, prompt injection, student thesis), buys a
licence, and files an audit claim, printing the validator reasoning at each step.

---

## Deploying to Vercel

The app is a stock Next.js 15 App Router project with no server side secrets, so it deploys as is.

1. Push the repo to GitHub and import it in Vercel.
2. Add two environment variables in the Vercel project settings:

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0xb523dCaCd5b83c7d674973f63743618Ff8312529` |
   | `NEXT_PUBLIC_GENLAYER_NETWORK` | `testnetBradbury` |

3. Deploy. Build command and output directory are the Next.js defaults.

`DEPLOYER_PRIVATE_KEY` is only read by `scripts/`. It is never imported by anything under `src/`
and never reaches the client bundle. Do not add it to Vercel.

---

## Front end

- **Next.js 15** App Router, React 19, no CSS framework. One hand written design system in
  `src/app/globals.css`.
- **Wallet adapter**: `src/lib/wallet.tsx` implements EIP-6963 discovery, so MetaMask, Rabby, Frame
  and anything else injected all show up in the picker, with a fallback to legacy
  `window.ethereum`. It remembers the last wallet, listens for `accountsChanged` and
  `chainChanged`, and uses `client.connect("testnetBradbury")` to add or switch the network.
- **Transaction stream**: every write renders a four step lifecycle (sign, submit, validators
  reading, accepted) driven by the real receipt status, and decodes `[EXPECTED]` style contract
  errors into readable messages.
- **Visuals**: the footage previews are procedurally generated canvas flow fields seeded by asset
  id (`src/components/ClipField.tsx`). Nothing is fetched from an external host, so nothing can
  404 in production.

Routes:

| Route | Purpose |
| --- | --- |
| `/` | The argument, the mechanism, an archive preview |
| `/archive` | All registered clips |
| `/archive/[id]` | Rate card, price ladder, and the request console |
| `/vault` | Your licences and quotes, plus breach settlement |
| `/patrol` | File audit claims and read the verdict feed |

---

## Known limits

- Video fingerprinting is not implemented. The audit judges the **page**, using its title, credits
  and surrounding copy. A production version would fingerprint frames off chain and pass only the
  match candidate on chain. `gl.nondet.web.render(url, mode="screenshot")` plus
  `gl.nondet.exec_prompt(images=[...])` is the upgrade path.
- An on chain licence is strong evidence, not a court order. What it removes is the part plaintiffs
  usually lose on: contemporaneous, third party adjudicated documentation.
- Quotes expire after 48 hours by design, so a price cannot be requested cheaply and redeemed after
  the creator edits the rate card.
- Testnet only. Not legal advice.
