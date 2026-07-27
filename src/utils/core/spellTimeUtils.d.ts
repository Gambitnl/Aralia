/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 00:55:31
 * Dependents: state/reducers/ritualReducer.ts, systems/rituals/RitualManager.ts, utils/core/index.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { CastingTime, Spell } from '../../types/spells.js';
/**
 * This file translates spell casting-time semantics into runtime-friendly numbers.
 *
 * Aralia keeps spell source data in game-language terms such as "action", "reaction",
 * "minute", and "hour". The ritual system, gate checker, and future combat/world timers
 * still need numeric values for progress math, so this file converts those spell facts
 * into seconds and rounds without erasing the original meaning of the spell.
 *
 * Called by: RitualManager and any future runtime system that needs to move between
 * spell semantics and time math. Depends on: the core Spell/CastingTime type definitions.
 */
export declare const ROUND_DURATION_SECONDS = 6;
export declare const RITUAL_CASTING_BONUS_SECONDS: number;
export type SpellTimeDisplayUnit = 'seconds' | 'rounds' | 'minutes' | 'hours';
export interface SpellTimeTranslation {
    semanticUnit: CastingTime['unit'];
    displayUnit: SpellTimeDisplayUnit;
    displayValue: number;
    seconds: number | null;
    rounds: number | null;
    isTriggered: boolean;
    isSpecial: boolean;
}
export declare function canSpellBeCastAsRitual(spell: Pick<Spell, 'ritual' | 'tags'>): boolean;
export declare function getCastingTimeTranslation(castingTime: CastingTime): SpellTimeTranslation;
export declare function getSpellCastingDurationSeconds(spell: Pick<Spell, 'castingTime' | 'ritual' | 'tags'>, asRitual?: boolean): number | null;
export declare function getSpellCastingDurationRounds(spell: Pick<Spell, 'castingTime' | 'ritual' | 'tags'>, asRitual?: boolean): number | null;
export declare function getDisplayUnitForSeconds(totalSeconds: number, preferredUnit?: CastingTime['unit']): SpellTimeDisplayUnit;
export declare function convertSecondsToDisplayValue(totalSeconds: number, unit: SpellTimeDisplayUnit): number;
