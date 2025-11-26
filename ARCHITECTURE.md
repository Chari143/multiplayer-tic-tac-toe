# Multiplayer Tic-Tac-Toe Architecture Documentation

## Overview

This project implements a multiplayer tic-tac-toe game using:
- **Frontend**: Next.js (React) - runs in the browser
- **Backend**: Nakama server - runs in Docker

Both folders are **essential** and cannot be merged because they run in completely different environments.

---

## Project Structure

```
multiplayer-tic-tac-toe/
├── frontend/                # Browser application (Next.js)
│   ├── app/
│   │   ├── page.tsx        # Main game UI component
│   │   └── globals.css     # Styling
│   ├── lib/
│   │   └── nakama.ts       # Nakama client utilities
│   └── package.json        # Frontend dependencies
│
├── backend/                 # Server application (Nakama)
│   ├── build/
│   │   └── index.js        # Game logic (runs on server!)
│   ├── docker-compose.yml  # Starts Nakama + Database
│   ├── nakama-config.yml   # Nakama configuration
│   └── package.json        # Backend build tools
│
└── assessment.md            # Project requirements
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         BROWSER                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Frontend (Next.js)                                  │  │
│  │  - app/page.tsx: UI components                       │  │
│  │  - lib/nakama.ts: Nakama client connection           │  │
│  │                                                       │  │
│  │  Responsibilities:                                    │  │
│  │  ✓ Display game board                                │  │
│  │  ✓ Send player moves to server                       │  │
│  │  ✓ Receive game state updates                        │  │
│  │  ✓ Show connection/lobby/game views                  │  │
│  └─────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│                      WebSocket                              │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                    DOCKER CONTAINER                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Nakama Server                                       │  │
│  │                                                       │  │
│  │  Loads: build/index.js                               │  │
│  │                                                       │  │
│  │  Responsibilities:                                    │  │
│  │  ✓ Validate all moves                                │  │
│  │  ✓ Maintain authoritative game state                 │  │
│  │  ✓ Detect win conditions                             │  │
│  │  ✓ Handle matchmaking                                │  │
│  │  ✓ Broadcast state to all players                    │  │
│  └─────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  CockroachDB                                         │  │
│  │  - Stores user data                                  │  │
│  │  - Stores match data                                 │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend Code Explanation

### File: `backend/build/index.js`

This JavaScript file runs **inside the Nakama server** (not in Node.js, not in the browser).

#### Main Functions:

##### 1. `matchInit(ctx, logger, nk, params)`
**When**: Called when a new match is created
**Purpose**: Initialize the game state

```javascript
function matchInit(ctx, logger, nk, params) {
    var mode = "classic";  // or "timed"
    
    // Create initial state
    var state = {
        presences: {},      // Connected players
        players: {},        // userId -> "X" or "O"
        board: ["","","","","","","","",""],  // Empty board
        next: null,         // Who's turn? (null until 2 players)
        winner: null,       // null, "X", "O", or "draw"
        started: false,     // Has game started?
        mode: mode,         // "classic" or "timed"
        turnDeadline: null  // For timed mode
    };
    
    return { state: state, tickRate: 1, label: "ttt:" + mode };
}
```

**Key Points**:
- Creates empty 3x3 board
- Game doesn't start until 2 players join
- Returns initial state and tick rate (1 = runs every second)

---

##### 2. `matchJoin(ctx, logger, nk, dispatcher, tick, state, presences)`
**When**: Called when a player joins the match
**Purpose**: Assign player symbols (X or O) and start game when ready

```javascript
function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
    for (var i = 0; i < presences.length; i++) {
        var p = presences[i];
        state.presences[p.sessionId] = p;
        
        // Assign symbol if player doesn't have one
        if (!state.players[p.userId]) {
            // First player gets X, second gets O
            var assigned = Object.keys(state.players).length === 0 ? "X" : "O";
            state.players[p.userId] = assigned;
            logger.info("Player joined: userId=%s, assigned=%s", p.userId, assigned);
        }
    }
    
    var count = Object.keys(state.players).length;
    
    // Start game when 2 players are connected
    if (count === 2 && !state.started) {
        state.started = true;
        state.next = "X";  // X always goes first
        
        if (state.mode === "timed") {
            state.turnDeadline = Date.now() + 30000;  // 30 seconds
        }
        
        logger.info("Game started with players: %s", JSON.stringify(state.players));
        
        // Broadcast initial state to both players
        dispatcher.broadcastMessage(2, encodeState(state), null, null);
    }
    
    return { state: state };
}
```

**Key Points**:
- First player → X, second player → O
- Game starts when count === 2
- X always goes first
- Broadcasts initial state to both players

---

##### 3. `matchLoop(ctx, logger, nk, dispatcher, tick, state, messages)`
**When**: Called every second (tick rate) and when messages arrive
**Purpose**: Process player moves and update game state

```javascript
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
    // Handle timed mode - auto-forfeit if time expires
    if (state.mode === "timed" && state.turnDeadline && !state.winner) {
        if (Date.now() > state.turnDeadline) {
            // Current player ran out of time, opponent wins
            state.winner = state.next === "X" ? "O" : "X";
            state.next = null;
            dispatcher.broadcastMessage(2, encodeState(state), null, null);
        }
    }
    
    // Process each move message
    for (var i = 0; i < messages.length; i++) {
        var m = messages[i];
        
        // Only process OpCode.Move (value = 1)
        if (m.op_code !== 1) {
            continue;
        }
        
        // Get player's symbol (X or O)
        var userId = m.sender.userId;
        var playerSymbol = state.players[userId];
        
        logger.info("Move attempt: userId=%s, playerSymbol=%s, state.next=%s", 
                    userId, playerSymbol, state.next);
        
        // Verify player is in the match
        if (!playerSymbol) {
            logger.warn("Player not found in match: userId=%s", userId);
            dispatcher.broadcastMessage(3, JSON.stringify({ error: "not_in_match" }), 
                                       [m.sender], null);
            continue;
        }
        
        // Verify it's player's turn
        if (state.next !== playerSymbol) {
            logger.warn("Wrong turn: userId=%s has symbol=%s but state.next=%s", 
                       userId, playerSymbol, state.next);
            dispatcher.broadcastMessage(3, JSON.stringify({ error: "not_your_turn" }), 
                                       [m.sender], null);
            continue;
        }
        
        // Parse the move data
        var cell = void 0;
        try {
            // CRITICAL: Use Nakama's helper to decode binary data
            var dataString = nk.binaryToString(m.data);
            var payload = JSON.parse(dataString);
            cell = Number(payload.cell);
            
            logger.info("Parsed move: payload=%s, cell=%d, isInteger=%s", 
                       dataString, cell, Number.isInteger(cell));
        }
        catch (e) {
            logger.error("Failed to parse payload: %s | data type: %s", e, typeof m.data);
            dispatcher.broadcastMessage(3, JSON.stringify({ error: "bad_payload" }), 
                                       [m.sender], null);
            continue;
        }
        
        // Validate cell number (0-8)
        if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
            logger.warn("Invalid cell: cell=%s, isInteger=%s", cell, Number.isInteger(cell));
            dispatcher.broadcastMessage(3, JSON.stringify({ error: "bad_cell" }), 
                                       [m.sender], null);
            continue;
        }
        
        // Verify cell is empty
        if (state.board[cell] !== "") {
            dispatcher.broadcastMessage(3, JSON.stringify({ error: "cell_occupied" }), 
                                       [m.sender], null);
            continue;
        }
        
        // ALL VALIDATIONS PASSED - Apply the move!
        state.board[cell] = playerSymbol;
        
        // Check for win/draw
        var win = checkWin(state.board);
        if (win) {
            state.winner = win === "draw" ? "draw" : win;
            state.next = null;
        }
        else {
            // Switch turns
            state.next = playerSymbol === "X" ? "O" : "X";
            
            // Reset timer for timed mode
            if (state.mode === "timed") {
                state.turnDeadline = Date.now() + 30000;
            }
        }
        
        // Broadcast updated state to ALL players
        dispatcher.broadcastMessage(2, encodeState(state), null, null);
    }
    
    return { state: state };
}
```

**Key Points**:
- Processes every move message (OpCode = 1)
- Validates: player exists, correct turn, valid cell, cell empty
- **BUG FIX**: Uses `nk.binaryToString()` to decode message data
- Updates board and checks for winner
- Switches turns automatically
- Broadcasts state to all players

---

##### 4. `checkWin(board)`
**Purpose**: Detect if someone won or if it's a draw

```javascript
function checkWin(board) {
    // All possible winning combinations
    var lines = [
        [0, 1, 2],  // Top row
        [3, 4, 5],  // Middle row
        [6, 7, 8],  // Bottom row
        [0, 3, 6],  // Left column
        [1, 4, 7],  // Middle column
        [2, 5, 8],  // Right column
        [0, 4, 8],  // Diagonal \
        [2, 4, 6]   // Diagonal /
    ];
    
    // Check each winning combination
    for (var i = 0; i < lines.length; i++) {
        var [a, b, c] = lines[i];
        
        // If all three cells match and aren't empty
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];  // Return "X" or "O"
        }
    }
    
    // Check for draw (board full, no winner)
    if (board.every(function (v) { return v !== ""; })) {
        return "draw";
    }
    
    // Game continues
    return null;
}
```

---

##### 5. `rpcCreateOrJoinMatch(ctx, logger, nk, payload)`
**When**: Called by frontend when player clicks "Create/Join Classic/Timed"
**Purpose**: Find an available match or create a new one

```javascript
function rpcCreateOrJoinMatch(ctx, logger, nk, payload) {
    var mode = "classic";
    
    try {
        var p = JSON.parse(payload || "{}");
        if (p.mode === "timed")
            mode = "timed";
    }
    catch (e) { }
    
    var label = "ttt:" + mode;
    
    // Search for available matches (0-1 players, not full)
    var matches = nk.matchList(10, true, label, 0, 1);
    
    var matchId;
    if (matches && matches.length > 0) {
        // Join existing match
        matchId = matches[0].matchId;
    }
    else {
        // Create new match
        matchId = nk.matchCreate("ttt", { mode: mode });
    }
    
    return JSON.stringify({ matchId: matchId });
}
```

**Key Points**:
- **BUG FIX**: Only searches for matches with 0-1 players (not full)
- Creates new match if none available
- Returns match ID for frontend to join

---

## Frontend Code Explanation

### File: `frontend/app/page.tsx`

Main UI component that runs in the browser.

#### Key State Variables:

```typescript
const [view, setView] = useState<View>("connect");  // Current view
const [session, setSession] = useState<Session | null>(null);  // Nakama session
const socketRef = useRef<Socket | null>(null);  // WebSocket connection
const [matchId, setMatchId] = useState<string | null>(null);  // Current match
const [state, setState] = useState<TttState | null>(null);  // Game state from server
```

#### Socket Handlers:

```typescript
const attachSocketHandlers = (sock: Socket) => {
    // Receive game state updates
    sock.onmatchdata = (result) => {
        const op = result.op_code;
        const text = new TextDecoder().decode(result.data);
        
        if (op === OpCode.State) {  // OpCode 2 = state update
            const s = JSON.parse(text) as TttState;
            setState(s);  // Update React state
        } else if (op === OpCode.Error) {  // OpCode 3 = error
            setLastError(text);
        }
    };
    
    // Handle disconnection
    sock.ondisconnect = () => {
        setLastError("Disconnected");
        setView("connect");
        setSession(null);
        setMatchId(null);
        setState(null);
        socketRef.current = null;
    };
};
```

#### Sending Moves:

```typescript
const sendMove = async (cell: number) => {
    if (!socketRef.current || !matchId) return;
    
    // Encode move as JSON
    const bytes = new TextEncoder().encode(JSON.stringify({ cell }));
    
    // Send to server (OpCode.Move = 1)
    await socketRef.current.sendMatchState(matchId, OpCode.Move, bytes);
};
```

---

### File: `frontend/lib/nakama.ts`

Utility functions for Nakama client.

```typescript
// Create Nakama client
export const createClient = () => {
    return new Client("defaultkey", 
                     process.env.NEXT_PUBLIC_NAKAMA_HOST || "127.0.0.1", 
                     "7350");
};

