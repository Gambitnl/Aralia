/**
 * @file InitiativeTracker.tsx
 * Displays the turn order for combat.
 */
import React from 'react';
import { CombatCharacter, TurnState } from '../../types/combat';
import Tooltip from '../Tooltip';

interface InitiativeTrackerProps {
  characters: CombatCharacter[];
  turnState: TurnState;
  onCharacterSelect?: (characterId: string) => void;
}

const getClassIcon = (classId: string) => {
    switch (classId) {
        case 'fighter': return '⚔️';
        case 'wizard': return '🧙';
        case 'cleric': return '✝️';
        default: return '●';
    }
};


export const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
  characters,
  turnState,
  onCharacterSelect
}) => {
  const orderedCharacters = turnState.turnOrder.map(id => 
    characters.find(char => char.id === id)
  ).filter((c): c is CombatCharacter => !!c);

  return (
    <div className="bg-gray-800/80 p-2 rounded-lg backdrop-blur-sm shadow-lg border border-gray-700">
      <h3 className="text-center text-sm font-bold text-amber-300 mb-2">Turn Order</h3>
      <div className="flex justify-center items-center gap-2">
        {orderedCharacters.map((char, index) => {
          const isCurrentTurn = char.id === turnState.currentCharacterId;
          const icon = getClassIcon(char.class.id);
          const isPlayer = char.team === 'player';

          return (
            <Tooltip key={char.id} content={`${char.name} (HP: ${char.currentHP}/${char.maxHP})`}>
              <button
                onClick={() => isPlayer && onCharacterSelect?.(char.id)}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all duration-200 ease-in-out border-2
                  ${isCurrentTurn ? 'bg-amber-500/30 border-amber-400 scale-110 shadow-lg' : 'bg-gray-700 border-gray-600'}
                  ${isPlayer ? 'hover:border-sky-400 cursor-pointer' : 'cursor-default'}
                `}
                aria-label={`Character: ${char.name}, Turn ${index + 1}`}
                disabled={!isPlayer || !onCharacterSelect}
              >
                {icon}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

export default InitiativeTracker;