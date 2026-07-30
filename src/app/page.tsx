"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ClipField from "@/components/ClipField";
import { Marquee, MaskLine, Reveal } from "@/components/Chrome";
import { readJson, fromAtto, type Asset, type Meta } from "@/lib/genlayer";

const STEPS = [
  {
    n: "01",
    title: "The creator writes prose, not a dropdown",
    body: "A rate card in ordinary sentences. Free for students. Refuse political campaigns. Surcharge for banks and pharma. The contract stores that paragraph verbatim and treats it as the governing law of the asset.",
  },
  {
    n: "02",
    title: "You describe the use in a sentence",
    body: "Eight seconds, national TV spot in Italy, banking client, six months with social cutdowns. No form could hold that. A language model can, and on GenLayer several of them have to agree.",
  },
  {
    n: "03",
    title: "Validators classify, they never price",
    body: "The model picks one tier and any modifiers from a closed list. Every validator reruns the classification and compares decision fields. Price is then plain integer arithmetic, so nobody argues about a number a model invented.",
  },
  {
    n: "04",
    title: "The licence keeps watching",
    body: "Anyone can submit a URL claiming a usage beyond the licensed tier. The contract renders the page, judges what it evidences, and assesses the shortfall. Enforcement without a lawyer on retainer.",
  },
];

