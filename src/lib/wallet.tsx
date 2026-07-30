"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "genlayer-js";
import { TransactionStatus } from "genlayer-js/types";
import { CHAIN, CONTRACT_ADDRESS, NETWORK } from "./genlayer";

/* ------------------------------------------------------------------ */
/* EIP-6963 multi wallet discovery                                     */
/* ------------------------------------------------------------------ */

export type WalletInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

type Detected = { info: WalletInfo; provider: Eip1193 };

const STORAGE_KEY = "aperture.wallet.rdns";

/* ------------------------------------------------------------------ */
/* transaction lifecycle                                               */
/* ------------------------------------------------------------------ */

export type TxStage =
  | { phase: "idle" }
  | { phase: "signing"; label: string }
  | { phase: "submitted"; label: string; hash: string }
  | { phase: "consensus"; label: string; hash: string }
  | { phase: "done"; label: string; hash: string }
  | { phase: "error"; label: string; message: string; hash?: string };

type SendArgs = {
  functionName: string;
  args?: unknown[];
  value?: bigint;
  label: string;
};

type Ctx = {
  wallets: WalletInfo[];
  address: string | null;
  connecting: boolean;
  chainOk: boolean;
  error: string | null;
  connect: (rdns?: string) => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
  send: (args: SendArgs) => Promise<{ hash: string }>;
  stage: TxStage;
  clearStage: () => void;
};

