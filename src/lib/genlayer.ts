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
  tier_code: Tier;
  tier_label: string;
  atto_paid: string;
  scope: string;
  status: "ACTIVE" | "BREACH";
  issued_at: string;
};

export type Claim = {
  id: string;
  licence_id: string;
  asset_id: string;
  reporter: string;
  evidence_url: string;
  verdict: "WITHIN_SCOPE" | "OUT_OF_SCOPE" | "INCONCLUSIVE";
  observed_tier: Tier;
  atto_shortfall: string;
  reasoning: string;
  created_at: string;
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
