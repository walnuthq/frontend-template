// Auction account address (set after deployment)
export const AUCTION_ADDRESS = import.meta.env.VITE_AUCTION_ADDRESS ?? "";

// Auction storage slot names
export const AUCTION_CONFIG_SLOT =
  "miden::component::miden_auction_account::config";
export const AUCTION_HIGHEST_BID_SLOT =
  "miden::component::miden_auction_account::highest_bid";
export const AUCTION_TOKEN_FAUCET_SLOT =
  "miden::component::miden_auction_account::token_faucet";

// Known tokens available for bidding (label → bech32 faucet address)
export const KNOWN_TOKENS: { label: string; address: string }[] = [
  { label: "MIDEN", address: "mtst1aplwver5ts5wugzlchllt0es4snggxh2" },
  { label: "POL", address: "mtst1aqjyn0hn726xjgqhkqdfmdwntulc0qte" },
  { label: "BID", address: "mtst1apuq04eyurdljgr2cz72gywsk58kfsz7" },
];

// Approximate block time used for time-remaining estimates
export const BLOCK_TIME_SECONDS = 3;

// Block explorer base URL
export const EXPLORER_BASE_URL = "https://testnet.midenscan.com";

// Delay (ms) to wait for the network to process a note before re-syncing
export const NETWORK_SYNC_DELAY_MS = 10_000;

// Application display name (used by wallet adapter)
export const APP_NAME = "Meridian Auctions";

// Miden SDK configuration — override via environment variables
export const MIDEN_RPC_URL =
  import.meta.env.VITE_MIDEN_RPC_URL ?? "testnet";
export const MIDEN_PROVER =
  (import.meta.env.VITE_MIDEN_PROVER as "testnet" | "local") ?? "testnet";
