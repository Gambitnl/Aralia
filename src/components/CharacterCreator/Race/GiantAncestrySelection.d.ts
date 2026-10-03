/**
 * @file GiantAncestrySelection.tsx
 * This component is part of the character creation process for Goliath characters.
 * It allows the player to choose their Giant Ancestry benefit.
 */
import React from 'react';
import { GiantAncestryType } from '../../../types';
interface GiantAncestrySelectionProps {
    onAncestrySelect: (ancestryBenefitId: GiantAncestryType) => void;
    onBack: () => void;
}
declare const GiantAncestrySelection: React.FC<GiantAncestrySelectionProps>;
export default GiantAncestrySelection;
