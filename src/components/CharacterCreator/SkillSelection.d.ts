/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/06/2026, 18:11:40
 * Dependents: components/CharacterCreator/CharacterCreator.tsx
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file SkillSelection.tsx
 * Refactored to use Split Config Style (List vs Detail).
 */
import React from 'react';
import { Class as CharClass, Skill, AbilityScores, Race, RacialSelectionData } from '../../types';
interface SkillSelectionProps {
    charClass: CharClass;
    abilityScores: AbilityScores;
    race: Race;
    racialSelections: Record<string, RacialSelectionData>;
    selectedBackground?: string;
    onSkillsSelect: (skills: Skill[]) => void;
    onBack: () => void;
}
/**
 * SkillSelection component.
 * Allows player to choose skill proficiencies based on their class and race.
 * Uses a Split Config layout for consistency with Race/Feat selection.
 */
declare const SkillSelection: React.FC<SkillSelectionProps>;
export default SkillSelection;
