import { useState, useCallback, useRef, useEffect } from "react";
import { useMidenFiWallet } from "@miden-sdk/miden-wallet-adapter";

export function WalletButton() {
  const { address, connected, connect, disconnect, connecting } =
    useMidenFiWallet();
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLUListElement>(null);

  const shortAddress = address
    ? `${address.slice(0, 10)}...${address.slice(-4)}`
    : "";

  const copyAddress = useCallback(async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 400);
    }
  }, [address]);

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      setActive(false);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, []);

  if (!connected) {
    return (
      <button
        className="wallet-adapter-button wallet-adapter-button-trigger"
        onClick={() => connect()}
        disabled={connecting}
      >
        {connecting ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="wallet-adapter-dropdown">
      <button
        className="wallet-adapter-button wallet-adapter-button-trigger"
        onClick={() => setActive((a) => !a)}
        style={{ backgroundColor: "#fff", border: "1px solid #D7D7D7", color: "black" }}
      >
        {shortAddress}
      </button>
      {active && (
        <ul
          ref={ref}
          className="wallet-adapter-dropdown-list wallet-adapter-dropdown-list-active"
          role="menu"
        >
          <li
            onClick={copyAddress}
            className="wallet-adapter-dropdown-list-item"
            role="menuitem"
          >
            {copied ? "Copied" : "Copy address"}
          </li>
          <li
            onClick={() => { disconnect(); setActive(false); }}
            className="wallet-adapter-dropdown-list-item"
            role="menuitem"
          >
            Disconnect
          </li>
        </ul>
      )}
    </div>
  );
}
