/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 01:45:42
 * Dependents: components/World3D/DungeonExpeditionOverlay.tsx
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { Cell, DungeonPlan } from '../types';
import { type DungeonIdentity } from './dungeonIdentity';
import type { DungeonLevelVisitReceipt } from './dungeonLifecycle';
export declare const DUNGEON_LEVEL_COUNT = 3;
export declare function dungeonLevelId(depth: number): string;
export interface DungeonLevelIdentity extends DungeonIdentity {
    rootDungeonId: string;
    levelId: string;
    depth: number;
    parentLevelId: string | null;
}
/** Derive a stable child receipt while preserving the entrance identity unchanged at level zero. */
export declare function dungeonLevelIdentity(rootIdentity: DungeonIdentity, depth: number): DungeonLevelIdentity;
export declare function generateDungeonLevelPlan(rootIdentity: DungeonIdentity, depth: number, expectedWorldSeed?: number): DungeonPlan;
export type DungeonVerticalFeatureKind = 'stairs-up' | 'stairs-down' | 'boss' | 'overlook';
export interface DungeonVerticalFeature {
    id: string;
    kind: DungeonVerticalFeatureKind;
    label: string;
    cell: Cell;
    roomId: number;
}
export interface DungeonLevelDescriptor {
    identity: DungeonLevelIdentity;
    plan: DungeonPlan;
    entryCell: Cell;
    parentReturnCell: Cell | null;
    upTransition: DungeonVerticalFeature | null;
    downTransition: DungeonVerticalFeature | null;
    bossObjective: DungeonVerticalFeature | null;
    verticalSight: DungeonVerticalFeature | null;
}
/** Describe one generated page and its deterministic links to adjacent pages. */
export declare function describeDungeonLevel(rootIdentity: DungeonIdentity, depth: number, plan: DungeonPlan, parentReturnCell?: Cell | null): DungeonLevelDescriptor;
/** Build a complete deterministic stack while reusing the already-mounted surface plan. */
export declare function buildDungeonLevelStack(rootIdentity: DungeonIdentity, surfacePlan: DungeonPlan, expectedWorldSeed?: number): DungeonLevelDescriptor[];
/** Serialize only compact identity and navigation evidence into the root expedition ledger. */
export declare function dungeonLevelVisitReceipt(level: DungeonLevelDescriptor): DungeonLevelVisitReceipt;
