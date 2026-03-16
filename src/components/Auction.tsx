import { useState } from "react";
import { useAuction } from "@/hooks/useAuction";
import { AUCTION_ADDRESS, KNOWN_TOKENS } from "@/config";
import "./Auction.css";

export function Auction() {
  const {
    minBid,
    highestBid,
    isOpen,
    blocksRemaining,
    estimatedTimeRemaining,
    placeBid,
    finalize,
    isBidding,
    isFinalizing,
    isWaiting,
    bidSubmitted,
    error,
    walletConnected,
    explorerUrl,
  } = useAuction(AUCTION_ADDRESS);

  const [bidAmount, setBidAmount] = useState("");
  const [faucetAddress, setFaucetAddress] = useState("");

  const busy = isBidding || isFinalizing || isWaiting;

  const handlePlaceBid = () => {
    const amount = BigInt(bidAmount);
    placeBid(amount, faucetAddress);
  };

  const bidButtonLabel = isBidding
    ? "Submitting bid..."
    : isWaiting && !isFinalizing
      ? "Waiting for network..."
      : "Submit Sealed Bid";
  const finalizeButtonLabel = isFinalizing
    ? "Finalizing..."
    : isWaiting
      ? "Waiting for network..."
      : "Finalize Auction";

  if (!AUCTION_ADDRESS) {
    return (
      <div className="auction-wallet-prompt">
        No auction address configured. Set VITE_AUCTION_ADDRESS in .env
      </div>
    );
  }

  return (
    <div className="auction">
      {/* Hero */}
      <div className="auction-hero">
        <div className="auction-art-preview" />
        <h1 className="auction-title">Meridian #001</h1>
        <p className="auction-subtitle">Generative art — 1 of 1</p>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="auction-explorer-link"
          >
            View on explorer
          </a>
        )}
      </div>

      {/* Status bar */}
      <div className="auction-status-bar">
        <div className="status-item">
          <span className="status-label">Status</span>
          <span className="status-value">
            {isOpen ? (
              <span className="badge badge-live">Live</span>
            ) : (
              <span className="badge badge-closed">Closed</span>
            )}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Time remaining</span>
          <span className="status-value">
            {estimatedTimeRemaining ?? "..."}
          </span>
          {blocksRemaining !== null && (
            <span className="status-detail">
              {blocksRemaining} block{blocksRemaining !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="status-item">
          <span className="status-label">Minimum bid</span>
          <span className="status-value">{minBid ?? "..."}</span>
        </div>
      </div>

      {/* Error */}
      {error && <div className="auction-error">{error}</div>}

      {/* Leading bid */}
      <div className="auction-leading-bid">
        <p className="leading-bid-label">Leading bid</p>
        {highestBid !== null && highestBid > 0 ? (
          <p className="leading-bid-amount">{highestBid}</p>
        ) : (
          <p className="leading-bid-empty">No bids yet</p>
        )}
      </div>

      {/* Thank-you screen after successful bid */}
      {isOpen && walletConnected && bidSubmitted && (
        <div className="auction-bid-confirmed">
          <p className="bid-confirmed-title">Thank you for your bid!</p>
          <p className="bid-confirmed-detail">
            Your bid has been submitted to the network. It will appear on the
            board within a couple of minutes once the transaction is processed.
          </p>
        </div>
      )}

      {/* Bid form */}
      {isOpen && walletConnected && !bidSubmitted && (
        <div className="auction-bid-form">
          <div className="bid-field">
            <label htmlFor="faucet-address">Token</label>
            <select
              id="faucet-address"
              value={faucetAddress}
              onChange={(e) => setFaucetAddress(e.target.value)}
              disabled={busy}
            >
              <option value="">Select a token</option>
              {KNOWN_TOKENS.filter((t) => t.address).map((token) => (
                <option key={token.label} value={token.address}>
                  {token.label}
                </option>
              ))}
            </select>
            <p className="field-hint">
              Choose the token you are bidding with
            </p>
          </div>
          <div className="bid-field">
            <label htmlFor="bid-amount">Bid amount</label>
            <input
              id="bid-amount"
              type="number"
              placeholder="Enter amount"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              disabled={busy}
              min={minBid ?? 0}
            />
            <p className="field-hint">
              {minBid !== null
                ? `Minimum bid: ${minBid} tokens`
                : "Enter the number of tokens to bid"}
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={handlePlaceBid}
            disabled={busy || !bidAmount || !faucetAddress}
          >
            {bidButtonLabel}
          </button>
        </div>
      )}

      {/* Wallet prompt when open but not connected */}
      {isOpen && !walletConnected && (
        <p className="auction-wallet-prompt">
          Connect your wallet to place a bid.
        </p>
      )}

      {/* Finalize */}
      {!isOpen && highestBid !== null && highestBid > 0 && (
        <div className="auction-finalize">
          <p>
            The auction has ended. Finalize to settle the winning bid and
            transfer the asset to the highest bidder.
          </p>
          <button
            className="btn-secondary"
            onClick={finalize}
            disabled={busy || !walletConnected}
          >
            {finalizeButtonLabel}
          </button>
        </div>
      )}
    </div>
  );
}
