/**
 * @file PaladinFeatureSelection.tsx
 * This component allows a player who has chosen the Paladin class to select
 * their initial known Level 1 spells.
 */
import React from 'react';
import { Spell, Class as CharClass } from '../../../types';
interface PaladinFeatureSelectionProps {
    spellcastingInfo: NonNullable<CharClass['spellcasting']>;
    allSpells: Record<string, Spell>;
    onPaladinFeaturesSelect: (spellsL1: Spell[]) => void;
    onBack: () => void;
}
declare const PaladinFeatureSelection: React.FC<PaladinFeatureSelectionProps>;
export default PaladinFeatureSelection;
