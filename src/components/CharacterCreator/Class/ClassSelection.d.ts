/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:26:51
 * Dependents: CharacterCreator.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * ARCHITECTURAL CONTEXT:
 * This component orchestrates the 'Class Selection' screen. It uses a
 * SplitPaneLayout to allow players to browse a list of classes while
 * viewing deep details (hit dice, proficiencies, etc.) in a side-car
 * preview.
 *
 * Recent updates focus on 'UX Continuity' and 'Visual Feedback'.
 * - Added `getClassIcon` integration into the `SelectionListItem`. This
 *   ensures that the class list is not just text, but a visual gallery
 *   that builds familiarity with class icons before the player reaches
 *   the final review screen.
 * - Refined the `effectiveClassId` logic to allow for an 'Implicit
 *   Selection' of the first class in the sorted list, preventing a
 *   blank right pane on first mount without requiring an additional
 *   `useEffect` sweep.
 *
 * @file src/components/CharacterCreator/Class/ClassSelection.tsx
 */
import React from 'react';
import { Class as CharClass } from '../../../types';
interface ClassSelectionProps {
    classes: CharClass[];
    onClassSelect: (classId: string) => void;
    onBack: () => void;
}
declare const ClassSelection: React.FC<ClassSelectionProps>;
export default ClassSelection;
