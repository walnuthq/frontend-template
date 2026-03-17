import { useMemo, useEffect, useState, useCallback } from "react";
import { useAccount, useImportAccount } from "@miden-sdk/react";
import { Felt, Word } from "@miden-sdk/miden-sdk";
import { RPS_GAME_SLOT_NAME } from "@/config";

function storageKey(n: number): Word {
  return Word.newFromFelts([
    new Felt(0n),
    new Felt(0n),
    new Felt(0n),
    new Felt(BigInt(n)),
  ]);
}

function readFelt(account: ReturnType<typeof useAccount>["account"], key: number): number {
  if (!account) return 0;
  const word = account.storage().getMapItem(RPS_GAME_SLOT_NAME, storageKey(key));
  return word ? Number(word.toU64s()[3]) : 0;
}

function readWord(account: ReturnType<typeof useAccount>["account"], key: number): bigint[] {
  if (!account) return [0n, 0n, 0n, 0n];
  const word = account.storage().getMapItem(RPS_GAME_SLOT_NAME, storageKey(key));
  return word ? Array.from(word.toU64s()) : [0n, 0n, 0n, 0n];
}

const MOVE_NAMES: Record<number, string> = {
  1: "Rock",
  2: "Paper",
  3: "Scissors",
};

export function useRpsGame(gameAddress: string) {
  const { importAccount } = useImportAccount();
  const [importDone, setImportDone] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Import the game account first, before any queries
  useEffect(() => {
    if (!gameAddress) return;
    let cancelled = false;
    console.log(`[RPS] Importing game account: ${gameAddress}`);
    importAccount({ type: "id", accountId: gameAddress })
      .then(() => {
        if (!cancelled) {
          console.log(`[RPS] Game account imported successfully`);
          setImportDone(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          // "already imported" is fine
          if (msg.includes("already") || msg.includes("exists")) {
            console.log(`[RPS] Game account already imported`);
            setImportDone(true);
          } else {
            console.error(`[RPS] Game account import failed:`, msg);
            setImportError(msg);
          }
        }
      });
    return () => { cancelled = true; };
  }, [importAccount, gameAddress]);

  // Only query account after import succeeds
  const { account, refetch: rawRefetch, isLoading, error } = useAccount(
    importDone ? gameAddress : "",
  );

  const refetch = useCallback(() => {
    if (importDone) rawRefetch();
  }, [importDone, rawRefetch]);

  const gamePhase = useMemo(() => readFelt(account, 1), [account]);
  const player1 = useMemo(() => readWord(account, 2), [account]);
  const player2 = useMemo(() => readWord(account, 3), [account]);
  const player1Move = useMemo(() => readFelt(account, 6), [account]);
  const player2Move = useMemo(() => readFelt(account, 7), [account]);
  const winner = useMemo(() => readFelt(account, 8), [account]);

  return {
    gamePhase,
    player1,
    player2,
    player1Move,
    player1MoveName: MOVE_NAMES[player1Move] ?? "",
    player2Move,
    player2MoveName: MOVE_NAMES[player2Move] ?? "",
    winner,
    refetch,
    isLoading,
    error: importError || (error ? error.message : null),
  };
}
