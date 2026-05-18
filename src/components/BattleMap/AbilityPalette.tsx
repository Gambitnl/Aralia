/**
 * @file AbilityPalette.tsx
 * Displays the abilities for the currently selected character.
 * Supports pop-out into a draggable/resizable WindowFrame modal.
 */
import React, { useState } from 'react';
import { CombatCharacter, Ability, AbilityCost } from '../../types/combat';
import AbilityButton from './AbilityButton';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';

interface AbilityPaletteProps {
  character: CombatCharacter | null;
  onSelectAbility: (ability: Ability) => void;
  canAffordAction: (cost: AbilityCost) => boolean;
}

const AbilityPalette: React.FC<AbilityPaletteProps> = ({ character, onSelectAbility, canAffordAction }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!character) {
    return <div className="p-2 text-center text-gray-400 italic">Select a character to see abilities.</div>;
  }

  const abilityButtons = (
    <div className="flex justify-center flex-wrap gap-2 p-3">
      {character.abilities.map(ability => {
        const isAffordable = canAffordAction(ability.cost);
        const isOnCooldown = (ability.currentCooldown || 0) > 0;
        const isExhausted = ability.maxUses !== undefined && (ability.usesRemaining ?? ability.maxUses) <= 0;
        const isDisabled = !isAffordable || isOnCooldown || isExhausted;
        return (
          <AbilityButton
            key={ability.id}
            ability={ability}
            onSelect={() => onSelectAbility(ability)}
            isDisabled={isDisabled}
          />
        );
      })}
    </div>
  );

  return (
    <>
      <div className="bg-gray-800/80 rounded-lg backdrop-blur-sm shadow-lg border border-gray-700">
        <div className="flex items-center justify-between px-3 pt-2 pb-1 border-b border-gray-700/50">
          <h3 className="text-sm font-bold text-amber-300">{character.name}{"'"}s Abilities</h3>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors"
            title="Pop out into resizable window"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
        {isExpanded ? (
          <div className="p-3 text-gray-400 text-xs italic text-center">Abilities are popped out.</div>
        ) : abilityButtons}
      </div>

      {isExpanded && (
        <WindowFrame
          title={`${character.name}'s Abilities`}
          onClose={() => setIsExpanded(false)}
          storageKey={WINDOW_KEYS.ABILITY_PALETTE}
          initialMaximized={false}
        >
          <div className="h-full overflow-y-auto bg-gray-900 scrollable-content">
            {abilityButtons}
          </div>
        </WindowFrame>
      )}
    </>
  );
};

export default AbilityPalette;
