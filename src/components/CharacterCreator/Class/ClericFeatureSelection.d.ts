/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Cleric Feature' selection (Divine Order,
 * Cantrips, and Level 1 Spells).
 *
 * Recent updates focus on '2024 Rulebook Alignment' and 'Dynamic Selection Pools'.
 * - Added `sr-only` accessibility labels for all spell selection inputs.
 * - Refined item highlighting to use a consolidated check
 *   (`selectedCantripIds.has || selectedSpellL1Ids.has`). This ensures
 *   visual consistency across sub-lists.
 * - Implemented `numCantripsToSelect` logic to account for the
 *   'Thaumaturge' Divine Order, which grants an extra cantrip. This
 *   dynamic limit ensures that validation correctly scales based on the
 *   player's specific build choices.
 *
 * @file src/components/CharacterCreator/Class/ClericFeatureSelection.tsx
 */
import React from 'react';
import { DivineOrderOption, Spell, Class as CharClass } from '../../../types';
interface ClericFeatureSelectionProps {
    divineOrders: DivineOrderOption[];
    spellcastingInfo: NonNullable<CharClass['spellcasting']>;
    allSpells: Record<string, Spell>;
    onClericFeaturesSelect: (order: 'Protector' | 'Thaumaturge', cantrips: Spell[], spellsL1: Spell[]) => void;
    onBack: () => void;
}
declare const ClericFeatureSelection: React.FC<ClericFeatureSelectionProps>;
export default ClericFeatureSelection;
