import { useMemo, useState, useCallback, useEffect } from "react";
import {
  useSyncState,
  useAccount,
  useImportAccount,
} from "@miden-sdk/react";
import {
  useWallet,
  Transaction,
} from "@miden-sdk/miden-wallet-adapter";
import {
  TransactionRequestBuilder,
  Package,
  NoteScript,
  Note,
  NoteAssets,
  NoteMetadata,
  NoteRecipient,
  NoteInputs,
  NoteTag,
  NoteType,
  NoteAttachment,
  NoteExecutionHint,
  OutputNote,
  OutputNoteArray,
  AccountId,
  FeltArray,
  FungibleAsset,
} from "@miden-sdk/miden-sdk";
import { randomWord } from "@/lib/miden";
import {
  AUCTION_CONFIG_SLOT,
  AUCTION_HIGHEST_BID_SLOT,
  BLOCK_TIME_SECONDS,
  EXPLORER_BASE_URL,
  NETWORK_SYNC_DELAY_MS,
} from "@/config";

export interface AuctionState {
  deadlineBlock: number | null;
  minBid: number | null;
  highestBid: number | null;
  currentBlock: number | null;
  isOpen: boolean;
  blocksRemaining: number | null;
  estimatedTimeRemaining: string | null;
}

export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Ended";
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `~${h}h ${m}m`;
  }
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `~${m}m ${s}s`;
  }
  return `~${seconds}s`;
}

