/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 22/06/2026, 01:02:58
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file defines movable map objects for Tactical Sandbox scenarios.
 *
 * Object interaction is a separate mechanic from character movement and spell
 * targeting, so the preview keeps object records in one helper. The cover
 * torch still lives with the light helpers because it also owns a light source;
 * this file is for ordinary objects whose main proof is selection, movement,
 * and targetability.
 */
import type { BattleMapData, Position, TargetableMapObject } from '../../../types/combat';
export declare const OBJECT_INTERACTION_CRATE_ID = "object-interaction-crate";
export declare function createObjectInteractionCrate(): TargetableMapObject;
export declare function moveScenarioObject(mapData: BattleMapData, objectId: string, destination: Position): BattleMapData;
