import React from "react";

interface MatchingScreenProps {
  onCancel: () => void;
}

export const MatchingScreen: React.FC<MatchingScreenProps> = ({ onCancel }) => {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="animate-spin w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full mx-auto"></div>
        <h2 className="text-2xl font-bold text-white">Finding a random player...</h2>
        <p className="text-gray-400 text-sm">It usually takes 30 seconds.</p>
      </div>
      <div className="fixed bottom-10 w-full max-w-xs px-4">
        <button
          onClick={onCancel}
          className="w-full bg-transparent border border-gray-600 text-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
