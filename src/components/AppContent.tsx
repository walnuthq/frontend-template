import { useMiden, useSyncState } from "@miden-sdk/react";
import { WalletMultiButton } from "@miden-sdk/miden-wallet-adapter";
import { Auction } from "@/components/Auction";
import "./AppContent.css";

export function AppContent() {
  const { isReady, isInitializing, error } = useMiden();
  const { syncHeight } = useSyncState();

  if (error) {
    return (
      <div className="loading">
        <p>Failed to initialize Miden client</p>
        <p className="error">{error.message}</p>
      </div>
    );
  }

  if (isInitializing || !isReady) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <p>Initializing Miden client...</p>
      </div>
    );
  }

  return (
    <>
      <header className="app-header">
        <span className="app-wordmark">Meridian Auctions</span>
        <div className="app-header-right">
          <span className="sync-status">
            <span className="sync-dot" />
            Block {syncHeight ?? "..."}
          </span>
          <WalletMultiButton />
        </div>
      </header>
      <main className="app-main">
        <Auction />
      </main>
      <footer className="app-footer">Powered by Miden</footer>
    </>
  );
}
