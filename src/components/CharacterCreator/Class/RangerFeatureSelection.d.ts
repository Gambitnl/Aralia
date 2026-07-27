/**
 * @file RangerFeatureSelection.tsx
 * This component allows a player who has chosen the Ranger class to select
 * their initial known Level 1 spells. Fighting Style is a level 2 feature and is no longer selected here.
 */
import React from 'react';
import { Spell, Class as CharClass } from '../../../types';
interface RangerFeatureSelectionProps {
    spellcastingInfo: NonNullable<CharClass['spellcasting']>;
    allSpells: Record<string, Spell>;
    onRangerFeaturesSelect: (spellsL1: Spell[]) => void;
    onBack: () => void;
}
declare const RangerFeatureSelection: React.FC<RangerFeatureSelectionProps>;
export default RangerFeatureSelection;