const WalletContext = createContext<Ctx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [detected, setDetected] = useState<Detected[]>([]);
  const [address, setAddress] = useState<string | null>(null);
  const [activeRdns, setActiveRdns] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [chainOk, setChainOk] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<TxStage>({ phase: "idle" });
  const autoTried = useRef(false);

  /* discovery */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = new Map<string, Detected>();

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent).detail as Detected;
      if (!detail?.info?.rdns) return;
      seen.set(detail.info.rdns, detail);
      setDetected(Array.from(seen.values()));
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    const legacy = (window as unknown as { ethereum?: Eip1193 }).ethereum;
    const settle = setTimeout(() => {
      if (seen.size === 0 && legacy) {
        seen.set("injected", {
          info: {
            uuid: "injected",
            name: "Browser wallet",
            icon: "",
            rdns: "injected",
          },
          provider: legacy,
        });
        setDetected(Array.from(seen.values()));
      }
    }, 350);

    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      clearTimeout(settle);
    };
  }, []);

  const providerFor = useCallback(
    (rdns: string | null) => {
      if (!rdns) return null;
      return detected.find((d) => d.info.rdns === rdns)?.provider ?? null;
    },
    [detected],
  );

  const verifyChain = useCallback(async (provider: Eip1193) => {
    try {
      const current = (await provider.request({ method: "eth_chainId" })) as string;
      setChainOk(parseInt(current, 16) === CHAIN.id);
    } catch {
      setChainOk(false);
    }
  }, []);

  const connect = useCallback(
    async (rdns?: string) => {
      setError(null);
      const target = rdns ?? detected[0]?.info.rdns ?? null;
      const provider = providerFor(target);
      if (!provider) {
        setError("No EVM wallet detected. Install MetaMask, Rabby or another injected wallet.");
        return;
      }
      setConnecting(true);
      try {
        const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
        if (!accounts?.length) throw new Error("wallet returned no accounts");
        setAddress(accounts[0]);
        setActiveRdns(target);
        window.localStorage.setItem(STORAGE_KEY, target!);
        await verifyChain(provider);
      } catch (err) {
        setError(err instanceof Error ? err.message : "connection rejected");
      } finally {
        setConnecting(false);
      }
    },
    [detected, providerFor, verifyChain],
  );

  /* silent reconnect */
  useEffect(() => {
    if (autoTried.current || detected.length === 0) return;
    autoTried.current = true;
    const remembered = window.localStorage.getItem(STORAGE_KEY);
    const provider = providerFor(remembered);
    if (!remembered || !provider) return;
    provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list?.length) {
          setAddress(list[0]);
          setActiveRdns(remembered);
          void verifyChain(provider);
        }
      })
      .catch(() => undefined);
  }, [detected, providerFor, verifyChain]);

  /* wallet events */
  useEffect(() => {
    const provider = providerFor(activeRdns);
    if (!provider?.on) return;
    const onAccounts = (...payload: never[]) => {
      const accounts = payload[0] as unknown as string[];
      setAddress(accounts?.length ? accounts[0] : null);
    };
    const onChain = (...payload: never[]) => {
      const hex = payload[0] as unknown as string;
      setChainOk(parseInt(hex, 16) === CHAIN.id);
    };
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [activeRdns, providerFor]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setActiveRdns(null);
    setStage({ phase: "idle" });
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const writeClient = useCallback(() => {
    const provider = providerFor(activeRdns);
    if (!provider || !address) throw new Error("wallet is not connected");
    return createClient({
      chain: CHAIN,
      account: address as `0x${string}`,
      provider: provider as never,
    });
  }, [activeRdns, address, providerFor]);

  const switchChain = useCallback(async () => {
    setError(null);
    try {
      await writeClient().connect(NETWORK as never);
      const provider = providerFor(activeRdns);
      if (provider) await verifyChain(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not switch network");
    }
  }, [activeRdns, providerFor, verifyChain, writeClient]);

  const send = useCallback(
    async ({ functionName, args = [], value = 0n, label }: SendArgs) => {
      if (!CONTRACT_ADDRESS) throw new Error("contract address is not configured");
      const client = writeClient();
      setStage({ phase: "signing", label });
      let hash = "";
      try {
        try {
          hash = await client.writeContract({
            address: CONTRACT_ADDRESS,
            functionName,
            args: args as never,
            value,
          });
        } catch (first) {
          // The consensus contract sometimes reverts the outer EVM transaction
          // when the gas estimate races a state change. One resubmission clears
          // it. A rejected signature is never retried.
          const message = first instanceof Error ? first.message : "";
          if (/user rejected|user denied|4001/i.test(message) || !/revert/i.test(message)) throw first;
          setStage({ phase: "signing", label: `${label} (resubmitting)` });
          await new Promise((r) => setTimeout(r, 2500));
          hash = await client.writeContract({
            address: CONTRACT_ADDRESS,
            functionName,
            args: args as never,
            value,
          });
        }
        setStage({ phase: "submitted", label, hash });
        setStage({ phase: "consensus", label, hash });
        const receipt = await client.waitForTransactionReceipt({
          hash: hash as never,
          status: TransactionStatus.ACCEPTED,
          interval: 3000,
          retries: 200,
        });
        const outcome = String(
          (receipt as { txExecutionResultName?: string }).txExecutionResultName ?? "",
        );
        if (outcome.includes("ERROR")) {
          const trace = await client
            .debugTraceTransaction({ hash: hash as never })
            .catch(() => null);
          const detail = extractRevert(trace) || "the contract rejected this call";
          throw new Error(detail);
        }
        setStage({ phase: "done", label, hash });
        return { hash };
      } catch (err) {
        const message = err instanceof Error ? err.message : "transaction failed";
        setStage({ phase: "error", label, message: cleanError(message), hash: hash || undefined });
        throw err;
      }
    },
    [writeClient],
  );

  const value = useMemo<Ctx>(
    () => ({
      wallets: detected.map((d) => d.info),
      address,
      connecting,
      chainOk,
      error,
      connect,
      disconnect,
      switchChain,
      send,
      stage,
      clearStage: () => setStage({ phase: "idle" }),
    }),
    [address, chainOk, connect, connecting, detected, disconnect, error, send, stage, switchChain],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

/* ------------------------------------------------------------------ */

function extractRevert(trace: unknown): string | null {
  if (!trace || typeof trace !== "object") return null;
  const stderr = String((trace as { stderr?: string }).stderr ?? "");
  const log = String((trace as { genvm_log?: string }).genvm_log ?? "");
  const haystack = `${stderr}\n${log}`;
  const match = haystack.match(/\[(EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR)\]\s*([^"\\\n]+)/);
  if (match) return match[2].trim();
  return null;
}

function cleanError(message: string) {
  if (/user rejected|user denied|4001/i.test(message)) return "Signature rejected in the wallet.";
  if (/insufficient funds/i.test(message)) return "Not enough GEN for this transaction.";
  if (/revert/i.test(message) && /consensus contract/i.test(message))
    return "The network rejected the submission twice. Wait a few seconds and try again.";
  const tagged = message.match(/\[(EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR)\]\s*(.+)/);
  if (tagged) return tagged[2].trim();
  return message.length > 220 ? `${message.slice(0, 220)}...` : message;
}
