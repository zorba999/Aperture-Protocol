import Link from "next/link";
import { CONTRACT_ADDRESS, addressUrl, truncate, FAUCET } from "@/lib/genlayer";

export default function Footer() {
  return (
    <footer className="footer shell">
      <div className="grid12" style={{ marginBottom: 56 }}>
        <div style={{ gridColumn: "span 5" }} className="stack">
          <span className="label" style={{ marginBottom: 16 }}>
            The contract is the counterparty
          </span>
          <p className="lede" style={{ margin: 0 }}>
            Describe the use in your own words. Validators classify it against the creator prose
            rate card, independently, and the price falls out of a table nobody can quietly edit.
          </p>
        </div>

        <div style={{ gridColumn: "span 3" }} className="stack">
          <span className="label" style={{ marginBottom: 16 }}>
            Protocol
          </span>
          <Link href="/archive" className="link-u" style={{ marginBottom: 8, width: "fit-content" }}>
            Archive
          </Link>
          <Link href="/vault" className="link-u" style={{ marginBottom: 8, width: "fit-content" }}>
            Vault
          </Link>
          <Link href="/patrol" className="link-u" style={{ width: "fit-content" }}>
            Patrol
          </Link>
        </div>

        <div style={{ gridColumn: "span 4" }} className="stack">
          <span className="label" style={{ marginBottom: 16 }}>
            Deployment
          </span>
          <span className="mono dim" style={{ textTransform: "none", marginBottom: 8 }}>
            Testnet Bradbury / chain 4221
          </span>
          {CONTRACT_ADDRESS && (
            <a
              className="mono link-u"
              style={{ textTransform: "none", marginBottom: 8, width: "fit-content" }}
              href={addressUrl(CONTRACT_ADDRESS)}
              target="_blank"
              rel="noreferrer"
            >
              {truncate(CONTRACT_ADDRESS, 10, 8)}
            </a>
          )}
          <a
            className="mono link-u"
            style={{ textTransform: "none", width: "fit-content" }}
            href={FAUCET}
            target="_blank"
            rel="noreferrer"
          >
            Faucet
          </a>
        </div>
      </div>

      <h2 className="footer-word">APERTURE</h2>

      <div className="spread" style={{ marginTop: 28 }}>
        <span className="label">Built on GenLayer intelligent contracts</span>
        <span className="label">Testnet only. Not legal advice.</span>
      </div>
    </footer>
  );
}
