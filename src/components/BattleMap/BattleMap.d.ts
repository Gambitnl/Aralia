/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/07/2026, 14:52:19
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/BattleMap/index.ts, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 18 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file BattleMap.tsx
 * The primary component for rendering a source-backed tactical battlefield.
 *
 * CURRENT FUNCTIONALITY:
 * - Renders WorldForge terrain, tactical cells, character bodies, and saved scene evidence
 * - Manages turn-based interaction states (move/attack modes)
 * - Handles tile and character click interactions
 * - Displays damage numbers and spell effects through overlay
 * - Implements basic optimization with memoized sets for target selection
 *
 * PERFORMANCE OPPORTUNITIES:
 * - Missing viewport culling for off-screen entities (renders all characters/tiles)
 * - No level-of-detail scaling for distant combatants
 * - Individual DOM elements for each damage number (could use canvas)
 * - Grid rendering recalculates all tiles even when only positions change
 * - No texture atlas consolidation for sprite batching
 */
import React from "react";
import { BattleMapData, CombatCharacter, Position } from "../../types/combat";
import type { useTurnManager } from "../../hooks/combat/useTurnManager";
import type { useAbilitySystem } from "../../hooks/useAbilitySystem";
import type { SpellMapArtifacts } from "./spellMapArtifacts";
interface BattleMapProps {
    mapData: BattleMapData | null;
    characters: CombatCharacter[];
    showCoverLabels?: boolean;
    showLightSourceMarkers?: boolean;
    showLineOfSightCone?: boolean;
    assetOverlayVisible?: boolean;
    /** Visual harness layer that marks every explicit source-backed object fact. */
    showTargetableObjectFacts?: boolean;
    /** Source-backed noncombat residents, grouped by tactical cell for legibility. */
    showWorldOccupants?: boolean;
    /** Debug/review surfaces may prioritize whole-map context over token size. */
    preferFullMapFit?: boolean;
    /**
     * Dev/review affordance: shows the render-only fog-of-war veil toggle chip in
     * the command toolbar. Off by default so it never ships in real-game combat;
     * only the design-lab demo path opts in.
     */
    showFogToggle?: boolean;
    cameraFocusRequest?: {
        characterId: string;
        requestId: number;
    } | null;
    objectInteraction?: {
        activeObjectId: string | null;
        movableObjectIds: string[];
        onObjectSelect: (objectId: string) => void;
        onObjectMove: (objectId: string, destination: Position) => void;
    };
    /** Non-creature summon/control records rendered as explicit map artifacts. */
    spellMapArtifacts?: SpellMapArtifacts;
    combatState: {
        turnManager: ReturnType<typeof useTurnManager>;
        turnState: ReturnType<typeof useTurnManager>["turnState"];
        abilitySystem: ReturnType<typeof useAbilitySystem>;
        isCharacterTurn: (id: string) => boolean;
        onCharacterUpdate: (character: CombatCharacter) => void;
    };
}
declare const BattleMap: React.FC<BattleMapProps>;
export default BattleMap;
