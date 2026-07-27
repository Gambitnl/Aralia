/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 08:51:23
 * Dependents: components/CharacterCreator/CharacterCreator.tsx, components/CharacterCreator/CreationSidebar.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file sidebarSteps.ts
 * Configuration for the character creation sidebar - defines step metadata,
 * display labels, groupings, and selection summary functions.
 */
import { CreationStep, CharacterCreationState } from '../state/characterCreatorState';
export type StepGroup = 'origin' | 'class' | 'abilities' | 'final';
export type LockedStepMessageKey = 'selectRaceFirst' | 'selectClassFirst' | 'assignAbilityScoresFirst' | 'noAdditionalClassFeatures' | 'missingReviewData';
export declare const LOCKED_STEP_MESSAGES: Record<LockedStepMessageKey, string>;
export declare const getLockedStepMessage: (key: LockedStepMessageKey) => string;
export interface SidebarStepConfig {
    step: CreationStep;
    label: string;
    group: StepGroup;
    /** Returns a summary of the current selection for this step, or null if not yet selected */
    getSelectionSummary: (state: CharacterCreationState) => string | null;
    /** Returns true if this step should be shown (for conditional race-specific steps) */
    isVisible: (state: CharacterCreationState) => boolean;
    /** Parent step for nested display (e.g., DragonbornAncestry is nested under Race) */
    parentStep?: CreationStep;
}
/**
 * Determines if a step has been completed based on the state
 */
export declare const isStepCompleted: (step: CreationStep, state: CharacterCreationState) => boolean;
/**
 * A step counts toward visible progress (green check + the footer tally) only
 * once the player has actually reached it. Without the "reached" gate, steps
 * with defaults (e.g. Appearance) read as complete before they are visited,
 * so the sidebar showed a green check the footer count refused to credit
 * ("3 checks / 2 complete"). Gating the checkmark and the count through this
 * single predicate keeps the two in lock-step. The current step counts as
 * reached so confirming it never lags the displayed tally.
 */
export declare const isStepReachedAndComplete: (step: CreationStep, currentStep: CreationStep, state: CharacterCreationState) => boolean;
/**
 * Group display configuration
 */
export declare const STEP_GROUPS: Record<StepGroup, {
    label: string;
    order: number;
}>;
/**
 * All sidebar step configurations
 */
export declare const SIDEBAR_STEPS: SidebarStepConfig[];
/**
 * Get visible steps for the current state
 */
export declare const getVisibleSteps: (state: CharacterCreationState) => SidebarStepConfig[];
/**
 * Get steps grouped by their group
 */
export declare const getStepsByGroup: (state: CharacterCreationState) => Map<StepGroup, SidebarStepConfig[]>;
