import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@miden-sdk/react", () => import("@/__tests__/mocks/miden-sdk-react"));
vi.mock("@miden-sdk/miden-wallet-adapter-react", () => ({
  useMidenFiWallet: vi.fn(() => ({
    address: null,
    connected: false,
    connecting: false,
    disconnecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));
vi.mock("@/components/Messenger", () => ({
  Messenger: () => <div data-testid="messenger">Messenger Mock</div>,
}));

import { useMiden, useSyncState } from "@miden-sdk/react";
import { useMidenFiWallet } from "@miden-sdk/miden-wallet-adapter-react";
import { AppContent } from "../AppContent";

describe("AppContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMiden).mockReturnValue({
      client: null,
      isReady: true,
      isInitializing: false,
      error: null,
      sync: vi.fn(),
      runExclusive: vi.fn(),
      prover: null,
      signerAccountId: null,
    });
    vi.mocked(useSyncState).mockReturnValue({
      syncHeight: 12345,
      isSyncing: false,
      lastSyncTime: Date.now(),
      error: null,
      sync: vi.fn(),
    });
    vi.mocked(useMidenFiWallet).mockReturnValue({
      address: null,
      connected: false,
      connecting: false,
      disconnecting: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as never);
  });

  it("renders main content when Miden is ready", () => {
    render(<AppContent />);

    expect(screen.getByText("Connect Wallet")).toBeInTheDocument();
    expect(screen.getByTestId("messenger")).toBeInTheDocument();
  });

  it("shows connect affordance before signer-backed client initialization", () => {
    vi.mocked(useMiden).mockReturnValue({
      client: null,
      isReady: false,
      isInitializing: false,
      error: null,
      sync: vi.fn(),
      runExclusive: vi.fn(),
      prover: null,
      signerAccountId: null,
    });

    render(<AppContent />);

    expect(screen.getByText("Connect Wallet")).toBeInTheDocument();
    expect(
      screen.getByText("Connect your wallet to initialize Miden client."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Initializing Miden client...")).not.toBeInTheDocument();
  });

  it("shows an explicit connecting state instead of the pre-connect prompt", () => {
    vi.mocked(useMiden).mockReturnValue({
      client: null,
      isReady: false,
      isInitializing: false,
      error: null,
      sync: vi.fn(),
      runExclusive: vi.fn(),
      prover: null,
      signerAccountId: null,
    });
    vi.mocked(useMidenFiWallet).mockReturnValue({
      address: null,
      connected: false,
      connecting: true,
      disconnecting: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as never);

    render(<AppContent />);

    expect(screen.getByRole("button", { name: "Connecting..." })).toBeDisabled();
    expect(screen.getByText("Connecting wallet...")).toBeInTheDocument();
    expect(
      screen.queryByText("Connect your wallet to initialize Miden client."),
    ).not.toBeInTheDocument();
  });

  it("shows sync height from testnet", () => {
    vi.mocked(useMidenFiWallet).mockReturnValue({
      address: "mtst1sender123_qruqqypuyph",
      connected: true,
      connecting: false,
      disconnecting: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as never);
    render(<AppContent />);
    expect(screen.getByText(/Testnet block: 12345/)).toBeInTheDocument();
  });

  it("shows syncing indicator when syncHeight is null", () => {
    vi.mocked(useMidenFiWallet).mockReturnValue({
      address: "mtst1sender123_qruqqypuyph",
      connected: true,
      connecting: false,
      disconnecting: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as never);
    vi.mocked(useSyncState).mockReturnValue({
      syncHeight: null as unknown as number,
      isSyncing: true,
      lastSyncTime: null,
      error: null,
      sync: vi.fn(),
    });

    render(<AppContent />);
    expect(screen.getByText(/syncing\.\.\./)).toBeInTheDocument();
  });

  it("shows loading message during initialization", () => {
    vi.mocked(useMidenFiWallet).mockReturnValue({
      address: "mtst1sender123_qruqqypuyph",
      connected: true,
      connecting: false,
      disconnecting: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as never);
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
    expect(screen.queryByTestId("messenger")).not.toBeInTheDocument();
  });

  it("shows error message on initialization failure", () => {
    vi.mocked(useMidenFiWallet).mockReturnValue({
      address: "mtst1sender123_qruqqypuyph",
      connected: true,
      connecting: false,
      disconnecting: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as never);
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
