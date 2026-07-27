/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Wizard Feature' step. Wizards are unique
 * in that they must select a larger initial pool of spells for their
 * 'Spellbook' than other prepared casters.
 *
 * Recent updates focus on 'Accessibility' and 'Standardized Input'.
 * - Added `htmlFor` and `id` linking for spell labels. This ensures
 *   that clicking the text or the container correctly toggles the
 *   underlying checkbox, improving UX for all users and specifically
 *   assisting screen reader navigation.
 * - Integrated `sr-only` labels for redundant visual text, ensuring
 *   that the selection state is clearly communicated to assistive tools.
 * - Standardized the `form-checkbox` styling to match the rest of the
 *   Character Creator suite (sky-500 theme).
 *
 * @file src/components/CharacterCreator/Class/WizardFeatureSelection.tsx
 */
import React from 'react';
import { Spell, Class as CharClass } from '../../../types';
interface WizardFeatureSelectionProps {
    spellcastingInfo: NonNullable<CharClass['spellcasting']>;
    allSpells: Record<string, Spell>;
    onWizardFeaturesSelect: (cantrips: Spell[], spellsL1: Spell[]) => void;
    onBack: () => void;
}
declare const WizardFeatureSelection: React.FC<WizardFeatureSelectionProps>;
export default WizardFeatureSelection;
