
/**
 * @file MainMenu.tsx
 * This component renders the main menu screen for the Aralia RPG.
 * It provides options to start a new game, load a saved game (placeholder),
 * and view a game compendium (placeholder).
 * It now also includes a conditional "Skip Character Creator" button for development.
 */
import React from 'react';

interface MainMenuProps {
  onNewGame: () => void;
  onLoadGame: () => void; 
  onShowCompendium: () => void; 
  hasSaveGame: boolean; 
  latestSaveTimestamp: number | null; 
  isDevDummyActive: boolean; // New prop
  onSkipCharacterCreator: () => void; // New prop
}

/**
 * MainMenu component.
 * Displays the main title and navigation buttons for the game.
 * @param {MainMenuProps} props - Props for the component, including callbacks for menu actions.
 * @returns {React.FC} The rendered MainMenu component.
 */
const MainMenu: React.FC<MainMenuProps> = ({
  onNewGame,
  onLoadGame,
  onShowCompendium,
  hasSaveGame,
  latestSaveTimestamp,
  isDevDummyActive,
  onSkipCharacterCreator,
}) => {
  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `Last played: ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-8">
      <div className="bg-gray-800 p-8 md:p-12 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md text-center">
        <h1 className="text-5xl font-bold text-amber-400 mb-12 font-cinzel tracking-wider">
          Aralia RPG
        </h1>
        <div className="space-y-4">
          {hasSaveGame && (
            <button
              onClick={onLoadGame} 
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-opacity-75"
              aria-label="Continue your last adventure"
            >
              Continue
              {latestSaveTimestamp && (
                <span className="block text-xs text-emerald-200 mt-1">{formatTimestamp(latestSaveTimestamp)}</span>
              )}
            </button>
          )}
          <button
            onClick={onNewGame}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75"
            aria-label="Start a new game"
          >
            New Game
          </button>
          {isDevDummyActive && (
            <button
              onClick={onSkipCharacterCreator}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-opacity-75"
              aria-label="Skip character creation and start with dev character"
            >
              Skip Character Creator (Dev)
            </button>
          )}
          <button
            onClick={onLoadGame}
            disabled={!hasSaveGame}
            className={`w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75 ${!hasSaveGame ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={hasSaveGame ? "Load a saved game" : "Load a saved game (no save file found)"}
            title={hasSaveGame ? "Load Game" : "Load Game (No save file found)"}
          >
            Load Game
          </button>
          <button
            onClick={onShowCompendium} // This prop now correctly opens the Glossary
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-lg shadow-md text-xl transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75"
            aria-label="View game glossary"
            title="View Game Glossary" 
          >
            Glossary
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-12">Powered by Gemini</p>
      </div>
    </div>
  );
};

export default MainMenu;
