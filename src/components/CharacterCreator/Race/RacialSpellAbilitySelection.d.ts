/**
 * @file RacialSpellAbilitySelection.tsx
 * A reusable component for any race that needs to select a spellcasting ability
 * (Intelligence, Wisdom, or Charisma) for one of its racial traits.
 */
import React from 'react';
import { AbilityScoreName, AbilityScores, Class as CharClass } from '../../../types';
export interface RacialSpellAbilitySelectionProps {
    raceName: string;
    traitName: string;
    traitDescription: string;
    onAbilitySelect: (ability: AbilityScoreName) => void;
    onBack: () => void;
    abilityScores: AbilityScores;
    selectedClass: CharClass | null;
}
declare const RacialSpellAbilitySelection: React.FC<RacialSpellAbilitySelectionProps>;
export default RacialSpellAbilitySelection;
