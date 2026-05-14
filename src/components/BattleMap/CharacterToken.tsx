// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 07/05/2026, 00:03:59
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file CharacterToken.tsx
 * Component to display a character's token on the battle map.
 * 
 * CURRENT FUNCTIONALITY:
 * - Renders character tokens with team-based coloring
 * - Displays status effects as badge overlays
 * - Shows concentration indicator for spellcasters
 * - Implements selection and targeting states
 * - Uses React.memo for basic render optimization
 * 
 * PERFORMANCE OPPORTUNITIES:
 * - Individual DOM elements for each token (could batch with canvas)
 * - Status effect badges recreated for every render
 * - No level-of-detail scaling based on distance from camera
 * - CSS transforms recalculated even for static positions
 * - Tooltip creation overhead for every token
 */
import React, { useMemo } from 'react';
import { CombatCharacter } from '../../types/combat';
import { TILE_SIZE_PX } from '../../config/mapConfig';
import Tooltip from '../Tooltip';
import { getStatusEffectIcon, getCharacterSizeMultiplier } from '../../utils/combatUtils';
import { Z_INDEX } from '../../styles/zIndex';

interface CharacterTokenProps {
  character: CombatCharacter;
  position: { x: number; y: number };
  isSelected: boolean;
  isTargetable: boolean;
  targetingMode: boolean;
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

const CharacterToken: React.FC<CharacterTokenProps> = React.memo(({ character, position, isSelected, isTargetable, targetingMode, isTurn, onCharacterClick }) => {
  const multiplier = getCharacterSizeMultiplier(character.stats.size);

  // Memoized container style: only recalculates when position, size, or interaction
  // state changes — prevents redundant style-object allocation on unrelated renders.
  const style = useMemo((): React.CSSProperties => ({
    position: 'absolute',
    left: `${position.x * TILE_SIZE_PX}px`,
    top: `${position.y * TILE_SIZE_PX}px`,
    width: `${TILE_SIZE_PX * multiplier}px`,
    height: `${TILE_SIZE_PX * multiplier}px`,
    transition: 'all 0.2s ease-in-out',
    zIndex: Z_INDEX.CONTENT_OVERLAY_LOW,
    cursor: targetingMode ? 'crosshair' : 'pointer',
  }), [position.x, position.y, multiplier, targetingMode]);

  // Memoized token circle style: only recalculates when visual state changes.
  const tokenStyle = useMemo((): React.CSSProperties => {
    let borderColor = '#6B7280'; // gray-500 default
    if (character.team === 'player') borderColor = '#3B82F6';
    else borderColor = '#991B1B'; // red-800 for enemy team
    if (isTargetable) borderColor = '#EF4444';
    if (isSelected)   borderColor = '#FBBF24';

    return {
      width: '80%',
      height: '80%',
      borderRadius: '50%',
      border: `3px solid ${borderColor}`,
      backgroundColor: '#1F2937',
      boxShadow: isSelected
        ? '0 0 10px #FBBF24, 0 0 20px #FBBF24'
        : isTargetable
          ? '0 0 10px #EF4444'
          : '0 2px 4px rgba(0,0,0,0.5)',
      transform: isSelected ? 'scale(1.1)' : 'scale(1.0)',
      animation: isTurn ? 'pulseTurn 2s infinite' : 'none',
    };
  }, [character.team, isSelected, isTargetable, isTurn]);

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
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-purple-900 border border-purple-400 flex items-center justify-center text-xs shadow-md"
            style={{ animation: 'pulse 2s infinite', zIndex: Z_INDEX.CONTENT_OVERLAY_MEDIUM }}
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
