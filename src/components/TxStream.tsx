"use client";

import { txUrl } from "@/lib/genlayer";
import type { TxStage } from "@/lib/wallet";

const STEPS = [
  { key: "signing", title: "Sign in wallet", note: "Local signature" },
  { key: "submitted", title: "Submitted to Bradbury", note: "Transaction broadcast" },
  { key: "consensus", title: "Validators reading", note: "Leader proposes, validators rerun" },
  { key: "done", title: "Accepted", note: "Appeal window open" },
];

const ORDER: Record<string, number> = {
  idle: -1,
  signing: 0,
  submitted: 1,
  consensus: 2,
  done: 3,
  error: 99,
};

export default function TxStream({ stage }: { stage: TxStage }) {
  if (stage.phase === "idle") return null;
  const current = ORDER[stage.phase] ?? 0;
  const failed = stage.phase === "error";

  return (
    <div className="panel" style={{ marginTop: 22 }}>
      <div className="panel-head">
        <span className="label">{stage.label}</span>
        {"hash" in stage && stage.hash && (
          <a className="mono link-u dim" href={txUrl(stage.hash)} target="_blank" rel="noreferrer">
            View tx
          </a>
        )}
      </div>
      <div className="panel-body">
        <div className="stream">
          {STEPS.map((step, i) => {
            let state: string = "idle";
            if (failed && i <= 2) state = i === Math.min(current, 2) ? "error" : "done";
            else if (i < current) state = "done";
            else if (i === current) state = "active";
            return (
              <div className="stream-row" key={step.key} data-state={state}>
                {state === "active" ? (
                  <span className="pulse" />
                ) : (
                  <span
                    className="btn-dot"
                    style={{
                      background: state === "done" ? "var(--acid)" : "var(--line-strong)",
                      opacity: state === "error" ? 1 : undefined,
                    }}
                  />
                )}
                <span className="mono" style={{ textTransform: "none", letterSpacing: "0.04em" }}>
                  {step.title}
                </span>
                <span className="label">{step.note}</span>
              </div>
            );
          })}
        </div>

        {failed && (
          <p className="mono ember" style={{ textTransform: "none", marginBottom: 0, marginTop: 16 }}>
            {stage.message}
          </p>
        )}
      </div>
    </div>
  );
}
