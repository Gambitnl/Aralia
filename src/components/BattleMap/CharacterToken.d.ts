/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:58:06
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/index.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file CharacterToken.tsx
 * Component to display a character's token on the battle map.
 *
 * CURRENT FUNCTIONALITY:
 * - Renders character tokens with team-based coloring
 * - Displays status effects as badge overlays
 * - Shows compact resistance / vulnerability / immunity badges with tooltips
 * - Shows concentration indicator for spellcasters
 * - Implements selection and targeting states
 * - Uses React.memo for basic render optimization
 *
 * PERFORMANCE OPPORTUNITIES:
 * - Individual DOM elements for each token (could batch with canvas)
 * - Status effect badges recreated for every render
 * - No level-of-detail scaling based on distance from camera
 * - CSS transforms recalculated even for static positions
 * - Tooltip creation overhead for every token
 */
import React from "react";
import type { CombatCharacter, Position, WorldforgeOpeningThreatSource } from "../../types/combat";
interface CharacterTokenProps {
    character: CombatCharacter;
    position: {
        x: number;
        y: number;
    };
    isSelected: boolean;
    isTargetable: boolean;
    targetingMode: boolean;
    isTurn: boolean;
    onCharacterClick: (char: CombatCharacter) => void;
}
/**
 * Draw a resolved source body directly from map history.
 *
 * This wrapper intentionally has no click, initiative, health, or targeting
 * behavior. It reuses the same source-authored silhouette as active combat so
 * a return visit can show a body without resurrecting it as an enemy token.
 */
export declare const OpeningThreatWorldBody: React.FC<{
    source: WorldforgeOpeningThreatSource;
    position: Position;
}>;
declare const CharacterToken: React.FC<CharacterTokenProps>;
export default CharacterToken;
