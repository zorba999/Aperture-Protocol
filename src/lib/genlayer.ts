import { createClient } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import type { GenLayerChain } from "genlayer-js/types";

export const NETWORK = (process.env.NEXT_PUBLIC_GENLAYER_NETWORK ||
  "testnetBradbury") as keyof typeof chains;

export const CHAIN = (chains as Record<string, unknown>)[NETWORK] as GenLayerChain;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "") as `0x${string}`;

export const EXPLORER = "https://explorer-bradbury.genlayer.com/";
export const FAUCET = "https://testnet-faucet.genlayer.foundation/";

let cached: ReturnType<typeof createClient> | null = null;

export function readClient() {
  if (!cached) cached = createClient({ chain: CHAIN });
  return cached;
}

export async function readJson<T>(functionName: string, args: unknown[] = []): Promise<T> {
  if (!CONTRACT_ADDRESS) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not set");
  const raw = await readClient().readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: args as never,
  });
  return JSON.parse(String(raw)) as T;
}

export function txUrl(hash: string) {
  return `${EXPLORER}tx/${hash}`;
}

export function addressUrl(address: string) {
  return `${EXPLORER}address/${address}`;
}

/* ------------------------------------------------------------------ */
/* formatting                                                          */
/* ------------------------------------------------------------------ */

export function fromAtto(atto: string | bigint, digits = 4) {
  const value = Number(BigInt(atto)) / 1e18;
  if (value === 0) return "0";
  if (value < 0.0001) return "<0.0001";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function truncate(value: string, head = 6, tail = 4) {
  if (!value) return "";
  if (value.length <= head + tail + 2) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const delta = Math.max(0, Date.now() - then);
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ------------------------------------------------------------------ */
/* domain types                                                        */
/* ------------------------------------------------------------------ */

export type Tier =
  | "EDU_NONCOMMERCIAL"
  | "INDIE_DOC"
  | "BRANDED_WEB"
  | "BRANDED_PAID_MEDIA"
  | "BROADCAST_NATIONAL"
  | "RESTRICTED";

export type Asset = {
  id: string;
  title: string;
  location: string;
  creator: string;
  duration_s: number;
  rate_card: string;
  prices: Record<string, string>;
  reference_frame_url: string;
  media_sha256: string;
  created_at: string;
  active: boolean;
};

export type Quote = {
  id: string;
  asset_id: string;
  buyer: string;
  usage_text: string;
  tier_code: Tier;
  tier_label: string;
  modifiers: string[];
  atto_price: string;
  reasoning: string;
  status: "OPEN" | "CONSUMED" | "FLAGGED" | "REFUSED" | "EXPIRED";
  flagged: boolean;
  expires_at: number;
  created_at: string;
};

export type Licence = {
  id: string;
  quote_id: string;
  asset_id: string;
  holder: string;
  holder_name: string;
  prefixes: string[];
  open_claims: number;
  tier_code: Tier;
  tier_label: string;
  atto_paid: string;
  scope: string;
  status: "ACTIVE" | "DISPUTED" | "BREACH";
  issued_at: string;
};

export type Verdict =
  | "NO_MEDIA_MATCH"
  | "UNATTRIBUTED"
  | "WITHIN_SCOPE"
  | "ALLEGED_OUT_OF_SCOPE"
  | "UPHELD_OUT_OF_SCOPE"
  | "DISMISSED";

export type Claim = {
  id: string;
  licence_id: string;
  asset_id: string;
  reporter: string;
  evidence_url: string;
  verdict: Verdict;
  attribution: "DECLARED" | "INFERRED" | "NONE";
  media_match: boolean;
  observed_tier: Tier;
  observed_label: string;
  atto_shortfall: string;
  atto_bond: string;
  bond_state: "HELD" | "REFUNDED" | "FORFEITED" | "PAID_REPORTER" | "PAID_HOLDER";
  window_ends: number;
  reasoning: string;
  rebuttal_url: string;
  rebuttal_reasoning: string;
  created_at: string;
};

/** What each verdict means for the holder, and how loudly to say it. */
export const VERDICT_COPY: Record<
  Verdict,
  { label: string; tone: "acid" | "ember" | "dim"; blurb: string }
> = {
  NO_MEDIA_MATCH: {
    label: "No media match",
    tone: "dim",
    blurb:
      "Nothing the page serves hashes to the registered fingerprint. Naming the clip is not evidence, so nothing happens to the licence and the reporter forfeits their bond.",
  },
  UNATTRIBUTED: {
    label: "Not this holder",
    tone: "dim",
    blurb:
      "The footage is there, but the page is neither a channel the holder declared nor one that names them. It may be real infringement by somebody else. The bond is returned.",
  },
  WITHIN_SCOPE: {
    label: "Within scope",
    tone: "acid",
    blurb: "The usage sits inside the tier the holder paid for. The bond is returned.",
  },
  ALLEGED_OUT_OF_SCOPE: {
    label: "Open, awaiting the holder",
    tone: "ember",
    blurb:
      "All three gates passed. The licence is disputed, not breached, and the holder has a response window to answer with evidence.",
  },
  UPHELD_OUT_OF_SCOPE: {
    label: "Upheld, licence in breach",
    tone: "ember",
    blurb: "The response window closed unanswered. The shortfall is now payable.",
  },
  DISMISSED: {
    label: "Dismissed",
    tone: "acid",
    blurb: "The holder rebutted the claim. The licence is active again and the bond goes to them.",
  },
};

export const ATTRIBUTION_COPY: Record<string, string> = {
  DECLARED: "URL sits under a channel the holder registered at purchase",
  INFERRED: "page names the holder as the advertiser",
  NONE: "nothing ties this page to the holder",
};

export type Meta = {
  protocol: string;
  owner: string;
  assets: number;
  quotes: number;
  licences: number;
  claims: number;
  atto_settled: string;
  atto_recovered: string;
  quote_ttl_s: number;
  min_bond: string;
  claim_window_s: number;
  max_open_claims: number;
  tiers: { code: Tier; label: string; rank: number }[];
  modifiers: { code: string; uplift_pct: number }[];
};

export const TIER_ORDER: Tier[] = [
  "EDU_NONCOMMERCIAL",
  "INDIE_DOC",
  "BRANDED_WEB",
  "BRANDED_PAID_MEDIA",
  "BROADCAST_NATIONAL",
];

export const TIER_LABEL: Record<Tier, string> = {
  EDU_NONCOMMERCIAL: "Education / non commercial",
  INDIE_DOC: "Independent documentary",
  BRANDED_WEB: "Branded, owned channels",
  BRANDED_PAID_MEDIA: "Branded, paid media",
  BROADCAST_NATIONAL: "National broadcast",
  RESTRICTED: "Refused by rate card",
};

export const MODIFIER_LABEL: Record<string, string> = {
  SECTOR_SENSITIVE: "Sensitive sector",
  EXCLUSIVITY: "Exclusive rights",
  PERPETUAL: "Perpetual term",
  TERRITORY_GLOBAL: "Worldwide territory",
  AI_TRAINING: "Model training",
};

export const MODIFIER_UPLIFT: Record<string, number> = {
  SECTOR_SENSITIVE: 50,
  EXCLUSIVITY: 100,
  PERPETUAL: 75,
  TERRITORY_GLOBAL: 40,
  AI_TRAINING: 0,
};
