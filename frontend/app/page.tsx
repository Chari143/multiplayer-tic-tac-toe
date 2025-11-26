"use client";
import { useGame } from "../hooks/useGame";
import { EntryScreen } from "../components/EntryScreen";
import { MatchingScreen } from "../components/MatchingScreen";
import { GameScreen } from "../components/GameScreen";
import { GameOverScreen } from "../components/GameOverScreen";

export default function Home() {
  const {
    username,
    setUsername,
    view,
    state,
    lastError,
    leaderboard,
    connectAndMatch,
    cancelMatchmaking,
    leaveMatch,
    sendMove,
    playAgain,
    getNames,
  } = useGame();

  if (view === "entry") {
    return (
      <EntryScreen
        username={username}
        setUsername={setUsername}
        onConnect={connectAndMatch}
        error={lastError}
      />
    );
  }

  if (view === "matching") {
    return <MatchingScreen onCancel={cancelMatchmaking} />;
  }

  if (view === "playing") {
    return (
      <GameScreen
        state={state}
        getNames={getNames}
        onMove={sendMove}
        onLeave={leaveMatch}
      />
    );
  }

  if (view === "gameOver") {
    return (
      <GameOverScreen
        state={state}
        getNames={getNames}
        leaderboard={leaderboard}
        onPlayAgain={playAgain}
      />
    );
  }

  return null;
}
