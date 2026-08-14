# Aperture Protocol

Adaptive licensing for archival and aerial footage, built as a GenLayer Intelligent Contract on
**Testnet Bradbury** with a Next.js front end.

A buyer describes their intended use in plain language. Validators independently classify that
description against the creator's prose rate card. The price falls out of a deterministic table.
After the licence is issued, anyone can submit a URL as evidence of a usage beyond the licensed
tier, and the contract judges it and assesses the shortfall.

```
0xF0bCec327E50A67Faf4fe0Ed60DDb5a984fc2151   Testnet Bradbury, chain 4221
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
| `file_claim` | the derived verdict (`NO_MEDIA_MATCH` / `UNATTRIBUTED` / `WITHIN_SCOPE` / `ALLEGED_OUT_OF_SCOPE:<tier>`) | media_match, holder_shown, confident and tier taken separately, reasoning prose |
| `contest_claim` | the derived outcome (`DISMISS` / `STANDS`) | reasoning prose |

The `file_claim` row is the more interesting one. Comparing the raw judgments field by field looked
stricter and was worse in practice: two validators can disagree on whether an obvious non match
counts as "confident" while both land on the same outcome, and that disagreement rotated the leader
indefinitely. The contract only ever acts on the derived verdict, so the derived verdict is what
validators have to agree on. When a claim escalates, the tier is folded into the compared string,
because there the exact tier does change the money.

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

### The audit cannot be used as a weapon

This is the part that was wrong in the first version and is worth reading closely.

`file_claim` originally read the **text** of a page the reporter chose and acted on it. So anyone
could write a page saying *"Katla Caldera, Descent, Myrdalsjokull Iceland, used in our national TV
campaign"*, file it against a stranger's licence, and the contract would mark that licence in
breach and record a debt. No footage had to be involved. It cost nothing. The protocol's own appeal
window was no help, because appealing re-runs the same judgment on the same forged page: the input
was the problem, not the consensus.

A claim now has to pass three gates, and the punitive state is no longer immediate.

| Gate | What it proves | How |
| --- | --- | --- |
| media | the registered footage is actually on the page | the contract fetches the page, scrapes its `img`/`source`/`video` sources deterministically, fetches each candidate and compares SHA-256 against the fingerprint taken when the asset was registered. Not a judgment call |
| identity | the page is the holder's to answer for | the URL sits under a prefix the holder declared at purchase, **or** the page names the holder as the advertiser |
| scope | the usage outranks what they paid for | tier comparison, as before |

The media gate is worth dwelling on because it is where the reported hole was.
It is an exact match on bytes, not a model comparing screenshots. A page that
carries no media fails **before a single byte is fetched and before any
inference is spent**, which is what the text-only forgery deserves. The model
is left with the two questions it is actually good at: is the holder named
here, and what distribution does the copy describe.

The identity gate is deliberately **deterministic wherever it can be**. Prefix matching runs in
plain code on every validator, is path aware, and normalises the URL first, so `youtube.com/@nike`
does not cover `youtube.com/@adidas`, and `nike.com.evil.example` does not cover `nike.com`. Only
the fallback ("does this page name the holder") is a model judgment, and it is a yes or no, not a
free text brand name that validators would then have to agree on spelling.

Passing all three does **not** produce a breach. It produces `ALLEGED_OUT_OF_SCOPE`, moves the
licence to `DISPUTED`, and opens a response window. The holder can `contest_claim` with evidence of
their own, which is adjudicated separately. Only `finalize_claim`, after an unanswered window, makes
the breach real.

Around that:

- **Bond.** `file_claim` is payable. An unfounded claim (`NO_MEDIA_MATCH`) forfeits the bond to the
  creator. A misdirected but honest one (`UNATTRIBUTED`) gets it back, because reporting real
  infringement by a third party should not be punished.
- **Replay.** Evidence URLs are normalised into a key, so `?utm_source=`, `www.`, casing and
  trailing slashes cannot refile the same page. Open claims are capped per licence.
- **Accounting.** `atto_recovered` moves in `settle_breach` and nowhere else. The first version
  credited it the moment a claim was raised, so the contract reported recovering money that nobody
  had paid.

### The validator budget is a design constraint, not an afterthought

This is the finding that changed the implementation, and it was measured rather than reasoned
about. Every validator repeats the whole non deterministic block independently, so the cost of a
nondet call is multiplied by the validator set, not paid once.

The first working media gate compared a screenshot of the reported page against a screenshot of the
reference frame with a vision model. It ran, and then Bradbury returned `VALIDATORS_TIMEOUT`
instead of a verdict, with roughly 105 seconds of host time for the leader alone.

`contracts/probe.py` and `scripts/probe.mjs` are the throwaway harness written to find out why.
One method per primitive, so the answer could not be ambiguous:

| Primitive | Result |
| --- | --- |
| `gl.nondet.web.request` (HTTP GET) | whole transaction settled in **12s** |
| `gl.nondet.web.render` mode `text` | still unsettled at **355s** |
| `gl.nondet.web.render` mode `screenshot` | still unsettled at **424s** |

The headless browser is the expensive part, not the model. And genlayer-js 1.1.8 exposes no time
allocation on `writeContract` (only `leaderOnly` and `consensusMaxRotations`), so the budget cannot
be raised from the client. The work has to fit.

So the audit was rebuilt with no browser anywhere: fetch the page as served, scrape media sources
deterministically, fetch and hash the candidates, and spend the one model call on reading the page
copy. That is both cheaper and stronger than what it replaced.

Two smaller things learned the same way, both encoded in `scripts/`:

- **Deploy payload size matters and the ceiling moves.** A 51KB build deployed in the morning and
  was refused with `intrinsic gas too low` the same evening while a 3.5KB contract went through in
  the same minute. `scripts/minify_contract.py` strips comments and docstrings before deploying and
  commits the artifact to `build/` so it can be diffed against the source.
- **`ACCEPTED` is a consensus milestone, not an indexing one.** Reading contract state immediately
  after a receipt lands returns nothing, which looks exactly like a failed write. Deploy and every
  script poll until the state is actually readable.

What this still does not do: there is no cryptographic fingerprint. A vision model comparing a page
screenshot against a reference frame is a strong filter, not a proof. The honest claim is narrower
than "we detect infringement": griefing now costs money, needs the real footage on the page, needs a
link to the holder, and is answerable before it bites.

---

## Contract surface

`contracts/aperture.py`

| Method | Kind | Notes |
| --- | --- | --- |
| `register_asset` | write | Creator registers a clip, a prose rate card, a base price per tier and the reference frame the audit compares against |
| `request_quote` | write, **nondet** | Classifies a plain language use, prices it deterministically |
| `purchase` | write, payable | Issues a licence. Takes the brand it runs under and the channels it runs on, which is what later makes a claim answerable |
| `file_claim` | write, payable, **nondet** | Bonded. Runs the media, identity and scope gates and opens a response window if all three pass |
| `contest_claim` | write, **nondet** | Holder answers an open claim with their own evidence |
| `finalize_claim` | write | After an unanswered window, turns an open claim into a breach |
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

### 5. Tests

Offline, instant, no chain. Covers URL normalisation, prefix matching and the order the audit gates
run in:

```bash
npm run test:gates
```

Against the deployed contract. Files the actual attack from three fixtures under `public/fixtures/`
and checks that none of them can produce a breach:

```bash
npm run adversarial
```

The adversarial run needs the fixtures reachable, so it points at the deployed front end by default.
Override with `APP_ORIGIN` to run it against a preview deployment.

### 6. Optional end to end check

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
   | `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0xF0bCec327E50A67Faf4fe0Ed60DDb5a984fc2151` |
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

- **The media fingerprint is byte exact.** It cannot be argued with, and it also cannot see a
  re-encode, a crop or a resize. An infringer who re-exports the frame defeats it. Perceptual
  hashing is the upgrade path; exact hashing is what fits the validator budget today and it is
  enough to close the reported hole.
- **Only HTML that is served is read.** A page that injects its media through JavaScript exposes no
  `img` source to scrape, so it reads as no media. Out of scope for now, and stated rather than
  hidden.
- **Attribution has a residual gap.** A page that hosts the real footage and names the holder will
  pass the identity gate even if the holder never published it. That is why the outcome is a
  disputed licence with a response window rather than an immediate breach, and why the reporter has
  a bond at stake.
- **The response window is 24 hours on testnet.** That is short for a real dispute and is set that
  way so the lifecycle can be demonstrated in one sitting.
- An on chain licence is strong evidence, not a court order. What it removes is the part plaintiffs
  usually lose on: contemporaneous, third party adjudicated documentation.
- Quotes expire after 48 hours by design, so a price cannot be requested cheaply and redeemed after
  the creator edits the rate card.
- Testnet only. Not legal advice.
