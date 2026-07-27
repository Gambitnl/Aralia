/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 21:54:55
 * Dependents: systems/spells/targeting/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { BattleMapData, CombatCharacter, Position, SelectedSpellTarget } from '@/types/combat';
/**
 * This file turns a clicked battle-map position into spell target references.
 *
 * The combat UI already knows which tile the player clicked, but object-targeting
 * spells need more detail than a tile coordinate. This helper preserves whether
 * that click selected a creature, a registered map object, or simply a ground
 * point so later action and command layers do not have to guess.
 *
 * Called by: future ability/target-selection hook wiring and current targeting
 * tests.
 * Depends on: BattleMapData.targetableObjects and the shared SelectedSpellTarget
 * envelope from combat types.
 */
export interface SelectedSpellTargetBuildInput {
    position: Position;
    characters: CombatCharacter[];
    mapData: BattleMapData | null;
    pointPurpose?: string;
}
export declare function buildSelectedSpellTargetsForPosition(input: SelectedSpellTargetBuildInput): SelectedSpellTarget[];
