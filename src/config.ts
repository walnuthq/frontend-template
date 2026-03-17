// Network counter account deployed on Miden testnet
export const COUNTER_ADDRESS = "mtst1aru8adnrqspgcsr3drk2n990lyc070ll";

// StorageMap slot name for the counter
export const COUNTER_SLOT_NAME =
  "miden::component::miden_counter_account::count_map";

// Block explorer base URL
export const EXPLORER_BASE_URL = "https://testnet.midenscan.com";

// Delay (ms) to wait for the network to process a note before re-syncing
export const NETWORK_SYNC_DELAY_MS = 10_000;

// RPS Game account deployed on Miden testnet
export const RPS_GAME_ADDRESS = "mtst1ar9y0hq0nenl2sr578kxmj00ugql6c2y";
export const RPS_GAME_SLOT_NAME =
  "miden::component::miden_rps_game_account::game_map";

// Application display name (used by wallet adapter)
export const APP_NAME = "Miden Template";

// Miden SDK configuration — override via environment variables
export const MIDEN_RPC_URL =
  import.meta.env.VITE_MIDEN_RPC_URL ?? "testnet";
export const MIDEN_PROVER =
  (import.meta.env.VITE_MIDEN_PROVER as "testnet" | "local") ?? "testnet";

// Log SDK config at startup so we can verify it's pointing to the right node
console.log(`[Config] RPC URL: ${MIDEN_RPC_URL}, Prover: ${MIDEN_PROVER}`);

