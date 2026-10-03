/**
 * @file SkillDetailDisplay.tsx
 * This component displays detailed statistics for each character skill as a modal overlay.
 * It includes base ability, modifier, proficiency, expertise (tracked in Agora task agora-7601),
 * total bonus, and any advantage notes, presented in a table format.
 */
import React from 'react';
import { PlayerCharacter } from '../../../types';
interface SkillDetailDisplayProps {
    isOpen: boolean;
    onClose: () => void;
    character: PlayerCharacter;
    onNavigateToGlossary?: (termId: string) => void;
}
declare const SkillDetailDisplay: React.FC<SkillDetailDisplayProps>;
export default SkillDetailDisplay;
