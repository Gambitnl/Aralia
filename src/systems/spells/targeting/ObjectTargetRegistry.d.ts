/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 22:20:02
 * Dependents: systems/spells/targeting/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { TargetableObject } from './TargetResolver';
import type { BattleMapData, Position } from '@/types/combat';
import type { RoomFeature } from '@/types/dungeon';
import type { Item } from '@/types/items';
/**
 * This file collects positioned object candidates for spell targeting.
 *
 * The target resolver can already validate an object once something supplies a
 * real object envelope. This adapter is the narrow bridge between combat/map
 * state and that resolver: it accepts explicit positioned objects, refuses to
 * infer mechanics from visual decorations, and returns stable candidates that
 * object-targeting spells can validate.
 *
 * Called by: future combat selection hooks and current focused object-targeting
 * tests.
 * Depends on: TargetResolver's TargetableObject shape.
 */
export interface ObjectTargetRegistryMapSource {
    targetableObjects?: TargetableObject[];
}
export interface PositionedRoomFeatureTarget {
    feature: RoomFeature;
    position: Position;
    targetFacts?: Omit<TargetableObject, 'id' | 'name' | 'position'>;
}
export interface PositionedLooseItemTarget {
    item: Item;
    position: Position;
    instanceId?: string;
    size?: string;
    isWornOrCarried?: boolean;
    isFixedToSurface?: boolean;
}
export interface ObjectTargetRegistryInput {
    mapData?: ObjectTargetRegistryMapSource | null;
    explicitObjects?: TargetableObject[];
    roomFeatures?: PositionedRoomFeatureTarget[];
    looseItems?: PositionedLooseItemTarget[];
}
export declare function collectObjectTargetCandidates(input: ObjectTargetRegistryInput): TargetableObject[];
export declare function withObjectTargetCandidates(mapData: BattleMapData, input: Omit<ObjectTargetRegistryInput, 'mapData'>): BattleMapData;
