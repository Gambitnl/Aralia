/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Bard Feature' step. After Class selection,
 * Bards must select their initial Cantrips and Level 1 spells.
 *
 * Recent updates focus on 'Screen Reader Optimization' and 'Selection Clarity'.
 * - Added `sr-only` accessibility labels for all spell selection inputs.
 * - Refined item highlighting to use a consolidated check
 *   (`selectedCantripIds.has || selectedSpellL1Ids.has`). This ensures
 *   that if a spell is selected in one category, it is visually marked
 *   as 'active' even if it appears in another list (supporting future
 *   multi-classing or race-based spell overlaps).
 * - Implemented `useMemo` for spell filtering to ensure stable UI tree
 *   construction during selection state updates.
 *
 * @file src/components/CharacterCreator/Class/BardFeatureSelection.tsx
 */
import React from 'react';
import { Spell, Class as CharClass } from '../../../types';
interface BardFeatureSelectionProps {
    spellcastingInfo: NonNullable<CharClass['spellcasting']>;
    allSpells: Record<string, Spell>;
    onBardFeaturesSelect: (cantrips: Spell[], spellsL1: Spell[]) => void;
    onBack: () => void;
}
declare const BardFeatureSelection: React.FC<BardFeatureSelectionProps>;
export default BardFeatureSelection;
