/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Sorcerer Feature' sub-step. After selecting
 * the Class, Sorcerers must immediately pick their Cantrips and Level 1
 * spells.
 *
 * Recent updates focus on 'UX Feedback' and 'Validation Robustness'.
 * - Added `sr-only` accessibility labels for screen readers.
 * - Refined the item highlight logic (`selectedCantripIds.has || selectedSpellL1Ids.has`).
 *   This ensures that if a spell is somehow selected in both categories (an
 *   edge case), it remains visually highlighted as "taken".
 * - Improved rendering performance by memoizing `availableCantrips`
 *   and `availableSpellsL1` based on the `spellList` ID array.
 *
 * @file src/components/CharacterCreator/Class/SorcererFeatureSelection.tsx
 */
import React from 'react';
import { Spell, Class as CharClass } from '../../../types';
interface SorcererFeatureSelectionProps {
    spellcastingInfo: NonNullable<CharClass['spellcasting']>;
    allSpells: Record<string, Spell>;
    onSorcererFeaturesSelect: (cantrips: Spell[], spellsL1: Spell[]) => void;
    onBack: () => void;
}
declare const SorcererFeatureSelection: React.FC<SorcererFeatureSelectionProps>;
export default SorcererFeatureSelection;
