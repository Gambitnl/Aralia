/**
 * @file HumanSkillSelection.tsx
 * This component allows a Human character to select one skill proficiency
 * from all available skills, as per their "Skillful" racial trait.
 */
import React from 'react';
import { AbilityScores } from '../../../types';
interface HumanSkillSelectionProps {
    abilityScores: AbilityScores;
    onSkillSelect: (skillId: string) => void;
    onBack: () => void;
}
declare const HumanSkillSelection: React.FC<HumanSkillSelectionProps>;
export default HumanSkillSelection;
