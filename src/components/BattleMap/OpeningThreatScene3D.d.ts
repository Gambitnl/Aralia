/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 10:29:01
 * Dependents: components/BattleMap/BattleMap3D.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file OpeningThreatScene3D.tsx
 *
 * Renders the same saved monster site, terrain memory, ecological traces, and
 * resolved bodies that the 2D battle map consumes. Every anchor comes from the
 * opening encounter context. The meshes add volume and material only; they do
 * not invent placement, identity, or outcome state.
 *
 * Deliberate boundary: active opening creatures continue through CharacterActor
 * because they are combatants. This layer renders bodies only after a receipt is
 * resolved, preventing static scene geometry from duplicating initiative actors.
 */
import React from "react";
import type { BattleMapData, BattleMapEncounterContext, BattleMapOpeningThreatEntity, Position } from "../../types/combat";
type OpeningContext = Extract<BattleMapEncounterContext, {
    kind: "opening-standoff";
}>;
type GroundSampler = (tileX: number, tileZ: number) => number;
export interface OpeningThreatScene3DFacts {
    context: OpeningContext;
    resolvedBodies: BattleMapOpeningThreatEntity[];
    focus: Position;
    siteCondition: "occupied" | "abandoned-disturbed" | "held-disturbed";
}
interface OpeningThreatScene3DProps {
    mapData: BattleMapData;
    groundSampler?: GroundSampler | null;
}
/**
 * Select the exact scene facts a 3D renderer may consume.
 *
 * Keeping this pure gives parity tests a strict boundary: an unresolved scene
 * has no static bodies, while a resolved return may only show entities whose
 * saved outcome leaves a physical presence at the location.
 */
export declare function selectOpeningThreatScene3DFacts(mapData: BattleMapData): OpeningThreatScene3DFacts | null;
/** Render all static opening-scene facts from one shared tactical read model. */
declare const OpeningThreatScene3D: React.FC<OpeningThreatScene3DProps>;
export default OpeningThreatScene3D;
