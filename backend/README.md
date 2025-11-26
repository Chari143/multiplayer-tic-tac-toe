# Backend - Multiplayer Tic-Tac-Toe

This folder contains the Nakama server backend for the multiplayer tic-tac-toe game.

## Structure

```
backend/
├── src/
│   └── index.ts          # TypeScript source (edit this!)
├── build/
│   └── index.js          # Compiled JavaScript (auto-generated)
├── types/
│   └── nakama.d.ts       # Nakama runtime type definitions
├── docker-compose.yml    # Starts Nakama + Database
├── nakama-config.yml     # Nakama server configuration
├── tsconfig.json         # TypeScript compiler config
└── package.json          # Build scripts
```

## Development Workflow

### 1. Edit Source Code

Edit the TypeScript file:
```bash
# Edit this file for changes
src/index.ts
```

### 2. Compile

Run the build command:
```bash
npm run build
```

This compiles `src/index.ts` → `build/index.js`

### 3. Restart Nakama

Restart the server to load the new code:
```bash
docker-compose restart nakama
```

## Running the Backend

### First Time Setup

```bash
# Start Nakama and CockroachDB
docker-compose up -d
```

Nakama will be available at:
- **API**: `localhost:7350`
- **Console**: `localhost:7351` (username: `admin`, password: `password`)

### Stopping

```bash
docker-compose down
```

### Viewing Logs

```bash
# Follow logs in real-time
docker-compose logs -f nakama

# View last 100 lines
docker-compose logs --tail=100 nakama
```

## Key Features

### Server-Authoritative Game Logic

All game logic runs on the server - the frontend can't cheat!

- ✅ Move validation (correct turn, valid cell, cell empty)
- ✅ Win condition detection
- ✅ Turn management
- ✅ Player assignment (X/O)

### Game Modes

- **Classic**: Standard tic-tac-toe
- **Timed**: 30-second turn timer

### Bug Fixes Included

This code includes critical bug fixes:

1. **Payload decoding**: Uses `nk.binaryToString()` instead of `TextDecoder`
2. **Match joining**: Only joins non-full matches (0-1 players)
3. **Cell validation**: Properly handles cell 0 with `Number.isInteger()`

## Code Explanation

### Main Functions

#### `matchInit()`
Creates a new match with empty board and initial state.

#### `matchJoin()`
- Assigns X or O to joining players
- Starts game when 2 players connected

#### `matchLoop()`
- Validates and processes moves
- Updates game state
- Broadcasts to all players

#### `checkWin()`
- Detects winning combinations
- Detects draws

#### `rpcCreateOrJoinMatch()`
- Finds available matches
- Creates new match if none available

## TypeScript Types

Custom Nakama runtime types are in `types/nakama.d.ts`. These provide:
- Type safety for all Nakama API calls
- Autocomplete in your IDE
- Compile-time error checking

## Troubleshooting

### Build fails with type errors

Make sure `types/nakama.d.ts` exists and `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "typeRoots": ["./types"]
  }
}
```

### Changes not applied

After editing `src/index.ts`, you must:
1. Run `npm run build`
2. Run `docker-compose restart nakama`

### Nakama won't start

Check Docker is running:
```bash
docker ps
```

Check logs for errors:
```bash
docker-compose logs nakama
```

## Production Deployment

Build the code:
```bash
npm run build
```

Deploy the `build/` folder, `docker-compose.yml`, and `nakama-config.yml` to your server.

Start with:
```bash
docker-compose up -d
```

---

**The backend is now in TypeScript! 🎉**

Edit `src/index.ts` → Build → Restart → Test
