import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@miden-sdk/react", () => ({
  useSyncState: vi.fn(() => ({ sync: vi.fn() })),
}));
vi.mock("@/hooks/useRpsGame", () => ({
  useRpsGame: vi.fn(),
}));
vi.mock("@/hooks/useCommitMove", () => ({
  useCommitMove: vi.fn(),
}));
vi.mock("@/hooks/useRevealMove", () => ({
  useRevealMove: vi.fn(),
}));

import { useRpsGame } from "@/hooks/useRpsGame";
import { useCommitMove } from "@/hooks/useCommitMove";
import { useRevealMove } from "@/hooks/useRevealMove";
import { RpsGame } from "../RpsGame";

const defaultGameReturn = {
  gamePhase: 0,
  player1: [0n, 0n, 0n, 0n],
  player2: [0n, 0n, 0n, 0n],
  player1Move: 0,
  player1MoveName: "",
  player2Move: 0,
  player2MoveName: "",
  winner: 0,
  refetch: vi.fn(),
  isLoading: false,
  error: null,
};

const defaultCommitReturn = {
  commitMove: vi.fn(),
  isSubmitting: false,
  isWaiting: false,
  error: null,
  walletConnected: true,
};

const defaultRevealReturn = {
  revealMove: vi.fn(),
  hasStoredMove: vi.fn(() => false),
  isSubmitting: false,
  isWaiting: false,
  error: null,
  walletConnected: true,
};

describe("RpsGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRpsGame).mockReturnValue(defaultGameReturn);
    vi.mocked(useCommitMove).mockReturnValue(defaultCommitReturn);
    vi.mocked(useRevealMove).mockReturnValue(defaultRevealReturn);
  });

  it("shows move selector in phase 0", () => {
    render(<RpsGame />);
    expect(screen.getByText("Waiting for players")).toBeInTheDocument();
    expect(screen.getByLabelText("Rock")).toBeInTheDocument();
    expect(screen.getByLabelText("Paper")).toBeInTheDocument();
    expect(screen.getByLabelText("Scissors")).toBeInTheDocument();
  });

  it("shows move selector in phase 1", () => {
    vi.mocked(useRpsGame).mockReturnValue({
      ...defaultGameReturn,
      gamePhase: 1,
    });
    render(<RpsGame />);
    expect(
      screen.getByText("One player committed — waiting for opponent"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Rock")).toBeInTheDocument();
  });

  it("calls commitMove when a move is selected", async () => {
    const mockCommit = vi.fn();
    vi.mocked(useCommitMove).mockReturnValue({
      ...defaultCommitReturn,
      commitMove: mockCommit,
    });

    render(<RpsGame />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Rock"));
    expect(mockCommit).toHaveBeenCalledWith(1);
  });

  it("shows reveal button in phase 2 when move is stored", () => {
    vi.mocked(useRpsGame).mockReturnValue({
      ...defaultGameReturn,
      gamePhase: 2,
    });
    vi.mocked(useRevealMove).mockReturnValue({
      ...defaultRevealReturn,
      hasStoredMove: vi.fn(() => true),
    });

    render(<RpsGame />);
    expect(
      screen.getByText("Both committed — time to reveal!"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reveal Move" }),
    ).toBeInTheDocument();
  });

  it("does not show reveal button when no stored move", () => {
    vi.mocked(useRpsGame).mockReturnValue({
      ...defaultGameReturn,
      gamePhase: 2,
    });

    render(<RpsGame />);
    expect(screen.queryByText("Reveal Move")).not.toBeInTheDocument();
  });

  it("calls revealMove when reveal button is clicked", async () => {
    const mockReveal = vi.fn();
    vi.mocked(useRpsGame).mockReturnValue({
      ...defaultGameReturn,
      gamePhase: 2,
    });
    vi.mocked(useRevealMove).mockReturnValue({
      ...defaultRevealReturn,
      revealMove: mockReveal,
      hasStoredMove: vi.fn(() => true),
    });

    render(<RpsGame />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Reveal Move" }));
    expect(mockReveal).toHaveBeenCalledOnce();
  });

  it("shows game result in phase 4", () => {
    vi.mocked(useRpsGame).mockReturnValue({
      ...defaultGameReturn,
      gamePhase: 4,
      winner: 1,
      player1Move: 1,
      player1MoveName: "Rock",
      player2Move: 3,
      player2MoveName: "Scissors",
    });

    render(<RpsGame />);
    expect(screen.getByText("Game complete!")).toBeInTheDocument();
    expect(screen.getByText("Player 1 wins!")).toBeInTheDocument();
    expect(
      screen.getByText("Player 1: Rock vs Player 2: Scissors"),
    ).toBeInTheDocument();
  });

  it("shows draw result", () => {
    vi.mocked(useRpsGame).mockReturnValue({
      ...defaultGameReturn,
      gamePhase: 4,
      winner: 3,
      player1Move: 1,
      player1MoveName: "Rock",
      player2Move: 1,
      player2MoveName: "Rock",
    });

    render(<RpsGame />);
    expect(screen.getByText("It's a draw!")).toBeInTheDocument();
  });

  it("disables move selector when wallet not connected", () => {
    vi.mocked(useCommitMove).mockReturnValue({
      ...defaultCommitReturn,
      walletConnected: false,
    });

    render(<RpsGame />);
    expect(screen.getByLabelText("Rock")).toBeDisabled();
  });

  it("shows submitting status", () => {
    vi.mocked(useCommitMove).mockReturnValue({
      ...defaultCommitReturn,
      isSubmitting: true,
    });

    render(<RpsGame />);
    expect(screen.getByText("Submitting transaction...")).toBeInTheDocument();
  });

  it("displays error message", () => {
    vi.mocked(useCommitMove).mockReturnValue({
      ...defaultCommitReturn,
      error: "Transaction failed",
    });

    render(<RpsGame />);
    expect(screen.getByText("Transaction failed")).toBeInTheDocument();
  });
});
