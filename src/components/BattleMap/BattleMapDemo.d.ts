/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:58:07
 * Dependents: components/BattleMap/index.ts, components/DesignPreview/steps/PreviewBattleMap.tsx, components/DesignPreview/steps/PreviewBattleMapScenarioLab.tsx
 * Imports: 26 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file BattleMapDemo.tsx
 * This component serves as a playable demonstration and test environment for
 * both the legacy procedural arena and real WorldForge-derived tactical maps.
 * It owns the same turn, targeting, roster, rail, and 2D/3D controls used by
 * combat so design-preview harnesses exercise real behavior instead of a mock.
 */
import React from "react";
import { PlayerCharacter } from "../../types";
import { BattleMapData, CombatCharacter } from "../../types/combat";
interface BattleMapDemoProps {
    onExit: () => void;
    initialCharacters: CombatCharacter[];
    party: PlayerCharacter[];
    /** A real extracted battlefield supplied by a scenario harness or handoff. */
    initialMapData?: BattleMapData;
    /** False keeps the source location authoritative and hides arena generation. */
    allowSandboxGeneration?: boolean;
    /** False lets a resolved source site mount without inventing active enemies. */
    allowFallbackEnemies?: boolean;
    /** Compact provenance label shown in place of the sandbox biome picker. */
    sourceLabel?: string;
    /** Let a debug harness open on the whole map instead of the production token-size floor. */
    preferFullMapFit?: boolean;
    /** Lab-owned review layer for explicit source object facts. */
    showTargetableObjectFacts?: boolean;
    /** Lab-owned review layer for source-backed noncombat residents. */
    showWorldOccupants?: boolean;
    /**
     * Dev/review affordance forwarded to the 2D board: shows the render-only
     * fog-of-war veil toggle chip. Off by default; only the design lab opts in so
     * the chip never reaches real-game combat.
     */
    showFogToggle?: boolean;
}
declare const BattleMapDemo: React.FC<BattleMapDemoProps>;
export default BattleMapDemo;
