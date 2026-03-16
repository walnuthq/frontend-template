import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/hooks/useAuction", () => ({
  useAuction: vi.fn(),
}));

vi.mock("@/config", () => ({
  AUCTION_ADDRESS: "mtst1testauction",
  KNOWN_TOKENS: [
    { label: "USDC", address: "mtst1faucetusdc" },
    { label: "BTC", address: "mtst1faucetbtc" },
  ],
}));

import { useAuction } from "@/hooks/useAuction";
import { Auction } from "../Auction";

const defaultHookReturn = {
  deadlineBlock: 100,
  minBid: 50,
  highestBid: 150,
  currentBlock: 80,
  isOpen: true,
  blocksRemaining: 20,
  estimatedTimeRemaining: "~1m 0s",
  placeBid: vi.fn(),
  finalize: vi.fn(),
  isBidding: false,
  isFinalizing: false,
  isWaiting: false,
  bidSubmitted: false,
  error: null,
  walletConnected: true,
  explorerUrl: "https://testnet.midenscan.com/account/mtst1testauction",
};

describe("Auction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuction).mockReturnValue(defaultHookReturn);
  });

  it("renders hero with title and subtitle", () => {
    render(<Auction />);
    expect(screen.getByText("Meridian #001")).toBeInTheDocument();
    expect(screen.getByText(/1 of 1/)).toBeInTheDocument();
  });

  it("shows Live badge when auction is open", () => {
    render(<Auction />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("shows Closed badge when auction ended", () => {
    vi.mocked(useAuction).mockReturnValue({
      ...defaultHookReturn,
      isOpen: false,
      blocksRemaining: 0,
      estimatedTimeRemaining: "Ended",
    });

    render(<Auction />);
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("displays time remaining and block count", () => {
    render(<Auction />);
    expect(screen.getByText("~1m 0s")).toBeInTheDocument();
    expect(screen.getByText("20 blocks")).toBeInTheDocument();
  });

  it("displays minimum bid and leading bid", () => {
    render(<Auction />);
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("shows 'No bids yet' when no bids", () => {
    vi.mocked(useAuction).mockReturnValue({
      ...defaultHookReturn,
      highestBid: 0,
    });

    render(<Auction />);
    expect(screen.getByText("No bids yet")).toBeInTheDocument();
  });

  it("shows bid form with labels when open and wallet connected", () => {
    render(<Auction />);
    expect(screen.getByLabelText("Token")).toBeInTheDocument();
    expect(screen.getByLabelText("Bid amount")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit Sealed Bid" }),
    ).toBeInTheDocument();
  });

  it("hides bid form when auction is closed", () => {
    vi.mocked(useAuction).mockReturnValue({
      ...defaultHookReturn,
      isOpen: false,
    });

    render(<Auction />);
    expect(screen.queryByLabelText("Bid amount")).not.toBeInTheDocument();
  });

  it("shows wallet prompt when open but not connected", () => {
    vi.mocked(useAuction).mockReturnValue({
      ...defaultHookReturn,
      walletConnected: false,
    });

    render(<Auction />);
    expect(
      screen.getByText("Connect your wallet to place a bid."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Bid amount")).not.toBeInTheDocument();
  });

  it("shows finalize section when auction is closed with bids", () => {
    vi.mocked(useAuction).mockReturnValue({
      ...defaultHookReturn,
      isOpen: false,
      highestBid: 150,
    });

    render(<Auction />);
    expect(
      screen.getByRole("button", { name: "Finalize Auction" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/auction has ended/i)).toBeInTheDocument();
  });

  it("shows submitting bid state", () => {
    vi.mocked(useAuction).mockReturnValue({
      ...defaultHookReturn,
      isBidding: true,
    });

    render(<Auction />);
    expect(
      screen.getByRole("button", { name: "Submitting bid..." }),
    ).toBeDisabled();
  });

  it("shows finalizing state", () => {
    vi.mocked(useAuction).mockReturnValue({
      ...defaultHookReturn,
      isOpen: false,
      isFinalizing: true,
    });

    render(<Auction />);
    expect(
      screen.getByRole("button", { name: "Finalizing..." }),
    ).toBeDisabled();
  });

  it("displays error banner", () => {
    vi.mocked(useAuction).mockReturnValue({
      ...defaultHookReturn,
      error: "Bid too low",
    });

    render(<Auction />);
    expect(screen.getByText("Bid too low")).toBeInTheDocument();
  });

  it("links to explorer", () => {
    render(<Auction />);
    const link = screen.getByRole("link", { name: "View on explorer" });
    expect(link).toHaveAttribute(
      "href",
      "https://testnet.midenscan.com/account/mtst1testauction",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("calls placeBid with correct amount", async () => {
    const mockPlaceBid = vi.fn();
    vi.mocked(useAuction).mockReturnValue({
      ...defaultHookReturn,
      placeBid: mockPlaceBid,
    });

    render(<Auction />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Token"), "mtst1faucetusdc");
    await user.type(screen.getByLabelText("Bid amount"), "200");
    await user.click(screen.getByRole("button", { name: "Submit Sealed Bid" }));

    expect(mockPlaceBid).toHaveBeenCalledWith(200n, "mtst1faucetusdc");
  });

  it("shows thank-you screen after bid is submitted", () => {
    vi.mocked(useAuction).mockReturnValue({
      ...defaultHookReturn,
      bidSubmitted: true,
    });

    render(<Auction />);
    expect(screen.getByText("Thank you for your bid!")).toBeInTheDocument();
    expect(screen.getByText(/appear on the board/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Bid amount")).not.toBeInTheDocument();
  });

  it("calls finalize on button click", async () => {
    const mockFinalize = vi.fn();
    vi.mocked(useAuction).mockReturnValue({
      ...defaultHookReturn,
      isOpen: false,
      highestBid: 150,
      finalize: mockFinalize,
    });

    render(<Auction />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Finalize Auction" }));

    expect(mockFinalize).toHaveBeenCalledOnce();
  });
});
