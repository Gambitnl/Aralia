/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Druid Feature' selection (Primal Order,
 * Cantrips, and Level 1 Spells).
 *
 * Recent updates focus on '2024 Rulebook Alignment' and 'Automated Feature Injection'.
 * - Added `sr-only` accessibility labels for all spell selection inputs.
 * - Refined item highlighting to use a consolidated check
 *   (`selectedCantripIds.has || selectedSpellL1Ids.has`) for UI consistency.
 * - Implemented `numCantripsToSelect` logic to account for the
 *   'Magician' Primal Order, which grants an extra cantrip.
 * - Automated the inclusion of `Speak with Animals`. This spell is now
 *   displayed as a locked, pre-selected 'Class Feature' in the Level 1
 *   list, ensuring players are aware of their innate class abilities
 *   without having to manually spend a selection slot on them.
 *
 * @file src/components/CharacterCreator/Class/DruidFeatureSelection.tsx
 */
import React from 'react';
import { PrimalOrderOption, Spell, Class as CharClass } from '../../../types';
interface DruidFeatureSelectionProps {
    primalOrders: PrimalOrderOption[];
    spellcastingInfo: NonNullable<CharClass['spellcasting']>;
    allSpells: Record<string, Spell>;
    onDruidFeaturesSelect: (order: 'Magician' | 'Warden', cantrips: Spell[], spellsL1: Spell[]) => void;
    onBack: () => void;
}
declare const DruidFeatureSelection: React.FC<DruidFeatureSelectionProps>;
export default DruidFeatureSelection;
