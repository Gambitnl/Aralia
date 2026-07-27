/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Warlock Feature' selection (Cantrips and
 * Level 1 Spells). Patron selection is deferred to Level 3 in the current
 * implementation, focusing on core Pact Magic initialization at Level 1.
 *
 * Recent updates focus on 'Accessibility' and 'State Visualization'.
 * - Added `sr-only` labels to improve screen reader support for spell picks.
 * - Refined selection highlighting to use a consolidated check
 *   (`selectedCantripIds.has || selectedSpellL1Ids.has`), ensuring that
 *   any active selection is reflected in the UI across both lists.
 * - Centralized spell data filtering using `useMemo` to ensure stable
 *   renders when the parent state update triggers a re-render.
 *
 * @file src/components/CharacterCreator/Class/WarlockFeatureSelection.tsx
 */
import React from 'react';
import { Spell, Class as CharClass } from '../../../types';
interface WarlockFeatureSelectionProps {
    spellcastingInfo: NonNullable<CharClass['spellcasting']>;
    allSpells: Record<string, Spell>;
    onWarlockFeaturesSelect: (cantrips: Spell[], spellsL1: Spell[]) => void;
    onBack: () => void;
}
declare const WarlockFeatureSelection: React.FC<WarlockFeatureSelectionProps>;
export default WarlockFeatureSelection;