// Authenticate with device ID
export const authenticateDevice = async (client: Client, deviceId: string) => {
    return await client.authenticateDevice(deviceId, true, deviceId);
};

// Connect WebSocket
export const connectSocket = async (client: Client, session: Session) => {
    return await client.createSocket(false);  // false = no auto-reconnect
    await socket.connect(session);
    return socket;
};

// Call RPC to create/join match
export const createOrJoinTttMatch = async (
    client: Client, 
    session: Session, 
    mode: "classic" | "timed"
) => {
    const response = await client.rpc(session, "createOrJoinTttMatch", 
                                     JSON.stringify({ mode }));
    const data = JSON.parse(response.payload);
    return data.matchId;
};
```

---

## Message Flow

### 1. Player Clicks Cell

```
Browser                           Nakama Server
  │                                     │
  │  sendMove(cellIndex)               │
  │  ─────────────────────────>        │
  │  OpCode: 1 (Move)                  │
  │  Data: {"cell": 0}                 │
  │                                     │
  │                              matchLoop()
  │                              ├─ Validate move
  │                              ├─ Update board
  │                              ├─ Check win
  │                              └─ Broadcast state
  │                                     │
  │  <─────────────────────────        │
  │  OpCode: 2 (State)                 │
  │  Data: {board, next, winner...}    │
  │                                     │
  setState(newState)                    │
  Re-render UI                          │
