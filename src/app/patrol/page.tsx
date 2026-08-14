"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MaskLine, Reveal } from "@/components/Chrome";
import TxStream from "@/components/TxStream";
import { useWallet } from "@/lib/wallet";
import {
  readJson,
  fromAtto,
  truncate,
  timeAgo,
  addressUrl,
  TIER_LABEL,
  VERDICT_COPY,
  ATTRIBUTION_COPY,
  type Claim,
  type Licence,
  type Meta,
} from "@/lib/genlayer";

/** Seconds left in a claim's response window, negative once it has run out. */
const secondsLeft = (claim: Claim) => claim.window_ends - Math.floor(Date.now() / 1000);

export default function PatrolPage() {
  const { address, send, stage, chainOk, switchChain } = useWallet();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [licences, setLicences] = useState<Licence[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [licenceId, setLicenceId] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  // Settled, not all. A single failing view used to blank the whole page,
  // which made a healthy contract look empty.
  const load = useCallback(async () => {
    const [c, l, m] = await Promise.allSettled([
      readJson<Claim[]>("list_claims"),
      readJson<Licence[]>("list_licences", [""]),
      readJson<Meta>("get_meta"),
    ]);
    if (c.status === "fulfilled") setClaims([...c.value].reverse());
    else console.error("list_claims failed", c.reason);
    if (l.status === "fulfilled") setLicences(l.value);
    else console.error("list_licences failed", l.reason);
    if (m.status === "fulfilled") setMeta(m.value);
    else console.error("get_meta failed", m.reason);
  }, []);

  useEffect(() => {
    load().catch((err) => console.error("patrol load failed", err));
  }, [load]);

  const file = async () => {
    if (!licenceId || !url.startsWith("http") || !meta) return;
    setBusy(true);
    const before = claims.length;
    try {
      await send({
        functionName: "file_claim",
        args: [licenceId, url.trim()],
        // Filing costs a bond. It pays for the inference a claim spends and it
        // is what an unfounded accusation forfeits.
        value: BigInt(meta.min_bond),
        label: `Auditing ${licenceId}`,
      });
      for (let i = 0; i < 24; i += 1) {
        await new Promise((r) => setTimeout(r, 2500));
        const fresh = await readJson<Claim[]>("list_claims");
        if (fresh.length !== before) {
          setClaims([...fresh].reverse());
          break;
        }
      }
      await load();
      setUrl("");
    } catch {
      /* stage carries it */
    } finally {
      setBusy(false);
    }
  };

  /** Anyone can close an unanswered claim once the window has run out. */
  const finalize = async (claim: Claim) => {
    setBusy(true);
    try {
      await send({
        functionName: "finalize_claim",
        args: [claim.id],
        label: `Finalizing ${claim.id}`,
      });
      await load();
    } catch {
      /* stage carries it */
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="shell" style={{ paddingTop: "calc(var(--nav-h) + 8vw)", paddingBottom: "10vw" }}>
      <div className="grid12" style={{ alignItems: "end", marginBottom: 56 }}>
        <div style={{ gridColumn: "span 7" }}>
          <span className="label">Post issuance enforcement</span>
          <h1 className="display d1" style={{ marginTop: 20, fontSize: "clamp(3rem, 9vw, 8rem)" }}>
            <MaskLine>The</MaskLine>
            <MaskLine delay={90}>
              <em>patrol.</em>
            </MaskLine>
          </h1>
        </div>
        <p className="lede" style={{ gridColumn: "9 / span 4", marginBottom: 10 }}>
          The contract cannot crawl the internet. It does not need to. Anyone can point it at a page
          and it will judge whether that page shows a usage the holder never paid for.
        </p>
      </div>

      <div className="grid12" style={{ rowGap: 48 }}>
        {/* ------------------------------------------------------- filing */}
        <div style={{ gridColumn: "span 5" }}>
          <div style={{ position: "sticky", top: 110 }}>
            <Reveal>
              <div className="panel">
                <div className="panel-head">
                  <span className="label">File an audit claim</span>
                  <span className="label">{licences.length} live licences</span>
                </div>
                <div className="panel-body stack" style={{ gap: 18 }}>
                  <div className="stack" style={{ gap: 10 }}>
                    <span className="label">Licence under audit</span>
                    <select
                      className="field"
                      value={licenceId}
                      onChange={(e) => setLicenceId(e.target.value)}
                      style={{ padding: "13px 14px" }}
                    >
                      <option value="">Select a licence</option>
                      {licences.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.id} / {l.asset_id} / {TIER_LABEL[l.tier_code]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="stack" style={{ gap: 10 }}>
                    <span className="label">Evidence url</span>
                    <input
                      className="field"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/the-campaign-page"
                      style={{ padding: "13px 14px" }}
                    />
                    <span className="label" style={{ lineHeight: 1.8, textTransform: "none" }}>
                      The contract renders this page inside a non deterministic block, then several
                      validators independently judge what usage it evidences. They must agree on
                      whether the licence was exceeded before anything is written.
                    </span>
                  </div>

                  {!address ? (
                    <span className="mono dim" style={{ textTransform: "none" }}>
                      Connect a wallet to file a claim.
                    </span>
                  ) : !chainOk ? (
                    <button className="btn" data-variant="acid" onClick={switchChain}>
                      Switch to Bradbury
                    </button>
                  ) : (
                    <button
                      className="btn"
                      data-variant="solid"
                      disabled={busy || !licenceId || !url.startsWith("http")}
                      onClick={file}
                    >
                      {busy ? "Judging" : "Submit evidence"}
                    </button>
                  )}
                </div>
              </div>

              <TxStream stage={stage} />
            </Reveal>
          </div>
        </div>

        {/* -------------------------------------------------------- feed */}
        <div style={{ gridColumn: "7 / span 6" }}>
          <span className="label">Verdict feed</span>

          {claims.length === 0 && (
            <p className="dim" style={{ marginTop: 24 }}>
              No audits yet. Issue a licence from the{" "}
              <Link href="/archive" className="link-u acid">
                archive
              </Link>{" "}
              first, then point the patrol at any public page.
            </p>
          )}

          <div className="rows" style={{ marginTop: 18 }}>
            {claims.map((claim, i) => (
              <Reveal key={claim.id} delay={i * 70} className="row" style={{ gridTemplateColumns: "1fr" }}>
                <div className="spread" style={{ marginBottom: 14 }}>
                  <span className="inline" style={{ gap: 10 }}>
                    <span className="mono acid">{claim.id}</span>
                    <span
                      className="chip"
                      data-tone={
                        VERDICT_COPY[claim.verdict]?.tone === "dim"
                          ? undefined
                          : VERDICT_COPY[claim.verdict]?.tone
                      }
                    >
                      {VERDICT_COPY[claim.verdict]?.label ?? claim.verdict.replace(/_/g, " ")}
                    </span>
                  </span>
                  <span className="label">{timeAgo(claim.created_at)}</span>
                </div>

                {/* The three gates, shown as they resolved. This is the part a
                    reviewer needs: why the claim did or did not bite. */}
                <div className="inline" style={{ gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  <span className="chip" data-tone={claim.media_match ? "acid" : undefined}>
                    media {claim.media_match ? "matched" : "not found"}
                  </span>
                  <span className="chip" data-tone={claim.attribution === "NONE" ? undefined : "acid"}>
                    identity {claim.attribution.toLowerCase()}
                  </span>
                  <span className="chip">bond {claim.bond_state.replace(/_/g, " ").toLowerCase()}</span>
                </div>

                <p
                  style={{
                    margin: "0 0 14px",
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "var(--bone-40)",
                    maxWidth: "70ch",
                  }}
                >
                  {VERDICT_COPY[claim.verdict]?.blurb} {ATTRIBUTION_COPY[claim.attribution]}.
                </p>

                <div className="grid12" style={{ gap: 16 }}>
                  <span className="stack" style={{ gridColumn: "span 8", gap: 8 }}>
                    <a
                      className="mono link-u"
                      style={{ textTransform: "none", wordBreak: "break-all" }}
                      href={claim.evidence_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {claim.evidence_url}
                    </a>
                    <span
                      style={{ fontSize: 14, lineHeight: 1.62, color: "var(--bone-60)" }}
                    >
                      {claim.reasoning}
                    </span>
                    <span className="label">
                      licence {claim.licence_id} / clip {claim.asset_id} / reporter{" "}
                      <a className="link-u" href={addressUrl(claim.reporter)} target="_blank" rel="noreferrer">
                        {truncate(claim.reporter, 6, 4)}
                      </a>
                    </span>
                  </span>

                  <span className="stack" style={{ gridColumn: "span 4", gap: 8, textAlign: "right" }}>
                    <span className="label">observed</span>
                    <span className="mono">{TIER_LABEL[claim.observed_tier]}</span>
                    {(claim.verdict === "ALLEGED_OUT_OF_SCOPE" ||
                      claim.verdict === "UPHELD_OUT_OF_SCOPE") && (
                      <>
                        <span className="label" style={{ marginTop: 10 }}>
                          {claim.verdict === "UPHELD_OUT_OF_SCOPE" ? "shortfall" : "at stake"}
                        </span>
                        <span className="display d3 ember">{fromAtto(claim.atto_shortfall)} GEN</span>
                      </>
                    )}
                    {claim.verdict === "ALLEGED_OUT_OF_SCOPE" &&
                      (secondsLeft(claim) > 0 ? (
                        <span className="label" style={{ marginTop: 10 }}>
                          holder has {Math.ceil(secondsLeft(claim) / 3600)}h to answer
                        </span>
                      ) : (
                        <button
                          className="btn"
                          data-variant="acid"
                          style={{ marginTop: 12 }}
                          disabled={busy || !address}
                          onClick={() => finalize(claim)}
                        >
                          {busy ? "Working" : "Close the window"}
                        </button>
                      ))}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
