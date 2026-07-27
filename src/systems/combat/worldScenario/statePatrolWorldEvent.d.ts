/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 03:22:10
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file decides when a generated state's patrol recognizes and intercepts
 * the party inside a real WorldForge settlement.
 *
 * The patrol event is deliberately deterministic. It requires the player to be
 * inside the source town's ground envelope, a real stationed land regiment, and
 * a hostile standing with that exact generated state. A save-backed receipt
 * then limits the event to once per settlement per game day, so returning from
 * combat cannot immediately launch the same fight again.
 *
 * Called by: World3DWrapper while the player moves through a live GroundWorld
 * Depends on: settlement defense facts and the shared hostility referee
 */
import type { PlayerFactionStanding } from '@/types/factions';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { GroundSettlementDefense } from '@/systems/worldforge/bridge/settlementDefense';
import { type SettlementEncounterTrigger } from './settlementEncounterHostility';
import type { StatePatrolEncounterReceipt, WorldforgeEncounterReceipt } from './worldforgeEncounterReceipt';
export type { WorldforgeEncounterReceipt } from './worldforgeEncounterReceipt';
export interface StatePatrolWorldEvent {
    id: string;
    trigger: Extract<SettlementEncounterTrigger, {
        kind: 'state-confrontation';
    }>;
    receipt: StatePatrolEncounterReceipt;
    defense: GroundSettlementDefense;
    standing: PlayerFactionStanding;
    distanceFromTownCenterM: number;
    recognitionRadiusM: number;
}
export interface StatePatrolWorldEventInput {
    worldSeed: number;
    gameDay: number;
    gameTimeMs: number;
    playerGroundMeters: {
        x: number;
        z: number;
    };
    playerFactionStandings: Readonly<Record<string, PlayerFactionStanding>>;
    receipts?: readonly Pick<WorldforgeEncounterReceipt, 'id'>[];
}
export declare const STATE_PATROL_RECOGNITION_MARGIN_M = 6;
/** Build the stable once-per-day identity shared by the event and save receipt. */
export declare function statePatrolWorldEventId(worldSeed: number, defense: Pick<GroundSettlementDefense, 'sourceCellId' | 'burgId' | 'stateId'>, gameDay: number): string;
/**
 * Find the nearest eligible generated-state patrol event at the player's exact
 * ground position. The shared hostility referee remains the final authority;
 * this scan only supplies it with the explicit world-event trigger.
 */
export declare function findStatePatrolWorldEvent(ground: GroundWorld, input: StatePatrolWorldEventInput): StatePatrolWorldEvent | null;
