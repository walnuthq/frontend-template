# RPS Game Frontend

React + TypeScript + Vite frontend for the Miden Rock-Paper-Scissors game. Connect your wallet, pick a move, and play against another player on-chain.

## Getting Started

```bash
yarn install
yarn dev
```

Open [http://localhost:5173](http://localhost:5173).

## Setup

Before playing, the game account must be deployed to testnet and its address configured:

1. Deploy the `rps-game-account` contract (see `project-template/README.md`)
2. Set the deployed address in `src/config.ts`:
   ```ts
   export const RPS_GAME_ADDRESS = "mtst1..."; // your deployed address
   ```
3. Ensure the `.masp` artifacts in `public/packages/` are up to date (pre-built artifacts are included)

## How to Play

### Prerequisites
- Install the [MidenFi wallet extension](https://midenfi.com) in your browser
- Have a wallet with a testnet account

### Game Flow

1. **Connect wallet** -- Click "Connect Wallet" in the top bar
2. **Pick your move** -- Click Rock, Paper, or Scissors. This commits a hashed move to the game account (your actual choice stays hidden)
3. **Wait for opponent** -- The second player connects and picks their move
4. **Reveal** -- Once both players have committed, click "Reveal Move". This sends your original move + nonce so the contract can verify the hash
5. **See the result** -- After both reveals, the winner is displayed along with both players' moves

### Two-Player Setup

Since this is a two-player game, you need two separate browser profiles (or browsers), each with its own MidenFi wallet:

1. Open the app in **Browser A**, connect wallet, pick a move
2. Open the app in **Browser B**, connect a different wallet, pick a move
3. Both players click "Reveal Move" when prompted
4. Both browsers show the result

The move + nonce are stored in `localStorage` per wallet address, so each browser remembers what to reveal.

## Project Structure

```
src/
├── App.tsx                              # Root component
├── providers.tsx                        # MidenProvider + wallet adapter
├── config.ts                            # Game address, slot names, SDK config
├── components/
│   ├── AppContent.tsx                   # Page layout, logos, wallet button
│   ├── Counter.tsx                      # Counter demo UI
│   ├── RpsGame.tsx                      # Main RPS game view (state machine)
│   ├── RpsGame.css                      # RPS game styles
│   ├── MoveSelector.tsx                 # Rock/Paper/Scissors button group
│   └── GameStatus.tsx                   # Phase indicator + result display
├── hooks/
│   ├── useIncrementCounter.ts           # Counter demo hook
│   ├── useRpsGame.ts                    # Read game state from account storage
│   ├── useCommitMove.ts                 # Commit phase: hash move, build note, submit
│   └── useRevealMove.ts                 # Reveal phase: send move+nonce, submit
└── lib/
    └── miden.ts                         # Shared utilities (randomWord)
```

## Hooks

### `useRpsGame(gameAddress)`

Reads the game account's `StorageMap` to get the current game state.

Returns: `gamePhase`, `player1`, `player2`, `player1Move`, `player1MoveName`, `player2Move`, `player2MoveName`, `winner`, `refetch`, `isLoading`, `error`

### `useCommitMove(gameAddress, refetchGame)`

Handles the commit phase:
1. Generates a random nonce
2. Computes `RPO_hash(move, nonce)` using the WASM SDK
3. Stores `{move, nonce}` in localStorage for the reveal phase
4. Builds a commit note with inputs `[prefix, suffix, h0, h1, h2, h3]`
5. Submits via the wallet adapter

Returns: `commitMove(moveNumber)`, `isSubmitting`, `isWaiting`, `error`, `walletConnected`

### `useRevealMove(gameAddress, refetchGame)`

Handles the reveal phase:
1. Reads the stored `{move, nonce}` from localStorage
2. Builds a reveal note with inputs `[prefix, suffix, move, nonce]`
3. Submits via the wallet adapter
4. Cleans up localStorage after successful reveal

Returns: `revealMove()`, `hasStoredMove()`, `isSubmitting`, `isWaiting`, `error`, `walletConnected`

## Game Phases

| Phase | UI State | Actions Available |
|-------|----------|-------------------|
| 0 -- Empty | "Waiting for players" | Pick a move (commit) |
| 1 -- One commit | "One player committed" | Pick a move (second player) |
| 2 -- Two commits | "Both committed -- reveal!" | Reveal button |
| 3 -- One reveal | "Waiting for opponent's reveal" | Reveal button (other player) |
| 4 -- Complete | Shows winner + moves | Refresh game |

## Contract Artifacts

Pre-compiled `.masp` packages are loaded at runtime from `public/packages/`:

```
public/packages/
├── rps_game_account.masp        # Game account component
├── rps_commit_note.masp         # Commit note script
├── rps_reveal_note.masp         # Reveal note script
├── counter_account.masp         # Counter demo (template)
└── increment_note.masp          # Increment demo (template)
```

To rebuild artifacts after contract changes:

```bash
cd ../project-template
cargo miden build --manifest-path contracts/rps-game-account/Cargo.toml --release
cargo miden build --manifest-path contracts/rps-commit-note/Cargo.toml --release
cargo miden build --manifest-path contracts/rps-reveal-note/Cargo.toml --release

# Copy to frontend
cp contracts/rps-game-account/target/miden/release/rps_game_account.masp ../frontend-template/public/packages/
cp contracts/rps-commit-note/target/miden/release/rps_commit_note.masp ../frontend-template/public/packages/
cp contracts/rps-reveal-note/target/miden/release/rps_reveal_note.masp ../frontend-template/public/packages/
```

## Testing

```bash
yarn test              # Run all tests once
yarn test:watch        # Watch mode
yarn test:coverage     # With coverage
```

Tests mock the Miden SDK hooks and verify component rendering across all game phases.

## Configuration

```ts
// src/config.ts
export const RPS_GAME_ADDRESS = "";    // Set to deployed game account address
export const RPS_GAME_SLOT_NAME = "miden::component::miden_rps_game_account::game_map";
```

SDK settings via environment variables:

```bash
VITE_MIDEN_RPC_URL=testnet    # "testnet" | "localhost" | custom URL
VITE_MIDEN_PROVER=testnet     # "testnet" | "local"
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@miden-sdk/react` | React hooks (useAccount, useSyncState, useImportAccount) |
| `@miden-sdk/miden-sdk` | Core types (Note, Rpo256, AccountId, Word, Felt) |
| `@miden-sdk/vite-plugin` | WASM loading, COOP/COEP headers |
| `@miden-sdk/miden-wallet-adapter` | MidenFi wallet integration |
