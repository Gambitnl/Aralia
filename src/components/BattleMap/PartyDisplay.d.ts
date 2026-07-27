/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/07/2026, 03:19:52
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/BattleMap/index.ts, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file PartyDisplay.tsx
 * A component to display the player's party members during combat.
 * Now includes Auto-Battle toggle.
 */
import React from 'react';
import { CombatCharacter } from '../../types/combat';
interface PartyDisplayProps {
    characters: CombatCharacter[];
    onCharacterSelect: (characterId: string) => void;
    onCharacterInspect: (characterId: string) => void;
    currentTurnCharacterId: string | null;
    autoCharacters: Set<string>;
    onToggleAuto: (characterId: string) => void;
    onCenterCharacter: (characterId: string) => void;
}
declare const PartyDisplay: React.FC<PartyDisplayProps>;
export default PartyDisplay;
