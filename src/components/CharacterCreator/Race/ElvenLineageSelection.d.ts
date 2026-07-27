/**
 * @file ElvenLineageSelection.tsx
 * This component is part of the character creation process for Elf characters.
 * It allows the player to choose their Elven Lineage (Drow, High Elf, or Wood Elf)
 * and the spellcasting ability for spells granted by that lineage.
 */
import React from 'react';
import { ElvenLineage, ElvenLineageType, AbilityScoreName } from '../../../types';
interface ElvenLineageSelectionProps {
    lineages: ElvenLineage[];
    onLineageSelect: (lineageId: ElvenLineageType, spellcastingAbility: AbilityScoreName) => void;
    onBack: () => void;
}
declare const ElvenLineageSelection: React.FC<ElvenLineageSelectionProps>;
export default ElvenLineageSelection;
