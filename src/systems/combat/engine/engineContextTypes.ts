/**
 * @file systems/combat/engine/engineContextTypes.ts
 * The hook values each extracted engine rule used to close over (C2,
 * agora-9ed9.2). Field names match the hook's own names, so rule bodies read
 * them unchanged.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 24/10/2026, 22:14:42
 * Dependents: systems/combat/engine/concentrationBreak.ts, systems/combat/engine/damage.ts, systems/combat/engine/repeatSaves.ts, systems/combat/engine/tileEffects.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatCharacter, CombatLogEntry, BattleMapData, LightSource, Position } from '../../../types/combat';
import type { ActiveSpellZone } from '../../../systems/spells/effects';
import type { RepeatSaveRuntimeTiming } from './repeatSaves';

export type DamageTrigger = 'turn_start' | 'turn_end' | 'on_start_turn_in_area' | 'on_end_turn_in_area';

export type RepeatSaveRunner = (character: CombatCharacter, timing: RepeatSaveRuntimeTiming, actionEffectId?: string) => CombatCharacter;

export type DamageHandler = (
    character: CombatCharacter,
    amount: number,
    source: string,
    damageType?: string,
    currentTurnNumber?: number,
    sourceCharacter?: CombatCharacter,
    damageTrigger?: DamageTrigger,
) => CombatCharacter;

export interface RepeatSaveRunContext {
    characters: CombatCharacter[];
    mapData: BattleMapData | null;
    onLogEntry: (entry: CombatLogEntry) => void;
}

export interface ConcentrationBreakContext {
    activeLightSources?: LightSource[];
    characters: CombatCharacter[];
    mapData: BattleMapData | null;
    onActiveLightSourcesUpdate?: (lightSources: LightSource[]) => void;
    onCharacterUpdate: (character: CombatCharacter) => void;
    onLogEntry: (entry: CombatLogEntry) => void;
    spellZones: ActiveSpellZone[];
    /** The spell-zone setter of the hook; zones stay owned by the hook. A plain function type keeps React types out of systems/. */
    setSpellZones: (zones: ActiveSpellZone[]) => void;
}

export interface DamageResolutionContext {
    addDamageNumber: (value: number, position: Position, type: 'damage' | 'heal' | 'miss') => void;
    breakConcentrationThroughCommandLayer: (concentrator: CombatCharacter) => CombatCharacter;
    characters: CombatCharacter[];
    /** Optional deterministic d20 source for concentration saves triggered by hook-path damage (GG-261). */
    concentrationSaveRng?: () => number;
    onLogEntry: (entry: CombatLogEntry) => void;
    processRepeatSaves: RepeatSaveRunner;
    spellZones: ActiveSpellZone[];
}

export interface TileEffectContext {
    mapData: BattleMapData | null;
    handleDamage: DamageHandler;
    onLogEntry: (entry: CombatLogEntry) => void;
}
