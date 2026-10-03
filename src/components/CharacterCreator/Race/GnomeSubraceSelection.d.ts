/**
 * @file GnomeSubraceSelection.tsx
 * This component is part of the character creation process for Gnome characters.
 * It allows the player to choose their Gnome Subrace (Forest, Rock, or Deep Gnome)
 * and the spellcasting ability for spells granted by that subrace.
 */
import React from 'react';
import { GnomeSubrace, GnomeSubraceType, AbilityScoreName } from '../../../types';
interface GnomeSubraceSelectionProps {
    subraces: GnomeSubrace[];
    onSubraceSelect: (subraceId: GnomeSubraceType, spellcastingAbility: AbilityScoreName) => void;
    onBack: () => void;
}
declare const GnomeSubraceSelection: React.FC<GnomeSubraceSelectionProps>;
export default GnomeSubraceSelection;
