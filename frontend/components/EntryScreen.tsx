import React from "react";

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

interface EntryScreenProps {
  username: string;
  setUsername: (username: string) => void;
  onConnect: () => void;
  error: string | null;
}

export const EntryScreen: React.FC<EntryScreenProps> = ({ username, setUsername, onConnect, error }) => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm relative shadow-2xl border border-gray-700">
          <button 
            onClick={() => setUsername("")}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <CloseIcon />
          </button>
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Who are you?</h2>
          <div className="space-y-4">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nickname"
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-teal-500 focus:outline-none transition-colors placeholder-gray-400"
            />
            
            <button
              onClick={onConnect}
              className="w-full bg-teal-500 text-white py-3 px-6 rounded-lg font-bold hover:bg-teal-400 transition-all shadow-lg hover:shadow-teal-500/20"
            >
              Continue
            </button>
            {error && (
              <div className="text-red-400 text-sm text-center mt-2">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
