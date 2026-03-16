import { useMiden, useSyncState } from "@miden-sdk/react";
import { useMidenFiWallet } from "@miden-sdk/miden-wallet-adapter-react";
import { Messenger } from "@/components/Messenger";
import { shortAddress } from "@/lib/messenger";
import "./AppContent.css";

export function AppContent() {
  const { isReady, isInitializing, error } = useMiden();
  const { syncHeight } = useSyncState();
  const { address, connected, connecting, disconnecting, connect, disconnect } =
    useMidenFiWallet();
  const isWaitingForConnectedClient = connected && (isInitializing || !isReady);

  if (error) {
    return (
      <div className="loading">
        <p>Failed to initialize Miden client</p>
        <p className="error">{error.message}</p>
      </div>
    );
  }

  if (isWaitingForConnectedClient) {
    return <div className="loading">Initializing Miden client...</div>;
  }

  const waitingMessage = connecting
    ? "Connecting wallet..."
    : "Connect your wallet to initialize Miden client.";

  return (
    <div className="app-frame">
      <div className="wallet-section">
        <button
          type="button"
          onClick={() => void (connected ? disconnect() : connect())}
          disabled={connecting || disconnecting}
        >
          {connecting
            ? "Connecting..."
            : disconnecting
              ? "Disconnecting..."
              : connected
                ? `Disconnect ${shortAddress(address ?? "")}`
                : "Connect Wallet"}
        </button>
      </div>
      {isReady ? (
        <>
          <Messenger />
          <p className="read-the-docs">Testnet block: {syncHeight ?? "syncing..."}</p>
        </>
      ) : (
        <div className="loading">{waitingMessage}</div>
      )}
    </div>
  );
}
