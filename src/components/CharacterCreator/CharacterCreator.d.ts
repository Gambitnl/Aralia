/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/07/2026, 22:16:44
 * Dependents: App.tsx, components/DesignPreview/steps/PreviewCharacterCreator.tsx
 * Imports: 43 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * ARCHITECTURAL CONTEXT:
 * This component is the 'Main Orchestrator' for character generation.
 * it manages the multi-step wizard state, coordinate between sub-screens
 * (Race, Class, Ability Scores, etc.), and ensures that the final
 * character object is assembled correctly before being dispatched
 * to the global state.
 *
 * Recent updates focus on 'UX Stability' and 'Selection Flexibility'.
 * - Replaced in-render dispatches with `StepLockedPlaceholder`. This
 *   fixes a critical React bug where navigating to an invalid step
 *   triggered a second render cycle, causing UI flicker in the sidebar.
 * - Integrated `portraitJobRef` and cancellation handlers to prevent
 *   stale Image Generation requests from overwriting the UI if the user
 *   navigates away or clears the portrait.
 * - Added `featStepSkipped` flag to track when the engine automatically
 *   bypasses the Feat screen (due to lack of eligibility), providing
 *   clearer feedback in the final review step.
 * - Synchronized `FEATS_DATA` filtering to only show level-1 eligible
 *   perks during character creation, reducing noise for new players.
 *
 * @file src/components/CharacterCreator/CharacterCreator.tsx
 */
import React from 'react';
import { PlayerCharacter, Item } from '../../types';
import type { CharacterCreationState } from './state/characterCreatorState';
import type { AppAction } from '../../state/actionTypes';
interface CharacterCreatorProps {
    onCharacterCreate: (character: PlayerCharacter, startingInventory: Item[]) => void;
    onExitToMainMenu: () => void;
    dispatch: React.Dispatch<AppAction>;
    /**
     * Stores unfinished choices separately when the live creator is embedded in
     * a tool such as Design Preview. Normal gameplay keeps the established key,
     * so existing player drafts continue to resume exactly as before.
     */
    draftStorageKey?: string;
    /**
     * Reports the complete in-progress choice record to an embedding tool.
     * Gameplay does not supply this callback; Design Preview uses it to export
     * exactly what is currently selected, including incomplete characters.
     */
    onDraftChange?: (state: CharacterCreationState) => void;
    /**
     * Adds a tool-owned action beside Auto-Fill without copying the creator's
     * title bar. The live game leaves this empty, while Design Preview supplies
     * its export button.
     */
    previewHeaderActions?: React.ReactNode;
}
declare const CharacterCreator: React.FC<CharacterCreatorProps>;
export default CharacterCreator;
