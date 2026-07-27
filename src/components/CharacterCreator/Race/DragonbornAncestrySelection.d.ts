/**
 * @file DragonbornAncestrySelection.tsx
 * This component is part of the character creation process, specifically for Dragonborn characters.
 * It allows the player to choose their Draconic Ancestry (e.g., Red, Blue, Gold dragon),
 * which determines their damage resistance and breath weapon type.
 */
import React from 'react';
import { DraconicAncestorType } from '../../../types';
interface DragonbornAncestrySelectionProps {
    onAncestrySelect: (ancestryType: DraconicAncestorType) => void;
    onBack: () => void;
}
declare const DragonbornAncestrySelection: React.FC<DragonbornAncestrySelectionProps>;
export default DragonbornAncestrySelection;
