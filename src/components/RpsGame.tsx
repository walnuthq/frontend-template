import { useCallback, useEffect, useRef, useState } from "react";
import { useSyncState } from "@miden-sdk/react";
import { useRpsGame } from "@/hooks/useRpsGame";
import { useCommitMove } from "@/hooks/useCommitMove";
import { useRevealMove } from "@/hooks/useRevealMove";
import { RPS_GAME_ADDRESS, EXPLORER_BASE_URL } from "@/config";
import { MoveSelector } from "@/components/MoveSelector";
import { GameStatus } from "@/components/GameStatus";
import "./RpsGame.css";

export function RpsGame() {
  const { sync } = useSyncState();
  const {
    gamePhase,
    winner,
    player1MoveName,
    player2MoveName,
    refetch,
    error: gameError,
  } = useRpsGame(RPS_GAME_ADDRESS);

  const {
    commitMove,
    isSubmitting: isCommitting,
    isWaiting: isWaitingCommit,
    error: commitError,
    walletConnected,
  } = useCommitMove(RPS_GAME_ADDRESS, refetch);

  const {
    revealMove,
    hasStoredMove,
    isSubmitting: isRevealing,
    isWaiting: isWaitingReveal,
    error: revealError,
  } = useRevealMove(RPS_GAME_ADDRESS, refetch);

  console.log("[RPS] RpsGame component rendered, gamePhase:", gamePhase, "error:", gameError);

  // Log game state changes for debugging
  useEffect(() => {
    const phaseNames: Record<number, string> = {
      0: "Waiting for players",
      1: "One player committed",
      2: "Both committed — waiting for reveals",
      3: "One player revealed — waiting for opponent",
      4: "Game complete!",
    };
    const winnerNames: Record<number, string> = {
      0: "none",
      1: "Player 1",
      2: "Player 2",
      3: "Draw",
    };
    console.log(
      `[RPS] Game state: phase=${gamePhase} (${phaseNames[gamePhase] ?? "unknown"}), ` +
      `winner=${winnerNames[winner] ?? winner}, p1=${player1MoveName || "none"}, p2=${player2MoveName || "none"}`
    );
  }, [gamePhase, winner, player1MoveName, player2MoveName]);

  // Poll for game state updates while the game is in progress (not idle or complete)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (gamePhase < 4) {
      intervalRef.current = setInterval(async () => {
        await sync();
        refetch();
      }, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [gamePhase, sync, refetch]);

  const busy = isCommitting || isWaitingCommit || isRevealing || isWaitingReveal;
  const error = gameError || commitError || revealError;

  const showMoveSelector = gamePhase === 0 || gamePhase === 1;
  const showRevealButton = (gamePhase === 2 || gamePhase === 3) && hasStoredMove();
  const showPlayAgain = gamePhase === 4;

  return (
    <div className="rps-game card">
      <h2>Rock Paper Scissors</h2>

      <GameStatus
        gamePhase={gamePhase}
        winner={winner}
        player1MoveName={player1MoveName}
        player2MoveName={player2MoveName}
      />

      {showMoveSelector && (
        <MoveSelector
          onSelect={commitMove}
          disabled={busy || !walletConnected}
        />
      )}

      {showRevealButton && (
        <button
          className="reveal-button"
          onClick={revealMove}
          disabled={busy || !walletConnected}
        >
          {isRevealing
            ? "Revealing..."
            : isWaitingReveal
              ? "Waiting for network..."
              : "Reveal Move"}
        </button>
      )}

      {showPlayAgain && (
        <RefreshButton sync={sync} refetch={refetch} />
      )}

      {busy && (
        <p className="status-message">
          {isCommitting || isRevealing
            ? "Submitting transaction..."
            : "Waiting for network..."}
        </p>
      )}

      {error && <p className="error">{error}</p>}

      {RPS_GAME_ADDRESS && (
        <p>
          <a
            href={`${EXPLORER_BASE_URL}/account/${RPS_GAME_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="account-id"
          >
            Game: {RPS_GAME_ADDRESS}
          </a>
        </p>
      )}
    </div>
  );
}

function RefreshButton({ sync, refetch }: { sync: () => Promise<unknown>; refetch: () => void }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await sync();
      refetch();
    } finally {
      setRefreshing(false);
    }
  }, [sync, refetch]);

  return (
    <button
      className="play-again-button"
      onClick={handleRefresh}
      disabled={refreshing}
    >
      {refreshing ? "Syncing..." : "Refresh Game"}
    </button>
  );
}
