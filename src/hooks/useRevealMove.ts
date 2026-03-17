import { useState, useCallback } from "react";
import { useSyncState } from "@miden-sdk/react";
import {
  useMidenFiWallet,
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
  Felt,
  FeltArray,
} from "@miden-sdk/miden-sdk";
import { randomWord } from "@/lib/miden";
import { NETWORK_SYNC_DELAY_MS } from "@/config";

const LOCALSTORAGE_KEY_PREFIX = "rps_move_";

export function useRevealMove(gameAddress: string, refetchGame: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  const { address: walletAddress, connected, requestTransaction } = useMidenFiWallet();
  const { sync } = useSyncState();

  const hasStoredMove = useCallback(() => {
    if (!walletAddress) return false;
    return localStorage.getItem(LOCALSTORAGE_KEY_PREFIX + walletAddress) !== null;
  }, [walletAddress]);

  const revealMove = useCallback(async () => {
    if (!walletAddress || !requestTransaction) return;

    const stored = localStorage.getItem(LOCALSTORAGE_KEY_PREFIX + walletAddress);
    if (!stored) {
      setError("No stored move found. Did you commit a move first?");
      return;
    }

    const { move, nonce } = JSON.parse(stored) as { move: number; nonce: number };

    const moveNames: Record<number, string> = { 1: "Rock", 2: "Paper", 3: "Scissors" };
    console.log(`[RPS] Revealing move: ${moveNames[move] ?? move}, nonce: ${nonce} (wallet: ${walletAddress})`);
    setError(null);
    setIsSubmitting(true);
    try {
      const buf = await fetch("/packages/rps_reveal_note.masp").then((r) =>
        r.arrayBuffer(),
      );
      const pkg = Package.deserialize(new Uint8Array(buf));
      const noteScript = NoteScript.fromPackage(pkg);

      const gameAccountId = AccountId.fromBech32(gameAddress);
      const walletAccountId = AccountId.fromBech32(walletAddress);

      const playerPrefix = walletAccountId.prefix();
      const playerSuffix = walletAccountId.suffix();

      // Note inputs: [prefix, suffix, move, nonce]
      const noteInputFelts = new FeltArray();
      noteInputFelts.push(playerPrefix);
      noteInputFelts.push(playerSuffix);
      noteInputFelts.push(new Felt(BigInt(move)));
      noteInputFelts.push(new Felt(BigInt(nonce)));

      const serialNum = randomWord();
      const inputs = new NoteInputs(noteInputFelts);
      const recipient = new NoteRecipient(serialNum, noteScript, inputs);

      const tag = NoteTag.withAccountTarget(gameAccountId);
      const attachment = NoteAttachment.newNetworkAccountTarget(
        gameAccountId,
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
        gameAddress,
        txRequest,
      );
      await requestTransaction(tx);
      console.log(`[RPS] Reveal submitted successfully`);
      setIsSubmitting(false);

      // Clean up stored move after successful reveal
      localStorage.removeItem(LOCALSTORAGE_KEY_PREFIX + walletAddress);

      setIsWaiting(true);
      console.log(`[RPS] Waiting for network to process reveal...`);
      await new Promise((r) => setTimeout(r, NETWORK_SYNC_DELAY_MS));
      await sync();
      refetchGame();
      console.log(`[RPS] Reveal confirmed`);
      setIsWaiting(false);
    } catch (err) {
      console.error(`[RPS] Reveal failed:`, err);
      setIsSubmitting(false);
      setIsWaiting(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [walletAddress, requestTransaction, gameAddress, sync, refetchGame]);

  return {
    revealMove,
    hasStoredMove,
    isSubmitting,
    isWaiting,
    error,
    walletConnected: connected,
  };
}
