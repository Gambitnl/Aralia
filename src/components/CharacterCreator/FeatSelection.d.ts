/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:27:00
 * Dependents: CharacterCreator.tsx, LevelUpModal.tsx
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * ARCHITECTURAL CONTEXT:
 * This component manages the 'Feat Configuration' step. Unlike simple
 * selection screens, feats can grant complex sets of benefits: Ability
 * Score Increases (ASI), extra Skill Proficiencies, and even entirely
 * new spellcasting capabilities (including sub-choice sources like
 * Magic Initiate).
 *
 * Recent updates focus on '2024 Rulebook Alignment' and 'Choice Routing'.
 * - Expanded the detail view to display 2024-specific passive benefits
 *   like Proficiency-scaled Initiative and Lucky points.
 * - Integrated `SpellSourceSelector` for feats like Magic Initiate,
 *   ensuring that players pick their spell list (Wizard, Cleric, Druid)
 *   before being offered the specific spell pickers.
 * - Improved 'Selection Validity' logic. The `canProceed` check now
 *   exhaustively validates that all sub-choices (ASI, Skills, Spells)
 *   are filled before allowing the player to commit the feat.
 * - Added `knownSkillIds` filtering to prevent players from double-dipping
 *   on proficiencies they already have from their Race or Class.
 *
 * @file src/components/CharacterCreator/FeatSelection.tsx
 */
import React from 'react';
import { Feat } from '../../types';
import type { AppAction } from '../../state/actionTypes';
import type { FeatChoiceState, FeatChoiceValue } from './state/characterCreatorState';
interface FeatOption extends Feat {
    isEligible: boolean;
    unmet: string[];
}
interface FeatSelectionProps {
    availableFeats: FeatOption[];
    selectedFeatId?: string;
    featChoices?: Record<string, FeatChoiceState>;
    onSelectFeat: (featId: string) => void;
    onSetFeatChoice: (featId: string, choiceType: string, value: FeatChoiceValue) => void;
    onConfirm: () => void;
    onBack?: () => void;
    hasEligibleFeats: boolean;
    dispatch?: React.Dispatch<AppAction>;
    knownSkillIds?: string[];
    allowSkip?: boolean;
    /**
     * Which feat slot this screen is filling (e.g. "Origin Feat — Soldier",
     * "Racial Feat — Human"). The origin and racial feat steps render this same
     * component back-to-back, so an explicit title is required to tell them apart.
     */
    title?: string;
    /** Spell ids the character already knows; excluded from feat spell pickers. */
    knownSpellIds?: string[];
}
declare const FeatSelection: React.FC<FeatSelectionProps>;
export default FeatSelection;