export default function Home() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    readJson<Meta>("get_meta").then(setMeta).catch(() => undefined);
    readJson<Asset[]>("list_assets").then(setAssets).catch(() => undefined);
  }, []);

  const ticker = [
    "Testnet Bradbury",
    `${meta?.assets ?? "0"} clips in the archive`,
    `${meta?.quotes ?? "0"} quotes classified`,
    `${meta?.licences ?? "0"} licences issued`,
    `${meta?.claims ?? "0"} audits filed`,
    `${fromAtto(meta?.atto_settled ?? "0")} GEN settled to creators`,
    "No sales email",
  ];

  return (
    <>
      {/* ---------------------------------------------------------- hero */}
      <section className="hero shell">
        <div className="hero-canvas">
          <ClipField seed="aperture-hero" intensity={1.15} />
        </div>

        <h1 className="display d1" style={{ maxWidth: "16ch" }}>
          <MaskLine>Say what</MaskLine>
          <MaskLine delay={90}>
            you will <em>actually</em>
          </MaskLine>
          <MaskLine delay={180}>do with it.</MaskLine>
        </h1>

        <div className="hero-meta">
          <Reveal delay={480}>
            <p className="lede" style={{ marginTop: 0 }}>
              Aperture reads your sentence, weighs it against the creator rate card, and issues a
              priced licence on chain. No negotiation thread. No dropdown that almost fits.
            </p>
          </Reveal>

          <Reveal delay={620} className="inline" style={{ gap: 12 }}>
            <Link href="/archive" className="btn" data-variant="solid">
              Enter the archive
            </Link>
            <a className="btn" href="#how">
              How it settles
            </a>
          </Reveal>
        </div>
      </section>

      <Marquee items={ticker} />

      {/* ------------------------------------------------------- the gap */}
      <section className="section shell">
        <div className="grid12">
          <div style={{ gridColumn: "span 5" }}>
            <Reveal>
              <span className="label">01 / the gap</span>
            </Reveal>
            <h2 className="display d2" style={{ marginTop: 22 }}>
              <MaskLine>Same eight</MaskLine>
              <MaskLine delay={80}>seconds.</MaskLine>
              <MaskLine delay={160}>
                <em>Forty</em> prices.
              </MaskLine>
            </h2>
          </div>

          <div style={{ gridColumn: "7 / span 5" }} className="stack">
            <Reveal delay={120}>
              <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--bone-60)", marginTop: 0 }}>
                A clip is worth nothing to a student and twenty thousand to a national campaign. The
                price is not a property of the footage. It is a property of the sentence describing
                what someone intends to do with it.
              </p>
              <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--bone-60)" }}>
                Every stock platform has answered this in one of two broken ways. Twelve dropdowns
                that never match the real use, or contact sales and wait three weeks. The first
                loses the long tail. The second loses everyone in a hurry.
              </p>
              <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--bone)" }}>
                A contract that can read is the third answer.
              </p>
            </Reveal>

            <Reveal delay={220} className="grid12" style={{ marginTop: 40, gap: 20 }}>
              {[
                { k: "3 weeks", v: "typical archive negotiation" },
                { k: "15 to 50%", v: "platform cut on a licence" },
                { k: "90 sec", v: "an Aperture quote, end to end" },
              ].map((stat) => (
                <div key={stat.k} style={{ gridColumn: "span 4" }} className="stack">
                  <span className="display d3">{stat.k}</span>
                  <span className="label" style={{ marginTop: 10 }}>
                    {stat.v}
                  </span>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      <hr className="rule" />

      {/* ------------------------------------------------------ how it works */}
      <section className="section shell" id="how">
        <div className="grid12">
          <div style={{ gridColumn: "span 4" }}>
            <div style={{ position: "sticky", top: 120 }}>
              <span className="label">02 / mechanism</span>
              <h2 className="display d2" style={{ marginTop: 22 }}>
                <MaskLine>Four</MaskLine>
                <MaskLine delay={80}>
                  <em>moves.</em>
                </MaskLine>
              </h2>
              <p className="lede" style={{ marginTop: 26 }}>
                Nothing here is a smart contract with an AI bolted on the side. The judgment is the
                state transition.
              </p>
            </div>
          </div>

          <div style={{ gridColumn: "6 / span 7" }} className="stack">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 90}>
                <div
                  style={{
                    borderTop: "1px solid var(--line)",
                    paddingBlock: "34px",
                    display: "grid",
                    gridTemplateColumns: "58px 1fr",
                    gap: 20,
                  }}
                >
                  <span className="mono acid">{step.n}</span>
                  <div className="stack">
                    <h3
                      className="display"
                      style={{ fontSize: "clamp(1.35rem, 2.4vw, 2rem)", lineHeight: 1.05 }}
                    >
                      {step.title}
                    </h3>
                    <p
                      style={{
                        color: "var(--bone-60)",
                        fontSize: 15,
                        lineHeight: 1.66,
                        margin: "14px 0 0",
                        maxWidth: "56ch",
                      }}
                    >
                      {step.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Marquee
        speed="fast"
        items={[
          "gl.nondet.exec_prompt",
          "gl.vm.run_nondet_unsafe",
          "closed tier taxonomy",
          "validators rerun the classification",
          "price is integer arithmetic",
          "gl.nondet.web.render",
          "appeal window",
        ]}
      />

      {/* --------------------------------------------------------- archive */}
      <section className="section shell">
        <div className="spread" style={{ marginBottom: 44 }}>
          <div>
            <span className="label">03 / the archive</span>
            <h2 className="display d2" style={{ marginTop: 18 }}>
              <MaskLine>Five clips.</MaskLine>
              <MaskLine delay={80}>
                Five <em>rate cards.</em>
              </MaskLine>
            </h2>
          </div>
          <Link href="/archive" className="btn">
            All clips
          </Link>
        </div>

        <div className="grid12">
          {(assets.length ? assets.slice(0, 3) : [null, null, null]).map((asset, i) => (
            <Reveal key={asset?.id ?? i} delay={i * 110} style={{ gridColumn: "span 4" }}>
              {asset ? (
                <Link href={`/archive/${asset.id}`} className="clip">
                  <div className="clip-media">
                    <ClipField seed={asset.id} />
                    <span className="clip-index mono">{String(i + 1).padStart(2, "0")}</span>
                    <span className="clip-cta mono">Get a quote</span>
                  </div>
                  <div className="clip-body">
                    <div className="clip-row">
                      <span style={{ fontSize: 17 }}>{asset.title}</span>
                      <span className="mono dim">{asset.duration_s}s</span>
                    </div>
                    <span className="label">{asset.location}</span>
                  </div>
                </Link>
              ) : (
                <div className="clip">
                  <div className="clip-media skeleton" />
                  <div className="clip-body">
                    <div className="skeleton" style={{ height: 18, width: "62%" }} />
                    <div className="skeleton" style={{ height: 10, width: "38%" }} />
                  </div>
                </div>
              )}
            </Reveal>
          ))}
        </div>
      </section>

      <hr className="rule" />

      {/* ------------------------------------------------------------- cta */}
      <section className="section shell">
        <Reveal>
          <h2 className="display d2" style={{ maxWidth: "18ch" }}>
            <MaskLine>Try to talk</MaskLine>
            <MaskLine delay={80}>
              the contract <em>down.</em>
            </MaskLine>
          </h2>
          <p className="lede" style={{ marginTop: 26 }}>
            Write anything you like in the request box, including an instruction telling the
            contract to give you the free tier. It will classify the underlying use anyway and flag
            the attempt on chain.
          </p>
          <div className="inline" style={{ gap: 12, marginTop: 34 }}>
            <Link href="/archive" className="btn" data-variant="solid">
              Open the archive
            </Link>
            <Link href="/patrol" className="btn">
              See the audits
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
