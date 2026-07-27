/**
 * @file FighterFeatureSelection.tsx
 * This component allows a player who has chosen the Fighter class to select
 * a Fighting Style from the available options.
 */
import React from 'react';
import { FightingStyle } from '../../../types';
interface FighterFeatureSelectionProps {
    styles: FightingStyle[];
    onStyleSelect: (style: FightingStyle) => void;
    onBack: () => void;
}
declare const FighterFeatureSelection: React.FC<FighterFeatureSelectionProps>;
export default FighterFeatureSelection;
