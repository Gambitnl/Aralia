/**
 * @file AbilityPalette.tsx
 * Displays the abilities for the currently selected character.
 */
import React from 'react';
import { CombatCharacter, Ability, AbilityCost } from '../../types/combat';
import AbilityButton from './AbilityButton';

interface AbilityPaletteProps {
  character: CombatCharacter | null;
  onSelectAbility: (ability: Ability) => void;
  canAffordAction: (cost: AbilityCost) => boolean;
}

const AbilityPalette: React.FC<AbilityPaletteProps> = ({ character, onSelectAbility, canAffordAction }) => {
  if (!character) {
    return <div className="p-2 text-center text-gray-400 italic">Select a character to see abilities.</div>;
  }

  return (
    <div className="bg-gray-800/80 p-3 rounded-lg backdrop-blur-sm shadow-lg border border-gray-700">
        <h3 className="text-center text-sm font-bold text-amber-300 mb-2">{character.name}'s Abilities</h3>
        <div className="flex justify-center flex-wrap gap-2">
            {character.abilities.map(ability => {
                const isAffordable = canAffordAction(ability.cost);
                const isOnCooldown = (ability.currentCooldown || 0) > 0;
                const isDisabled = !isAffordable || isOnCooldown;
                
                return (
                    <AbilityButton 
                        key={ability.id}
                        ability={ability}
                        onSelect={() => onSelectAbility(ability)}
                        isDisabled={isDisabled}
                    />
                )
            })}
        </div>
    </div>
  );
};

export default AbilityPalette;
