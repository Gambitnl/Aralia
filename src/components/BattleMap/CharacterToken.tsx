/**
 * @file CharacterToken.tsx
 * Component to display a character's token on the battle map.
 */
import React from 'react';
import { CombatCharacter } from '../../types/combat';
import { TILE_SIZE_PX } from '../../config/mapConfig';
import Tooltip from '../Tooltip';
import { getStatusEffectIcon } from '../../utils/combatUtils';

interface CharacterTokenProps {
  character: CombatCharacter;
  position: { x: number; y: number };
  isSelected: boolean;
  isTargetable: boolean;
  isTurn: boolean;
  onCharacterClick: (char: CombatCharacter) => void;
}

const getClassIcon = (classId: string) => {
  switch (classId) {
    case 'fighter': return '⚔️';
    case 'wizard': return '🧙';
    case 'cleric': return '✝️';
    default: return '●';
  }
};

const CharacterToken: React.FC<CharacterTokenProps> = React.memo(({ character, position, isSelected, isTargetable, isTurn, onCharacterClick }) => {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x * TILE_SIZE_PX}px`,
    top: `${position.y * TILE_SIZE_PX}px`,
    width: `${TILE_SIZE_PX}px`,
    height: `${TILE_SIZE_PX}px`,
    transition: 'all 0.2s ease-in-out',
    zIndex: 10,
    cursor: 'pointer',
  };

  let borderColor = '#6B7280'; // gray-500 default
  if (character.team === 'player') borderColor = '#3B82F6'; // blue-500 for player team
  else borderColor = '#991B1B'; // red-800 for enemy team

  if (isTargetable) {
    borderColor = '#EF4444'; // red-500 for targetable
  }
  if (isSelected) {
    borderColor = '#FBBF24'; // amber-400 for selected
  }


  const tokenStyle: React.CSSProperties = {
    width: '80%',
    height: '80%',
    borderRadius: '50%',
    border: `3px solid ${borderColor}`,
    backgroundColor: '#1F2937', // gray-800
    boxShadow: isSelected ? '0 0 10px #FBBF24, 0 0 20px #FBBF24' : (isTargetable ? '0 0 10px #EF4444' : '0 2px 4px rgba(0,0,0,0.5)'),
    transform: isSelected ? 'scale(1.1)' : 'scale(1.0)',
    animation: isTurn ? 'pulseTurn 2s infinite' : 'none',
  };

  const icon = getClassIcon(character.class.id);
  const handleActivate = () => onCharacterClick(character);

  return (
    <div
      style={style}
      className="relative flex items-center justify-center pointer-events-auto"
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleActivate();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Select ${character.name}`}
    >
      <Tooltip content={`${character.name} (Armor Class: ${character.class.id === 'fighter' ? 18 : 12}, Hit Points: ${character.currentHP}/${character.maxHP})`}>
        <div
          style={tokenStyle}
          className="flex items-center justify-center font-bold text-white text-lg"
        >
          {icon}
        </div>
      </Tooltip>

      {/* Status effect badges hover near the token to visualize buffs/debuffs without opening a sheet. */}
      {character.statusEffects.length > 0 && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {character.statusEffects.map((effect, idx) => (
            <Tooltip key={`${effect.id}-${idx}`} content={`${effect.name} (${effect.duration}t)`}>
              <span
                className="w-6 h-6 rounded-full bg-gray-900 border border-white/40 flex items-center justify-center text-xs"
                style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.45)' }}
              >
                {getStatusEffectIcon(effect)}
              </span>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Concentration Indicator: Shows a pulsing crystal orb if the character is maintaining a spell. */}
      {character.concentratingOn && (
        <Tooltip content={`Concentrating on ${character.concentratingOn.spellName}`}>
          <div
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-purple-900 border border-purple-400 flex items-center justify-center text-xs shadow-md z-20"
            style={{ animation: 'pulse 2s infinite' }}
          >
            🔮
          </div>
        </Tooltip>
      )}
    </div>
  );
});

CharacterToken.displayName = 'CharacterToken';

export default CharacterToken;
