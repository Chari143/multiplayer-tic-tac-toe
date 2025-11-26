import React from "react";
import { TttState } from "../lib/nakama";

const TrophyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
    <path d="M4 22h16"></path>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
  </svg>
);

interface GameOverScreenProps {
  state: TttState | null;
  getNames: () => { myName: string; oppName: string; mySymbol: any; oppSymbol: any };
  leaderboard: any[];
  onPlayAgain: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ state, getNames, leaderboard, onPlayAgain }) => {
  const { myName, oppName, mySymbol } = getNames();
  const isWinner = state?.winner === mySymbol;
  const isDraw = state?.winner === "draw";

  // Determine winner name
  const winnerName = isDraw ? null : (isWinner ? myName : oppName);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        {/* Result */}
        <div className="flex flex-col items-center justify-center space-y-6">
          {/* Winner Symbol */}
          <div className="text-[140px] font-black text-white leading-none">
            {state?.winner === "draw" ? "=" : state?.winner}
          </div>

          {/* Result Message */}
          <div className="flex flex-col items-center gap-2">
            {isDraw ? (
              <h1 className="text-5xl font-bold text-gray-400">DRAW!</h1>
            ) : (
              <>
                <h1 className="text-5xl font-bold text-teal-400">
                  {isWinner ? "YOU WIN!" : "YOU LOSE!"}
                </h1>
                <p className="text-2xl text-gray-400">
                  {winnerName} won the game
                </p>
              </>
            )}
          </div>
        </div>

        {/* Global Leaderboard (if available) */}
        {leaderboard.length > 0 && (
          <div className="space-y-4 mt-12">
            <div className="flex items-center gap-3 justify-center">
              <TrophyIcon />
              <h3 className="text-2xl font-bold text-teal-400">Top Players</h3>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <div className="space-y-2">
                {leaderboard.slice(0, 5).map((rec, i) => (
                  <div
                    key={rec.owner_id}
                    className="flex items-center justify-between px-4 py-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 text-gray-300">
                      <span className={`font-bold w-8 ${i < 3 ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {i + 1}.
                      </span>
                      <span className="truncate font-medium">{rec.username || "Unknown"}</span>
                    </div>
                    <div className="text-teal-400 font-bold text-lg">
                      {rec.score} {rec.score === 1 ? 'win' : 'wins'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Play Again Button */}
        <div className="pt-8">
          <button
            onClick={onPlayAgain}
            className="w-full max-w-xs mx-auto block bg-transparent border-2 border-gray-600 text-white py-4 px-8 rounded-lg font-medium hover:bg-gray-800 hover:border-teal-500 transition-all text-lg"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};
