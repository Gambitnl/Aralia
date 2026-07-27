/**
 * @file TieflingLegacySelection.tsx
 * This component is part of the character creation process for Tiefling characters.
 * It allows the player to choose their Fiendish Legacy (Abyssal, Chthonic, or Infernal)
 * and the spellcasting ability for spells granted by that legacy and Otherworldly Presence.
 */
import React from 'react';
import { FiendishLegacyType, AbilityScoreName } from '../../../types';
interface TieflingLegacySelectionProps {
    onLegacySelect: (legacyId: FiendishLegacyType, spellcastingAbility: AbilityScoreName) => void;
    onBack: () => void;
}
declare const TieflingLegacySelection: React.FC<TieflingLegacySelectionProps>;
export default TieflingLegacySelection;
