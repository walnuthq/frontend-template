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
  Rpo256,
} from "@miden-sdk/miden-sdk";
import { randomWord } from "@/lib/miden";
import { NETWORK_SYNC_DELAY_MS } from "@/config";

const LOCALSTORAGE_KEY_PREFIX = "rps_move_";

export function useCommitMove(gameAddress: string, refetchGame: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  const { address: walletAddress, connected, requestTransaction } = useMidenFiWallet();
  const { sync } = useSyncState();

  const commitMove = useCallback(
    async (move: number) => {
      if (!walletAddress || !requestTransaction) return;
      setError(null);
      setIsSubmitting(true);
      const moveNames: Record<number, string> = { 1: "Rock", 2: "Paper", 3: "Scissors" };
      console.log(`[RPS] Committing move: ${moveNames[move] ?? move} (wallet: ${walletAddress})`);
      try {
        // Generate random nonce and store move+nonce for reveal phase
        const nonce = Math.floor(Math.random() * 2 ** 32);
        localStorage.setItem(
          LOCALSTORAGE_KEY_PREFIX + walletAddress,
          JSON.stringify({ move, nonce }),
        );

        // Load commit note package
        const buf = await fetch("/packages/rps_commit_note.masp").then((r) =>
          r.arrayBuffer(),
        );
        const pkg = Package.deserialize(new Uint8Array(buf));
        const noteScript = NoteScript.fromPackage(pkg);

        const gameAccountId = AccountId.fromBech32(gameAddress);
        const walletAccountId = AccountId.fromBech32(walletAddress);

        // Get player ID prefix/suffix
        const playerPrefix = walletAccountId.prefix();
        const playerSuffix = walletAccountId.suffix();

        // Compute commitment hash: RPO hash of [move, nonce]
        const hashInput = new FeltArray();
        hashInput.push(new Felt(BigInt(move)));
        hashInput.push(new Felt(BigInt(nonce)));
        const commitment = Rpo256.hashElements(hashInput);
        const commitmentFelts = commitment.toFelts();

        // Build note inputs: [prefix, suffix, h0, h1, h2, h3]
        const noteInputFelts = new FeltArray();
        noteInputFelts.push(playerPrefix);
        noteInputFelts.push(playerSuffix);
        noteInputFelts.push(commitmentFelts[0]);
        noteInputFelts.push(commitmentFelts[1]);
        noteInputFelts.push(commitmentFelts[2]);
        noteInputFelts.push(commitmentFelts[3]);

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
        console.log(`[RPS] Commit submitted successfully`);
        setIsSubmitting(false);

        setIsWaiting(true);
        console.log(`[RPS] Waiting for network to process commit...`);
        await new Promise((r) => setTimeout(r, NETWORK_SYNC_DELAY_MS));
        await sync();
        refetchGame();
        console.log(`[RPS] Commit confirmed`);
        setIsWaiting(false);
      } catch (err) {
        console.error(`[RPS] Commit failed:`, err);
        setIsSubmitting(false);
        setIsWaiting(false);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [walletAddress, requestTransaction, gameAddress, sync, refetchGame],
  );

  return {
    commitMove,
    isSubmitting,
    isWaiting,
    error,
    walletConnected: connected,
  };
}
