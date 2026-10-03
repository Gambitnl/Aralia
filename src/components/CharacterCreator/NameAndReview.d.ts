/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:27:02
 * Dependents: CharacterCreator.tsx
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * ARCHITECTURAL CONTEXT:
 * This component is the 'Final Gate' of character creation. it provides
 * a comprehensive summary of all choices made (Race, Class, Ability
 * Scores, Spells, Feats) and allows the player to name their character
 * and generate a unique AI portrait via Stitch.
 *
 * Recent updates focus on 'Visual Fidelity' and 'Process Completion'.
 * - Added `GlossaryIcon` and `getClassIcon` integration. The summary now
 *   displays standard class iconography, improving the "premium" feel
 *   of the final review.
 * - Refined the `suggestedVisualDescription` logic to automatically
 *   seed the AI prompt with the character's Name, Race, Class, and Gender
 *   selection, streamlining the portrait generation flow.
 * - Integrated `featStepSkipped` feedback. If the character didn't
 *   qualify for any level 1 feats, a subtle informational badge is
 *   shown, explaining WHY that step was bypassed to the user.
 * - Implemented `hasSeededDescriptionRef` to prevent the AI prompt
 *   from resetting if the user manually edits it and then re-renders
 *   the component.
 *
 * @file src/components/CharacterCreator/NameAndReview.tsx
 */
import React from 'react';
import { PlayerCharacter } from '../../types';
import type { PortraitGenerationStatus } from './state/characterCreatorState';
interface NameAndReviewProps {
    characterPreview: PlayerCharacter;
    onConfirm: (name: string) => void;
    onNameDraftChange?: (name: string) => void;
    visualDescription: string;
    onVisualDescriptionChange: (description: string) => void;
    portraitsEnabled: boolean;
    portrait: {
        status: PortraitGenerationStatus;
        url: string | null;
        error: string | null;
        requestedForName: string | null;
    };
    onGeneratePortrait: () => void;
    onCancelPortrait: () => void;
    onClearPortrait: () => void;
    onBack: () => void;
    initialName?: string;
    featStepSkipped?: boolean;
}
declare const NameAndReview: React.FC<NameAndReviewProps>;
export default NameAndReview;
