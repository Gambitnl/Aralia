/**
 * @file PartyDisplay.tsx
 * A component to display the player's party members during combat.
 * Now includes Auto-Battle toggle.
 */
import React from 'react';
import { CombatCharacter } from '../../types/combat';
import Tooltip from '../Tooltip';

interface PartyMemberDisplayProps {
  character: CombatCharacter;
  onClick: () => void;
  isTurn: boolean;
  isAuto: boolean;
  onToggleAuto: (e: React.MouseEvent) => void;
}

const PartyMemberDisplay: React.FC<PartyMemberDisplayProps> = ({ character, onClick, isTurn, isAuto, onToggleAuto }) => {
  const healthPercentage = (character.currentHP / character.maxHP) * 100;

  return (
    <Tooltip content={`${character.name} - ${character.class.name}`}>
      <div className={`relative w-full bg-gray-700 p-3 rounded-lg shadow-md border-2 ${isTurn ? 'border-amber-400 ring-2 ring-amber-300' : 'border-gray-600'} transition-all`}>
        <button
            onClick={onClick}
            className="w-full text-left focus:outline-none"
            aria-label={`Select ${character.name}`}
        >
            <div className="flex justify-between items-center mb-1.5">
            <p className="text-md font-semibold text-amber-300 truncate">{character.name}</p>
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

        <button
            onClick={onToggleAuto}
            className={`absolute top-2 right-2 px-2 py-0.5 text-xs rounded border ${isAuto ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-800 border-gray-500 text-gray-400'} hover:bg-opacity-80 transition-colors z-10`}
            title="Toggle AI Control"
        >
            {isAuto ? 'AI: ON' : 'AI: OFF'}
        </button>
      </div>
    </Tooltip>
  );
};

interface PartyDisplayProps {
  characters: CombatCharacter[];
  onCharacterSelect: (characterId: string) => void;
  currentTurnCharacterId: string | null;
  autoCharacters: Set<string>;
  onToggleAuto: (characterId: string) => void;
}

const PartyDisplay: React.FC<PartyDisplayProps> = ({ characters, onCharacterSelect, currentTurnCharacterId, autoCharacters, onToggleAuto }) => {
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
            isAuto={autoCharacters.has(char.id)}
            onToggleAuto={(e) => {
                e.stopPropagation();
                onToggleAuto(char.id);
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default PartyDisplay;
