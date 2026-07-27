/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 23:23:38
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { CombatCharacter, CombatLogEntryInput, CombatState, Position, BattleMapData } from '../types/combat';
import { MovementEffect } from '../types/spells';
export interface SpellMovementVisualInput {
    spellId: string;
    targetId: string;
    type: 'teleport' | 'forced_movement';
    from: Position;
    to: Position;
    path: Position[];
}
export declare const getMovementVisualType: (effects: MovementEffect[]) => SpellMovementVisualInput["type"];
export declare const isForcedMovementForRepeatSave: (effect: MovementEffect) => boolean;
export declare const repeatSaveHasRuntimeTiming: (repeatSave: NonNullable<CombatCharacter["statusEffects"][number]["repeatSave"]>, timing: "after_forced_movement") => boolean;
export declare const getRepeatSaveRuntimeDc: (repeatSave: NonNullable<CombatCharacter["statusEffects"][number]["repeatSave"]>) => number;
export declare const appendImmediateRepeatSaveLog: (state: CombatState, entry: CombatLogEntryInput) => CombatState;
export declare const resolveImmediateAfterForcedMovementRepeatSaves: (state: CombatState, originalTargets: CombatCharacter[], movementEffects: MovementEffect[]) => CombatState;
export declare const buildResolvedMovementVisualPath: (mapData: BattleMapData | null, from: Position, to: Position, visualType: SpellMovementVisualInput["type"]) => Position[];
