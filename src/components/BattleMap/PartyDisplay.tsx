/**
 * @file PartyDisplay.tsx
 * A component to display the player's party members during combat.
 */
import React from 'react';
import { CombatCharacter } from '../../types/combat';
import Tooltip from '../Tooltip';

interface PartyMemberDisplayProps {
  character: CombatCharacter;
  onClick: () => void;
  isTurn: boolean;
}

const PartyMemberDisplay: React.FC<PartyMemberDisplayProps> = ({ character, onClick, isTurn }) => {
  const healthPercentage = (character.currentHP / character.maxHP) * 100;

  return (
    <Tooltip content={`${character.name} - ${character.class.name}`}>
      <button
        onClick={onClick}
        className={`w-full bg-gray-700 hover:bg-gray-600 p-3 rounded-lg shadow-md transition-colors border-2 ${isTurn ? 'border-amber-400 ring-2 ring-amber-300' : 'border-gray-600'} focus:outline-none focus:ring-2 focus:ring-sky-500`}
        aria-label={`Select ${character.name}`}
      >
        <div className="flex justify-between items-center mb-1.5">
          <p className="text-md font-semibold text-amber-300 truncate">{character.name}</p>
          {/* Potential place for AC or status icons */}
        </div>
        <div className="w-full bg-gray-900 rounded-full h-5 shadow-inner overflow-hidden relative border border-gray-500">
          <div
            className="bg-red-600 h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${healthPercentage}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs font-bold text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
              {character.currentHP} / {character.maxHP}
            </p>
          </div>
        </div>
      </button>
    </Tooltip>
  );
};

interface PartyDisplayProps {
  characters: CombatCharacter[];
  onCharacterSelect: (characterId: string) => void;
  currentTurnCharacterId: string | null;
}

const PartyDisplay: React.FC<PartyDisplayProps> = ({ characters, onCharacterSelect, currentTurnCharacterId }) => {
  const playerCharacters = characters.filter(c => c.team === 'player');

  return (
    <div className="bg-gray-800/80 p-4 rounded-lg backdrop-blur-sm shadow-lg border border-gray-700 h-full overflow-y-auto scrollable-content">
      <h3 className="text-center text-lg font-bold text-amber-300 mb-4 border-b-2 border-amber-500 pb-2">Your Party</h3>
      <div className="space-y-3">
        {playerCharacters.map(char => (
          <PartyMemberDisplay
            key={char.id}
            character={char}
            onClick={() => onCharacterSelect(char.id)}
            isTurn={char.id === currentTurnCharacterId}
          />
        ))}
      </div>
    </div>
  );
};

export default PartyDisplay;
