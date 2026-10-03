/**
 * @file CentaurNaturalAffinitySkillSelection.tsx
 * This component is part of the character creation process for Centaur characters.
 * It allows the player to choose their Natural Affinity skill proficiency.
 */
import React from 'react';
interface CentaurNaturalAffinitySkillSelectionProps {
    onSkillSelect: (skillId: string) => void;
    onBack: () => void;
}
declare const CentaurNaturalAffinitySkillSelection: React.FC<CentaurNaturalAffinitySkillSelectionProps>;
export default CentaurNaturalAffinitySkillSelection;
