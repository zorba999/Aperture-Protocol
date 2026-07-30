"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MaskLine, Reveal } from "@/components/Chrome";
import TxStream from "@/components/TxStream";
import { useWallet } from "@/lib/wallet";
import {
  readJson,
  fromAtto,
  timeAgo,
  TIER_LABEL,
  MODIFIER_LABEL,
  type Licence,
  type Quote,
  type Claim,
} from "@/lib/genlayer";

export default function VaultPage() {
  const { address, send, stage, chainOk, switchChain } = useWallet();
  const [licences, setLicences] = useState<Licence[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"licences" | "quotes">("licences");

  const load = useCallback(async () => {
    if (!address) return;
    const key = address.toLowerCase();
    const [l, q, c] = await Promise.all([
      readJson<Licence[]>("list_licences", [key]),
      readJson<Quote[]>("list_quotes", [key]),
      readJson<Claim[]>("list_claims"),
    ]);
    setLicences(l.reverse());
    setQuotes(q.reverse());
    setClaims(c);
  }, [address]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const settle = async (licence: Licence) => {
    const claim = claims
      .filter((c) => c.licence_id === licence.id && c.verdict === "OUT_OF_SCOPE")
      .pop();
    if (!claim) return;
    setBusy(licence.id);
    try {
      await send({
        functionName: "settle_breach",
        args: [claim.id],
        value: BigInt(claim.atto_shortfall),
        label: `Settling ${claim.id}`,
      });
      await load();
    } catch {
      /* stage carries it */
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="shell" style={{ paddingTop: "calc(var(--nav-h) + 8vw)", paddingBottom: "10vw" }}>
      <div className="spread" style={{ alignItems: "flex-end", marginBottom: 46 }}>
        <div>
          <span className="label">Your holdings</span>
          <h1 className="display d1" style={{ marginTop: 20, fontSize: "clamp(3rem, 9vw, 8rem)" }}>
            <MaskLine>The</MaskLine>
            <MaskLine delay={90}>
              <em>vault.</em>
            </MaskLine>
          </h1>
        </div>
        <div className="inline" style={{ gap: 8 }}>
          {(["licences", "quotes"] as const).map((t) => (
            <button
              key={t}
              className="chip"
              data-tone={tab === t ? "solid" : undefined}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {!address ? (
        <Reveal>
          <p className="lede">Connect a wallet to see the licences and quotes tied to it.</p>
        </Reveal>
      ) : !chainOk ? (
        <button className="btn" data-variant="acid" onClick={switchChain}>
          Switch to Bradbury
        </button>
      ) : (
        <>
          <TxStream stage={stage} />

          {tab === "licences" && (
            <div className="rows" style={{ marginTop: 24 }}>
              <div className="row label" style={{ gridTemplateColumns: "90px 1fr 200px 130px 150px" }}>
                <span>id</span>
                <span>clip / scope</span>
                <span>tier</span>
                <span>paid</span>
                <span>status</span>
              </div>

              {licences.length === 0 && (
                <p className="dim" style={{ paddingTop: 28 }}>
                  No licences yet.{" "}
                  <Link href="/archive" className="link-u acid">
                    Open the archive
                  </Link>{" "}
                  and describe a use.
                </p>
              )}

              {licences.map((licence, i) => {
                const breach = licence.status === "BREACH";
                const claim = claims
                  .filter((c) => c.licence_id === licence.id && c.verdict === "OUT_OF_SCOPE")
                  .pop();
                return (
                  <Reveal
                    key={licence.id}
                    delay={i * 60}
                    className="row"
                    style={{ gridTemplateColumns: "90px 1fr 200px 130px 150px" }}
                  >
                    <span className="mono acid">{licence.id}</span>
                    <span className="stack" style={{ gap: 6 }}>
                      <Link href={`/archive/${licence.asset_id}`} className="link-u" style={{ width: "fit-content" }}>
                        {licence.asset_id}
                      </Link>
                      <span className="label">{licence.scope}</span>
                      <span className="label">{timeAgo(licence.issued_at)}</span>
                    </span>
                    <span className="mono dim" style={{ textTransform: "none" }}>
                      {TIER_LABEL[licence.tier_code]}
                    </span>
                    <span className="mono">{fromAtto(licence.atto_paid)} GEN</span>
                    <span className="stack" style={{ gap: 10, alignItems: "flex-start" }}>
                      <span className="chip" data-tone={breach ? "ember" : "acid"}>
                        {licence.status}
                      </span>
                      {breach && claim && (
                        <button
                          className="btn"
                          disabled={busy === licence.id}
                          onClick={() => settle(licence)}
                          style={{ padding: "9px 14px" }}
                        >
                          Settle {fromAtto(claim.atto_shortfall)} GEN
                        </button>
                      )}
                    </span>
                  </Reveal>
                );
              })}
            </div>
          )}

          {tab === "quotes" && (
            <div className="rows" style={{ marginTop: 24 }}>
              <div className="row label" style={{ gridTemplateColumns: "90px 1fr 160px 130px 130px" }}>
                <span>id</span>
                <span>request / reasoning</span>
                <span>tier</span>
                <span>price</span>
                <span>status</span>
              </div>

              {quotes.length === 0 && (
                <p className="dim" style={{ paddingTop: 28 }}>
                  No quotes requested from this address yet.
                </p>
              )}

              {quotes.map((quote, i) => (
                <Reveal
                  key={quote.id}
                  delay={i * 50}
                  className="row"
                  style={{ gridTemplateColumns: "90px 1fr 160px 130px 130px" }}
                >
                  <span className="mono acid">{quote.id}</span>
                  <span className="stack" style={{ gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{quote.usage_text}</span>
                    <span className="label" style={{ lineHeight: 1.7, textTransform: "none" }}>
                      {quote.reasoning}
                    </span>
                    {quote.modifiers.length > 0 && (
                      <span className="inline" style={{ gap: 6, marginTop: 4 }}>
                        {quote.modifiers.map((m) => (
                          <span className="chip" key={m} style={{ padding: "4px 9px" }}>
                            {MODIFIER_LABEL[m] ?? m}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="mono dim" style={{ textTransform: "none" }}>
                    {TIER_LABEL[quote.tier_code]}
                  </span>
                  <span className="mono">{fromAtto(quote.atto_price)} GEN</span>
                  <span>
                    <span
                      className="chip"
                      data-tone={
                        quote.flagged || quote.status === "REFUSED"
                          ? "ember"
                          : quote.status === "OPEN"
                            ? "acid"
                            : undefined
                      }
                    >
                      {quote.status}
                    </span>
                  </span>
                </Reveal>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