export function useAuction(auctionAddress: string) {
  const [error, setError] = useState<string | null>(null);
  const [isBidding, setIsBidding] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [bidSubmitted, setBidSubmitted] = useState(false);

  const { address: walletAddress, connected, requestTransaction } = useWallet();
  const { importAccount } = useImportAccount();
  const { account, refetch } = useAccount(auctionAddress);
  const { syncHeight, sync } = useSyncState();

  // Import the auction account so the local client tracks it
  useEffect(() => {
    if (auctionAddress) {
      importAccount({ type: "id", accountId: auctionAddress }).catch(() => {});
    }
  }, [importAccount, auctionAddress]);

  // Read auction state from storage
  const auctionState = useMemo<AuctionState>(() => {
    if (!account) {
      return {
        deadlineBlock: null,
        minBid: null,
        highestBid: null,
        currentBlock: syncHeight ?? null,
        isOpen: false,
        blocksRemaining: null,
        estimatedTimeRemaining: null,
      };
    }

    const configVal = account.storage().getItem(AUCTION_CONFIG_SLOT);
    const bidVal = account.storage().getItem(AUCTION_HIGHEST_BID_SLOT);

    const deadlineBlock = configVal ? Number(configVal.toU64s()[2]) : null;
    const minBid = configVal ? Number(configVal.toU64s()[3]) : null;
    const highestBid = bidVal ? Number(bidVal.toU64s()[0]) : null;
    const currentBlock = syncHeight ?? null;

    const isOpen =
      deadlineBlock !== null &&
      currentBlock !== null &&
      currentBlock < deadlineBlock;

    const blocksRemaining =
      deadlineBlock !== null && currentBlock !== null
        ? Math.max(0, deadlineBlock - currentBlock)
        : null;

    const estimatedTimeRemaining =
      blocksRemaining !== null
        ? formatTimeRemaining(blocksRemaining * BLOCK_TIME_SECONDS)
        : null;

    return { deadlineBlock, minBid, highestBid, currentBlock, isOpen, blocksRemaining, estimatedTimeRemaining };
  }, [account, syncHeight]);

  const placeBid = useCallback(
    async (amount: bigint, faucetAddress: string) => {
      if (!walletAddress || !requestTransaction || !auctionAddress) return;
      setError(null);
      setIsBidding(true);
      try {
        // Load pre-compiled bid-note package
        const buf = await fetch("/packages/bid_note.masp").then((r) =>
          r.arrayBuffer(),
        );
        const pkg = Package.deserialize(new Uint8Array(buf));
        const noteScript = NoteScript.fromPackage(pkg);

        const auctionAccountId = AccountId.fromBech32(auctionAddress);
        const walletAccountId = AccountId.fromBech32(walletAddress);
        const faucetId = AccountId.fromBech32(faucetAddress);

        // Build note with bid asset
        const serialNum = randomWord();
        const serialFelts = new FeltArray();
        for (let i = 0; i < 4; i++) {
          serialFelts.push(serialNum.toFelts()[i]);
        }
        const inputs = new NoteInputs(serialFelts);
        const recipient = new NoteRecipient(serialNum, noteScript, inputs);

        const tag = NoteTag.withAccountTarget(auctionAccountId);
        const attachment = NoteAttachment.newNetworkAccountTarget(
          auctionAccountId,
          NoteExecutionHint.always(),
        );
        const metadata = new NoteMetadata(
          walletAccountId,
          NoteType.Public,
          tag,
        ).withAttachment(attachment);

        const asset = new FungibleAsset(faucetId, amount);
        const noteAssets = new NoteAssets([asset]);

        const note = new Note(noteAssets, metadata, recipient);
        const outputNote = OutputNote.full(note);
        const txRequest = new TransactionRequestBuilder()
          .withOwnOutputNotes(new OutputNoteArray([outputNote]))
          .build();

        const tx = Transaction.createCustomTransaction(
          walletAddress,
          auctionAddress,
          txRequest,
        );
        await requestTransaction(tx);
        setIsBidding(false);

        setIsWaiting(true);
        await new Promise((r) => setTimeout(r, NETWORK_SYNC_DELAY_MS));
        await sync();
        await refetch();
        setIsWaiting(false);
        setBidSubmitted(true);
      } catch (err) {
        setIsBidding(false);
        setIsWaiting(false);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [walletAddress, requestTransaction, auctionAddress, sync, refetch],
  );

  const finalize = useCallback(async () => {
    if (!walletAddress || !requestTransaction || !auctionAddress) return;
    setError(null);
    setIsFinalizing(true);
    try {
      // Load pre-compiled finalize-note package
      const buf = await fetch("/packages/finalize_note.masp").then((r) =>
        r.arrayBuffer(),
      );
      const pkg = Package.deserialize(new Uint8Array(buf));
      const noteScript = NoteScript.fromPackage(pkg);

      const auctionAccountId = AccountId.fromBech32(auctionAddress);
      const walletAccountId = AccountId.fromBech32(walletAddress);

      const serialNum = randomWord();
      const serialFelts = new FeltArray();
      for (let i = 0; i < 4; i++) {
        serialFelts.push(serialNum.toFelts()[i]);
      }
      const inputs = new NoteInputs(serialFelts);
      const recipient = new NoteRecipient(serialNum, noteScript, inputs);

      const tag = NoteTag.withAccountTarget(auctionAccountId);
      const attachment = NoteAttachment.newNetworkAccountTarget(
        auctionAccountId,
        NoteExecutionHint.always(),
      );
      const metadata = new NoteMetadata(
        walletAccountId,
        NoteType.Public,
        tag,
      ).withAttachment(attachment);

      const note = new Note(new NoteAssets(), metadata, recipient);
      const outputNote = OutputNote.full(note);
      const txRequest = new TransactionRequestBuilder()
        .withOwnOutputNotes(new OutputNoteArray([outputNote]))
        .build();

      const tx = Transaction.createCustomTransaction(
        walletAddress,
        auctionAddress,
        txRequest,
      );
      await requestTransaction(tx);
      setIsFinalizing(false);

      setIsWaiting(true);
      await new Promise((r) => setTimeout(r, NETWORK_SYNC_DELAY_MS));
      await sync();
      await refetch();
      setIsWaiting(false);
    } catch (err) {
      setIsFinalizing(false);
      setIsWaiting(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [walletAddress, requestTransaction, auctionAddress, sync, refetch]);

  return {
    ...auctionState,
    placeBid,
    finalize,
    isBidding,
    isFinalizing,
    isWaiting,
    bidSubmitted,
    error,
    walletConnected: connected,
    explorerUrl: auctionAddress
      ? `${EXPLORER_BASE_URL}/account/${auctionAddress}`
      : null,
  };
}
