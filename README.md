# Multiplayer Tic-Tac-Toe with Nakama

A production-ready, server-authoritative multiplayer Tic-Tac-Toe game built with **Next.js** (Frontend) and **Nakama** (Backend).

## 📋 Deliverables Checklist

- ✅ **Source Code**: Complete repository with frontend and backend.
- ✅ **Server-Authoritative**: Game logic, validation, and state management run entirely on Nakama.
- ✅ **Matchmaking**: Automatic pairing with fallback to RPC creation.
- ✅ **Leaderboard**: Global wins tracking.
- ✅ **Game Modes**: Classic and Timed (30s) modes.
- ✅ **Deployment Ready**: Dockerized backend and optimized Next.js frontend.

---

## 🚀 Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Node.js](https://nodejs.org/) (v18+)

### 1. Start the Backend (Nakama)
The backend runs in a Docker container along with CockroachDB.

```bash
cd backend
docker-compose up -d
```
- **Nakama Console**: [http://localhost:7351](http://localhost:7351) (User: `admin`, Pass: `password`)
- **API Endpoint**: `localhost:7350`

### 2. Start the Frontend (Next.js)
The frontend connects to the local Nakama instance.

```bash
cd frontend
npm install
npm run dev
```
- **Game URL**: [http://localhost:3000](http://localhost:3000)

---

## 🏗 Architecture

The project follows a **Server-Authoritative** architecture to prevent cheating and ensure consistent state.

### High-Level Overview
```
[Browser Client] <---> [Nakama Server (Docker)] <---> [CockroachDB]
      |                        |
  (Next.js UI)            (Game Logic)
```

- **Frontend**: Handles UI, input, and state rendering. It sends *moves* (intent) to the server.
- **Backend**: Validates moves, updates state, checks win conditions, and broadcasts the *new state* to all clients.

For a deep dive, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 🧪 How to Test Multiplayer

1. **Start the Stack**: Ensure Backend and Frontend are running (see "Getting Started").
2. **Open Player 1**:
   - Go to `http://localhost:3000` in your browser.
   - Enter nickname "Player1" and select "Classic" mode.
   - Click "Continue". You will see "Finding a random player...".
3. **Open Player 2**:
   - Open a **New Incognito Window** (or a different browser).
   - Go to `http://localhost:3000`.
   - Enter nickname "Player2" and select "Classic" mode.
   - Click "Continue".
4. **Play**:
   - The game should start immediately.
   - Try making invalid moves (clicking occupied cells) - they will be rejected.
   - Play to win/draw and observe the result screen.
   - Click "Play Again" on both screens to rematch.

### Testing Timed Mode
1. Follow the steps above but select **"Timed (30s)"** mode for both players.
2. In the game, wait 30 seconds without moving.
3. The server will auto-forfeit the current player, and the other player will win.

---

## 🛠 Deployment Process

### Backend
1. **Build**: Run `npm run build` in `backend/` to compile TypeScript to JavaScript (`build/index.js`).
2. **Docker**: The `docker-compose.yml` mounts the `build/` folder.
3. **Cloud**: Deploy the `docker-compose.yml` and `nakama-config.yml` to any Docker-compatible host (AWS EC2, DigitalOcean Droplet, etc.).

### Frontend
1. **Build**: Run `npm run build` in `frontend/`.
2. **Deploy**: Push to [Vercel](https://vercel.com) or deploy the `.next` build output to any static hosting service.
3. **Env Vars**: Set `NEXT_PUBLIC_NAKAMA_HOST` to your production Nakama IP/Domain.

---

## ⚙️ API & Server Configuration

### Nakama Config (`backend/nakama-config.yml`)
- **Port**: `7350` (gRPC/HTTP API)
- **Runtime**: JavaScript (V8)
- **Database**: CockroachDB

### Matchmaking Properties
- **Query**: `*` (Matches anyone)
- **Min/Max Count**: 2
- **Properties**:
  - `mode`: `"classic"` or `"timed"` (Ensures players only match with same mode)

---

## 🌐 Deployment

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

### Quick Deployment Steps

#### Backend (Nakama + CockroachDB)
1. **Choose a cloud provider**: DigitalOcean, AWS, GCP, Azure
2. **Create a VM**: Ubuntu 22.04, 2GB RAM minimum
3. **Install Docker**: `curl -fsSL https://get.docker.com | sh`
4. **Clone and deploy**:
   ```bash
   git clone https://github.com/yourusername/multiplayer-tic-tac-toe.git
   cd multiplayer-tic-tac-toe/backend
   npm install && npm run build
   docker-compose up -d
   ```
5. **Configure firewall**: Allow port `7350`

#### Frontend (Vercel)
1. **Install Vercel CLI**: `npm install -g vercel`
2. **Set environment variables**:
   - `NEXT_PUBLIC_NAKAMA_SERVER`: `http://your-server-ip:7350`
   - `NEXT_PUBLIC_NAKAMA_KEY`: `defaultkey`
3. **Deploy**: `cd frontend && vercel --prod`

#### Test Your Deployment
- Open your Vercel URL in two browser tabs
- Enter different usernames and click "Continue"
- Players should match and game should start
- Test gameplay and "Play Again" functionality

---

## 📁 Project Structure

- **`frontend/`**: Next.js application.
  - `hooks/useGame.ts`: Core game logic hook.
  - `components/`: UI components.
  - `lib/nakama.ts`: Nakama client SDK setup.
- **`backend/`**: Nakama server resources.
  - `src/index.ts`: TypeScript game logic.
  - `build/index.js`: Compiled logic loaded by Nakama.
  - `docker-compose.yml`: Infrastructure definition.
