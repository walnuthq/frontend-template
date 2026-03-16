export const EXPLORER_BASE_URL = "https://testnet.midenscan.com";
export const APP_NAME = "Miden Messenger";
export const NETWORK_SYNC_DELAY_MS = 10_000;
export const MESSENGER_PACKAGE_PATH = "/packages/messenger_note.masp";
export const MESSENGER_TAG = 404;
export const CONTACTS_STORAGE_KEY = "miden-messenger.contacts";
export const SENT_MESSAGES_STORAGE_KEY = "miden-messenger.sent";
export const DEFAULT_NETWORK = "testnet";

// Miden SDK configuration — override via environment variables
export const MIDEN_RPC_URL =
  import.meta.env.VITE_MIDEN_RPC_URL ?? DEFAULT_NETWORK;
export const MIDEN_PROVER =
  (import.meta.env.VITE_MIDEN_PROVER as "testnet" | "local") ?? "testnet";
export const MIDEN_NOTE_TRANSPORT_URL =
  import.meta.env.VITE_MIDEN_NOTE_TRANSPORT_URL;
