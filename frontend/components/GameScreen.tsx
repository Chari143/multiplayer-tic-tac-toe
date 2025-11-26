import React, { useEffect, useState } from "react";
import { TttState } from "../lib/nakama";

interface GameScreenProps {
  state: TttState | null;
  getNames: () => { myName: string; oppName: string; mySymbol: any; oppSymbol: any };
  onMove: (cell: number) => void;
  onLeave: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({ state, getNames, onMove, onLeave }) => {
  const { myName, oppName, mySymbol, oppSymbol } = getNames();
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(30);

  // Determine whose turn it is for highlighting
  const myTurnActive = state?.next === mySymbol;
  const oppTurnActive = state?.next === oppSymbol;

  // Timer effect for turn countdown
  useEffect(() => {
    if (state?.turnDeadline) {
      const interval = setInterval(() => {
        const left = Math.max(0, Math.floor((state.turnDeadline! - Date.now()) / 1000));
        setTurnTimeLeft(left);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state?.turnDeadline]);

  if (!state) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading game state...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col p-6">
      {/* Player Info */}
      <div className="flex justify-between items-start mb-12 max-w-md mx-auto w-full">
        {/* My Info */}
        <div className={`flex flex-col items-center space-y-1 ${myTurnActive ? "opacity-100" : "opacity-50"}`}>
          <span className={`text-lg font-bold ${myTurnActive ? "text-white" : "text-gray-400"}`}>
            {myName} ({mySymbol || "?"})
          </span>
          <span className="text-xs text-gray-500">You</span>
          <div className={`h-1 w-full rounded-full ${myTurnActive ? "bg-white" : "bg-transparent"}`}></div>
        </div>

        {/* Opponent Info */}
        <div className={`flex flex-col items-center space-y-1 ${oppTurnActive ? "opacity-100" : "opacity-50"}`}>
          <span className={`text-lg font-bold ${oppTurnActive ? "text-white" : "text-gray-400"}`}>
            {oppName} ({oppSymbol || "?"})
          </span>
          <span className="text-xs text-gray-500">Opponent</span>
          <div className={`h-1 w-full rounded-full ${oppTurnActive ? "bg-white" : "bg-transparent"}`}></div>
        </div>
      </div>

      {/* Turn Indicator */}
      <div className="flex items-center justify-center space-x-3 mb-8">
        <div className="text-3xl font-black text-white">
          {state?.next || "-"}
        </div>
        <span className="text-xl font-medium text-gray-300 uppercase tracking-wider">Turn</span>
      </div>

      {/* Game Board */}
      <div className="flex-1 flex items-center justify-center mb-8">
        <div className="grid grid-cols-3 gap-0 w-full max-w-xs aspect-square">
          {state?.board.map((cell, idx) => {
            // Calculate borders for grid lines
            const isRight = (idx + 1) % 3 !== 0;
            const isBottom = idx < 6;
            const borderClasses = `
              ${isRight ? 'border-r-2' : ''} 
              ${isBottom ? 'border-b-2' : ''} 
              border-gray-700
            `;

            const canPlay = myTurnActive && cell === "" && !state.winner;

            return (
              <button
                key={idx}
                onClick={() => canPlay && onMove(idx)}
                disabled={!canPlay}
                className={`
                  ${borderClasses}
                  aspect-square
                  flex items-center justify-center
                  text-5xl font-black text-white leading-none select-none focus:outline-none focus:ring-0
                  hover:bg-gray-800 transition-colors
                  disabled:cursor-default
                `}
              >
                {cell}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-xs mx-auto">
        <button
          onClick={onLeave}
          className="w-full bg-transparent border-2 border-gray-700 text-gray-300 py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          Leave room {state?.turnDeadline ? `(${turnTimeLeft})` : "(7)"}
        </button>
      </div>
    </div>
  );
};
