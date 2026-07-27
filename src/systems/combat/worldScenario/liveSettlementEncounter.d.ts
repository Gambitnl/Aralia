/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 09:55:18
 * Dependents: components/World3D/World3DWrapper.tsx, systems/combat/worldScenario/worldBattleScenario.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file frames a live settlement confrontation on an already-extracted
 * WorldForge tactical map.
 *
 * The deterministic scenario lab owns authored camera recipes such as a gate
 * approach. Production combat instead starts where the player is standing, so
 * this adapter finds the generated town and defending regiment that match the
 * confrontation, preserves the hostility receipt, and describes a watch force
 * intercepting the party at the center of the live crop.
 *
 * Called by: World3DWrapper's active GroundWorld combat provider
 * Depends on: settlement hostility and regiment projection policies
 */
import type { BattleMapData, BattleMapDefendingForce } from '@/types/combat';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { type SettlementEncounterHostilityInput } from './settlementEncounterHostility';
export type LiveSettlementEncounterStatus = 'ready' | 'withheld' | 'source-gap' | 'not-applicable';
export interface LiveSettlementEncounterProjection {
    status: LiveSettlementEncounterStatus;
    detail: string;
    mapData: BattleMapData;
    defendingForce?: BattleMapDefendingForce;
}
export declare function projectLiveSettlementEncounter(ground: GroundWorld, mapData: BattleMapData, playerWorldMeters: {
    x: number;
    z: number;
}, hostilityInput: SettlementEncounterHostilityInput): LiveSettlementEncounterProjection;
