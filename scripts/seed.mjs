import {
  loadEnv,
  signerClient,
  contractAddress,
  sendWrite,
  chain,
} from "./_shared.mjs";

loadEnv();

const { client, account } = signerClient();
const address = contractAddress();
const c = chain();

const G = (n) => (BigInt(Math.round(n * 1e6)) * 10n ** 12n).toString();

// The audit fetches this to compare against a screenshot of the reported page,
// so it has to be somewhere stable that will not rate limit the validators.
// Override with APP_ORIGIN when seeding against a preview deployment.
const APP_ORIGIN = (process.env.APP_ORIGIN || "https://aperture-protocol.vercel.app").replace(/\/$/, "");
const frame = (id) => `${APP_ORIGIN}/frames/${id}.jpg`;

const ASSETS = [
  {
    id: "katla-caldera",
    title: "Katla Caldera, Descent",
    location: "Myrdalsjokull, Iceland",
    duration: 42,
    rateCard: `Shot over three winters from a permitted flight corridor above the Katla caldera.

Students, universities and non commercial educational use: free, credit "Sigrun Halldors / Aperture" on screen or in the description.

Independent documentaries with a total production budget under 50k: low four figures per clip, and I will go lower for climate and glaciology work. Tell me the budget honestly, I do not check.

Branded content on a company's own channels, no paid distribution: mid four figures.

Anything with paid media behind it, including social boosting and pre roll: premium tier.

National broadcast advertising: premium tier, and I want to know the advertiser.

Banks, insurers, pharmaceutical companies, gambling, crypto exchanges and defence contractors are licensed normally, at their usual tier, plus a sensitivity surcharge on top.

Refused outright, at any price: political campaigns and party broadcasts, in every country, no exceptions. Also refused: training, fine tuning or benchmarking generative models.

Exclusivity is possible but doubles the fee. Worldwide or multi region distribution adds a territory uplift. Perpetual or buyout terms add a further uplift.`,
    prices: {
      EDU_NONCOMMERCIAL: G(0),
      INDIE_DOC: G(0.02),
      BRANDED_WEB: G(0.08),
      BRANDED_PAID_MEDIA: G(0.25),
      BROADCAST_NATIONAL: G(1.2),
    },
  },
  {
    id: "sable-drift",
    title: "Sable Drift",
    location: "Skeleton Coast, Namibia",
    duration: 31,
    rateCard: `Dune field meeting the Atlantic at first light. Filmed under a Namibian film permit, one flight, never repeated.

Free for schools, universities, museums and any non commercial educational context. Credit appreciated, not required.

Independent documentary and festival work: nominal fee. If the film is self funded and under 50k total, ask me and I will usually waive it down to the education rate.

Owned brand channels with no media spend behind them: standard commercial rate.

Paid media, performance campaigns, anything boosted: the paid media rate.

Broadcast advertising at national scale: top rate.

Finance, pharma, alcohol, tobacco, gambling and crypto are welcome at their normal tier with a sensitivity surcharge added.

Refused outright: political campaigns, and any use that trains or evaluates a machine learning model.

Exclusive rights double the fee. Global territory adds an uplift. Perpetual terms add an uplift.`,
    prices: {
      EDU_NONCOMMERCIAL: G(0),
      INDIE_DOC: G(0.015),
      BRANDED_WEB: G(0.06),
      BRANDED_PAID_MEDIA: G(0.2),
      BROADCAST_NATIONAL: G(0.9),
    },
  },
  {
    id: "okavango-first-water",
    title: "Okavango, First Water",
    location: "Okavango Delta, Botswana",
    duration: 55,
    rateCard: `The annual flood arriving across dry channel beds. Filmed with a community guide from Seronga who is credited alongside me on every licence.

Non commercial education, conservation NGOs and community organisations: free, always.

Independent documentary: low rate, and 20 percent of whatever I receive goes back to the Seronga guiding cooperative.

Brand use on owned channels: standard rate.

Paid media: paid media rate.

National broadcast advertising: top rate.

Finance, pharma, gambling, alcohol, tobacco, crypto and defence advertisers are licensed at their normal tier with a surcharge added.

Refused outright: political campaigning, safari operators marketing hunting, and any generative model training or benchmarking.

Exclusivity doubles. Worldwide territory adds an uplift. Perpetual or buyout adds an uplift.`,
    prices: {
      EDU_NONCOMMERCIAL: G(0),
      INDIE_DOC: G(0.025),
      BRANDED_WEB: G(0.1),
      BRANDED_PAID_MEDIA: G(0.3),
      BROADCAST_NATIONAL: G(1.4),
    },
  },
  {
    id: "shuto-0400",
    title: "Shuto Expressway, 04:00",
    location: "Tokyo, Japan",
    duration: 28,
    rateCard: `Empty interchange loops shot in the hour before the first commuters. Flown legally under a Tokyo metropolitan permit, which is genuinely hard to get.

Students and non commercial educational work: free with credit.

Independent documentary and film school thesis projects: low rate.

Brand content on owned channels only: standard rate.

Anything with paid distribution behind it: paid media rate.

National broadcast advertising: top rate. Automotive advertisers are welcome and pay the same as anyone else.

Finance, pharma, gambling, alcohol, tobacco, crypto and defence are licensed at their normal tier with a sensitivity surcharge added.

Refused outright: political advertising, and model training or benchmarking.

Exclusivity doubles the fee. Global territory adds an uplift. Perpetual terms add an uplift.`,
    prices: {
      EDU_NONCOMMERCIAL: G(0),
      INDIE_DOC: G(0.018),
      BRANDED_WEB: G(0.07),
      BRANDED_PAID_MEDIA: G(0.22),
      BROADCAST_NATIONAL: G(1.0),
    },
  },
  {
    id: "kalsoy-ledge",
    title: "Kalsoy Ledge",
    location: "Kalsoy, Faroe Islands",
    duration: 37,
    rateCard: `Sea cliff traverse in flat northern light. One take, no drone lost, which after four attempts felt like a small miracle.

Education and non commercial: free.

Independent documentary: low rate.

Brand owned channels: standard rate.

Paid media of any kind: paid media rate.

National broadcast: top rate.

Finance, pharma, gambling, alcohol, tobacco, crypto and defence are licensed at their normal tier with a surcharge added.

Refused outright: political campaigns, and any generative model training, fine tuning or evaluation.

Exclusivity doubles. Worldwide territory uplift applies. Perpetual or buyout uplift applies.`,
    prices: {
      EDU_NONCOMMERCIAL: G(0),
      INDIE_DOC: G(0.016),
      BRANDED_WEB: G(0.065),
      BRANDED_PAID_MEDIA: G(0.21),
      BROADCAST_NATIONAL: G(0.95),
    },
  },
];

