"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ClipField from "@/components/ClipField";
import { MaskLine, Reveal } from "@/components/Chrome";
import { readJson, fromAtto, TIER_ORDER, type Asset } from "@/lib/genlayer";

export default function ArchivePage() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readJson<Asset[]>("list_assets")
      .then(setAssets)
      .catch((err) => setError(err instanceof Error ? err.message : "could not read the archive"));
  }, []);

  return (
    <section className="shell" style={{ paddingTop: "calc(var(--nav-h) + 8vw)" }}>
      <div className="spread" style={{ alignItems: "flex-end", marginBottom: 56 }}>
        <div>
          <span className="label">The archive</span>
          <h1 className="display d1" style={{ marginTop: 20, fontSize: "clamp(3rem, 9vw, 8rem)" }}>
            <MaskLine>Aerial</MaskLine>
            <MaskLine delay={90}>
              <em>holdings.</em>
            </MaskLine>
          </h1>
        </div>
        <p className="lede" style={{ marginBottom: 8 }}>
          Each clip carries its own rate card, written by the person who flew for it. Pick one and
          tell the contract what you intend to do.
        </p>
      </div>

      {error && (
        <p className="mono ember" style={{ textTransform: "none" }}>
          {error}. Check that NEXT_PUBLIC_CONTRACT_ADDRESS is set.
        </p>
      )}

      <div className="grid12" style={{ rowGap: 44, paddingBottom: "10vw" }}>
        {(assets ?? Array.from({ length: 6 })).map((entry, i) => {
          const asset = entry as Asset | undefined;
          const span = i % 5 === 0 ? "span 8" : i % 5 === 1 ? "span 4" : "span 4";
          return (
            <Reveal key={asset?.id ?? i} delay={(i % 3) * 100} style={{ gridColumn: span }}>
              {asset ? (
                <Link href={`/archive/${asset.id}`} className="clip">
                  <div
                    className="clip-media"
                    style={{ aspectRatio: i % 5 === 0 ? "16 / 8" : "16 / 11" }}
                  >
                    <ClipField seed={asset.id} />
                    <span className="clip-index mono">{String(i + 1).padStart(2, "0")}</span>
                    <span className="clip-cta mono">Describe your use</span>
                  </div>
                  <div className="clip-body">
                    <div className="clip-row">
                      <span style={{ fontSize: 19 }}>{asset.title}</span>
                      <span className="mono dim">{asset.duration_s}s</span>
                    </div>
                    <div className="clip-row">
                      <span className="label">{asset.location}</span>
                      <span className="label">
                        from {fromAtto(asset.prices[TIER_ORDER[1]] ?? "0")} GEN
                      </span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="clip">
                  <div className="clip-media skeleton" />
                  <div className="clip-body">
                    <div className="skeleton" style={{ height: 20, width: "58%" }} />
                    <div className="skeleton" style={{ height: 10, width: "34%" }} />
                  </div>
                </div>
              )}
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