```

### 2. Both Players See Update

```
Player 1                    Server                    Player 2
   │                          │                          │
   │  Move: cell 0           │                          │
   │  ──────────────────>    │                          │
   │                          │  Broadcast State        │
   │  <──────────────────    │  ──────────────────>    │
   │  Board: [X,,,,,,,,,]    │  Board: [X,,,,,,,,,]    │
```

---

## Why Separate Folders?

1. **Different runtimes**: Backend runs in Nakama (Docker), Frontend runs in browser
2. **Docker configuration**: `docker-compose.yml` needed to start Nakama
3. **Security**: Server validates all moves - can't trust the browser
4. **Scalability**: Multiple frontends can connect to one backend
5. **Deployment**: Backend and frontend deployed separately

---

## Running the Project

### Start Backend (Nakama Server)
```bash
cd backend
docker-compose up -d
```

Nakama loads `build/index.js` and starts listening on port 7350.

### Start Frontend (Next.js)
```bash
cd frontend
npm run dev
```

Browser app runs on `http://localhost:3000` and connects to Nakama via WebSocket.

---

## Summary

- **Backend folder**: Required for Nakama server + game logic
- **Frontend folder**: Required for browser UI
- **Cannot be merged**: They run in different environments
- **Communication**: WebSocket messages (OpCodes 1-3)
- **Architecture**: Server-authoritative (backend validates everything)
