/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/07/2026, 06:10:37
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/BattleMap/index.ts, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file renders the compact turn order above the battle map.
 *
 * It keeps every actor selectable and summarizes identity, health, and death
 * state in a narrow horizontal strip. Source-world actors use military or
 * social roles as their short label because repeated faction/species names
 * would make a coordinated group indistinguishable at the main glance point.
 *
 * Called by: BattleMapDemo and the production combat shell
 * Depends on: combat turn state, shared token visuals, and WindowFrame
 */
import React from 'react';
import { CombatCharacter, TurnState } from '../../types/combat';
interface InitiativeTrackerProps {
    characters: CombatCharacter[];
    turnState: TurnState;
    onCharacterSelect?: (characterId: string) => void;
    onSkipToCharacter?: (characterId: string) => void;
}
export declare function initiativeShortLabel(character: CombatCharacter): string;
export declare const InitiativeTracker: React.FC<InitiativeTrackerProps>;
export default InitiativeTracker;
