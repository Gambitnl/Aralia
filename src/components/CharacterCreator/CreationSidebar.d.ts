/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:26:55
 * Dependents: CharacterCreator.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file CreationSidebar.tsx
 * Persistent left sidebar for character creation, showing step progress,
 * current selections, and allowing navigation between steps.
 * Inspired by Baldur's Gate 3's character creation UI.
 */
import React from 'react';
import { CreationStep, CharacterCreationState } from './state/characterCreatorState';
interface CreationSidebarProps {
    currentStep: CreationStep;
    state: CharacterCreationState;
    onNavigateToStep: (step: CreationStep) => void;
    /** Wipes every choice and returns to the Race step (two-click confirm). */
    onStartOver?: () => void;
}
/**
 * Main sidebar component
 */
declare const CreationSidebar: React.FC<CreationSidebarProps>;
export default CreationSidebar;
