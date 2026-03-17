interface MoveSelectorProps {
  onSelect: (move: number) => void;
  disabled: boolean;
}

const MOVES = [
  { value: 1, label: "Rock", emoji: "\u{1FAA8}" },
  { value: 2, label: "Paper", emoji: "\u{1F4C4}" },
  { value: 3, label: "Scissors", emoji: "\u2702\uFE0F" },
];

export function MoveSelector({ onSelect, disabled }: MoveSelectorProps) {
  return (
    <div className="move-selector" role="group" aria-label="Select your move">
      {MOVES.map((m) => (
        <button
          key={m.value}
          className="move-button"
          onClick={() => onSelect(m.value)}
          disabled={disabled}
          aria-label={m.label}
        >
          <span className="move-emoji">{m.emoji}</span>
          <span className="move-label">{m.label}</span>
        </button>
      ))}
    </div>
  );
}
