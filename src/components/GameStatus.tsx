interface GameStatusProps {
  gamePhase: number;
  winner: number;
  player1MoveName: string;
  player2MoveName: string;
}

const PHASE_LABELS: Record<number, string> = {
  0: "Waiting for players",
  1: "One player committed — waiting for opponent",
  2: "Both committed — time to reveal!",
  3: "One player revealed — waiting for opponent",
  4: "Game complete!",
};

const WINNER_LABELS: Record<number, string> = {
  1: "Player 1 wins!",
  2: "Player 2 wins!",
  3: "It's a draw!",
};

export function GameStatus({
  gamePhase,
  winner,
  player1MoveName,
  player2MoveName,
}: GameStatusProps) {
  return (
    <div className="game-status">
      <p className="phase-label">
        {PHASE_LABELS[gamePhase] ?? `Phase: ${gamePhase}`}
      </p>
      {gamePhase === 4 && (
        <div className="game-result">
          <p className="winner-label">{WINNER_LABELS[winner] ?? ""}</p>
          <p className="moves-display">
            Player 1: {player1MoveName} vs Player 2: {player2MoveName}
          </p>
        </div>
      )}
    </div>
  );
}
