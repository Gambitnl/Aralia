/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Artificer Feature' selection. Artificers are
 * unique in that their level 1 spell preparation count is tied to their
 * Intelligence modifier, requiring dynamic calculation during the
 * creation flow.
 *
 * Recent updates focus on 'Accessibility' and 'Calculation Stability'.
 * - Added `htmlFor` and `id` linking for spell labels to ensure
 *   consistent toggling behavior across device types.
 * - Implemented `useMemo` for `intModifier` and `numPreparedSpells`.
 *   This ensures that the spell allowance only re-calculates when the
 *   underlying Ability Scores change, rather than on every state patch.
 * - Integrated `sr-only` labels for screen reader clarity, mirroring
 *   the accessibility pattern established in other Class Feature screens.
 *
 * @file src/components/CharacterCreator/Class/ArtificerFeatureSelection.tsx
 */
import React from 'react';
import { Spell, Class as CharClass, AbilityScores } from '../../../types';
interface ArtificerFeatureSelectionProps {
    spellcastingInfo: NonNullable<CharClass['spellcasting']>;
    allSpells: Record<string, Spell>;
    abilityScores: AbilityScores;
    onArtificerFeaturesSelect: (cantrips: Spell[], spellsL1: Spell[]) => void;
    onBack: () => void;
}
declare const ArtificerFeatureSelection: React.FC<ArtificerFeatureSelectionProps>;
export default ArtificerFeatureSelection;
