"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { truncate, FAUCET, CHAIN } from "@/lib/genlayer";

const LINKS = [
  { href: "/archive", label: "Archive" },
  { href: "/vault", label: "Vault" },
  { href: "/patrol", label: "Patrol" },
];

export default function Nav() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const { wallets, address, connect, disconnect, connecting, chainOk, switchChain, error } =
    useWallet();

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 220 && y > last);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (address) setOpen(false);
  }, [address]);

  return (
    <>
      <header className="nav" data-hidden={hidden ? "1" : "0"}>
        <Link href="/" className="nav-mark">
          <strong>Aperture</strong>
          <span className="label" style={{ letterSpacing: "0.24em" }}>
            Protocol
          </span>
        </Link>

        <nav className="nav-links mono">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link"
              data-active={pathname.startsWith(link.href) ? "1" : "0"}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="inline" style={{ gap: 10 }}>
          {address && !chainOk && (
            <button className="btn" data-variant="acid" onClick={switchChain}>
              Wrong network
            </button>
          )}
          {address ? (
            <button className="btn" onClick={disconnect} title="Disconnect">
              <span className="btn-dot" style={{ background: "var(--acid)" }} />
              {truncate(address, 6, 4)}
            </button>
          ) : (
            <button className="btn" data-variant="acid" onClick={() => setOpen(true)}>
              {connecting ? "Connecting" : "Connect"}
            </button>
          )}
        </div>
      </header>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <span className="label">Select a wallet</span>
              <button className="mono dim" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            {wallets.length === 0 ? (
              <div className="panel-body stack" style={{ gap: 14 }}>
                <p className="dim" style={{ margin: 0, fontSize: 14 }}>
                  No injected EVM wallet found in this browser. Install MetaMask, Rabby, Frame or
                  any EIP-6963 compatible wallet, then reload.
                </p>
                <a
                  className="btn"
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Get MetaMask
                </a>
              </div>
            ) : (
              <div className="stack">
                {wallets.map((wallet) => (
                  <button
                    key={wallet.uuid}
                    className="wallet-option"
                    onClick={() => connect(wallet.rdns)}
                  >
                    {wallet.icon ? (
                      <img src={wallet.icon} alt="" />
                    ) : (
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          background: "var(--ink-3)",
                        }}
                      />
                    )}
                    <span className="stack" style={{ gap: 2 }}>
                      <span>{wallet.name}</span>
                      <span className="label">{wallet.rdns}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="panel-body stack" style={{ gap: 10 }}>
              {error && (
                <p className="mono ember" style={{ margin: 0, textTransform: "none" }}>
                  {error}
                </p>
              )}
              <p className="label" style={{ lineHeight: 1.8 }}>
                Network {CHAIN.name} / chain {CHAIN.id}
                <br />
                Need GEN?{" "}
                <a className="link-u acid" href={FAUCET} target="_blank" rel="noreferrer">
                  open the faucet
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
