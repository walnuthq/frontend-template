import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@miden-sdk/react", () => import("@/__tests__/mocks/miden-sdk-react"));
vi.mock("@miden-sdk/miden-wallet-adapter", () => ({
  WalletMultiButton: () => <button>Connect Wallet</button>,
}));
vi.mock("@/components/Auction", () => ({
  Auction: () => <div data-testid="auction">Auction Mock</div>,
}));

import { useMiden, useSyncState } from "@miden-sdk/react";
import { AppContent } from "../AppContent";

describe("AppContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders header with wordmark, sync status, and wallet button", () => {
    render(<AppContent />);

    expect(screen.getByText("Meridian Auctions")).toBeInTheDocument();
    expect(screen.getByText(/Block 12345/)).toBeInTheDocument();
    expect(screen.getByText("Connect Wallet")).toBeInTheDocument();
  });

  it("renders auction component and footer", () => {
    render(<AppContent />);

    expect(screen.getByTestId("auction")).toBeInTheDocument();
    expect(screen.getByText("Powered by Miden")).toBeInTheDocument();
  });

  it("shows sync indicator when syncHeight is null", () => {
    vi.mocked(useSyncState).mockReturnValue({
      syncHeight: null as unknown as number,
      isSyncing: true,
      lastSyncTime: null,
      error: null,
      sync: vi.fn(),
    });

    render(<AppContent />);
    expect(screen.getByText(/Block \.\.\./)).toBeInTheDocument();
  });

  it("shows loading spinner during initialization", () => {
    vi.mocked(useMiden).mockReturnValue({
      client: null,
      isReady: false,
      isInitializing: true,
      error: null,
      sync: vi.fn(),
      runExclusive: vi.fn(),
      prover: null,
      signerAccountId: null,
    });

    render(<AppContent />);
    expect(
      screen.getByText("Initializing Miden client..."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Meridian Auctions")).not.toBeInTheDocument();
  });

  it("shows error message on initialization failure", () => {
    vi.mocked(useMiden).mockReturnValue({
      client: null,
      isReady: false,
      isInitializing: false,
      error: new Error("WASM failed to load"),
      sync: vi.fn(),
      runExclusive: vi.fn(),
      prover: null,
      signerAccountId: null,
    });

    render(<AppContent />);
    expect(
      screen.getByText("Failed to initialize Miden client"),
    ).toBeInTheDocument();
    expect(screen.getByText("WASM failed to load")).toBeInTheDocument();
  });
});