console.log("");
console.log("  Seeding the archive");
console.log("  ------------------------------------------------");
console.log(`  contract  ${address}`);
console.log(`  creator   ${account.address}`);
console.log("");

const existingRaw = await client.readContract({
  address,
  functionName: "list_assets",
  args: [],
});
const existing = new Set(JSON.parse(String(existingRaw)).map((a) => a.id));

for (const asset of ASSETS) {
  if (existing.has(asset.id)) {
    console.log(`  skip ${asset.id} (already registered)`);
    continue;
  }
  console.log(`  register ${asset.id}`);
  await sendWrite(
    client,
    {
      address,
      functionName: "register_asset",
      args: [
        asset.id,
        asset.title,
        asset.location,
        asset.duration,
        asset.rateCard,
        JSON.stringify(asset.prices),
        frame(asset.id),
      ],
      value: 0n,
    },
    asset.id,
  );
  await new Promise((r) => setTimeout(r, 4000));
}

const metaRaw = await client.readContract({ address, functionName: "get_meta", args: [] });
const meta = JSON.parse(String(metaRaw));

console.log("");
console.log("  ------------------------------------------------");
console.log(`  assets    ${meta.assets}`);
console.log(`  explorer  ${c.blockExplorers?.default?.url || ""}address/${address}`);
console.log("");
console.log("  Next: npm run dev");
console.log("");
