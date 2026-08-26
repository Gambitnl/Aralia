/**
 * @file src/systems/spells/effects/trigger/types.ts
 *
 * Shared trigger-domain record shapes for the spell trigger modules.
 *
 * WHY THIS EXISTS: split out of triggerHandler.ts (MOD-3.3) so
 * areaTriggerProcessing, effectConversion, and zoneLifecycle can each depend on
 * the record shapes without importing one another. Every interface here is
 * re-exported unchanged from triggerHandler.ts, so no importer moved.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 14:28:33
 * Dependents: systems/spells/effects/trigger/areaTriggerProcessing.ts, systems/spells/effects/trigger/effectConversion.ts, systems/spells/effects/trigger/zoneLifecycle.ts, systems/spells/effects/triggerHandler.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { SpellEffect, TargetFilter } from '../../../../types/spells';
import type { Position } from '../../../../types/combat';
import type { RepeatSave, EscapeCheck, ConditionBreakTrigger } from '../../../../types/spells';
import type { RecurringMechanic } from '../../../../types/spellEffectTypes';

/**
 * Represents an active spell zone on the battlefield (e.g., Create Bonfire)
 */
export interface ActiveSpellZone {
    id: string;
    spellId: string;
    casterId: string;
    position: Position;
    areaOfEffect?: { shape: string; size: number };
    /** Direction/orientation for directional zones such as Cone and Line. */
    direction?: Position;
    /** Spell save DC captured at cast time so delayed zone saves do not drift with later caster stat changes. */
    saveDC?: number;
    /** Source targeting is preserved so defensive auras can distinguish universal zones from ally-only ones. */
    targetingValidTargets?: TargetFilter[];
    effects: SpellEffect[];
    /** Track entities that have already triggered "first_per_turn" effects this turn */
    triggeredThisTurn: Set<string>;
    /** Track entities that should only ever trigger once (per creature) for this zone */
    triggeredEver: Set<string>;
    /** Remaining wall length for wall-shaped spells that shrink over time. */
    remainingWallLength?: number;
    /** Original wall length so UI/log consumers can compare current and starting size. */
    originalWallLength?: number;
    /** Whether this zone should disappear when its remaining wall length reaches zero. */
    endsWhenLengthZero?: boolean;
    expiresAtRound?: number;
}

/**
 * Stores spell effects that should fire on a future target turn rather than at
 * cast time. This is intentionally separate from repeat-save metadata: repeat
 * saves end statuses, while scheduled spell effects apply delayed payloads such
 * as damage or healing.
 */
export interface ScheduledSpellEffect {
    id: string;
    spellId: string;
    casterId: string;
    targetId: string;
    timing: 'turn_start' | 'turn_end';
    effects: SpellEffect[];
    createdAtRound: number;
    /** Exclusive round boundary: payloads never fire at or after this round. */
    expiresAtRound?: number;
    /** Spell save DC captured at cast time for delayed target-bound payloads. */
    saveDC?: number;
    /** Source-backed recurring payload selected for this scheduled timing. */
    recurringMechanic?: RecurringMechanic;
}

/**
 * Represents a movement-triggered debuff on a target (e.g., Booming Blade)
 */
export interface MovementTriggerDebuff {
    id: string;
    spellId: string;
    casterId: string;
    targetId: string;
    effects: SpellEffect[];
    expiresAtRound: number;
    hasTriggered: boolean;
    /** Spell save DC captured when the movement-triggered debuff was created. */
    saveDC?: number;
}

export interface MovementTriggerContext {
    previousPosition?: Position;
    movementType?: 'willing' | 'forced' | 'teleport';
}

/**
 * Result of processing a trigger
 */
export interface TriggerResult {
    triggered: boolean;
    effects: ProcessedEffect[];
    sourceId?: string;
    triggerType?: 'on_enter_area' | 'on_exit_area' | 'on_start_turn_in_area' | 'on_end_turn_in_area' | 'on_move_in_area' | 'on_entity_proximity' | 'on_target_move';
}

export interface ProcessedEffectSourceContext {
    spellId: string;
    casterId: string;
    saveDC?: number;
}

export interface ProcessedEffect {
    type: 'damage' | 'heal' | 'status_condition';
    value?: number;
    dice?: string;
    damageType?: string;
    statusName?: string;
    /** Original status duration so delayed/area trigger consumers do not invent timing. */
    duration?: any;
    requiresSave?: boolean;
    saveType?: string;
    saveEffect?: string;
    repeatSave?: RepeatSave;
    escapeCheck?: EscapeCheck;
    breakTriggers?: ConditionBreakTrigger[];
    /**
     * Carries the original spell/caster identity through delayed trigger
     * processing. Area and movement triggers can fire long after the cast, so
     * downstream handlers should not guess save DCs from the target.
     */
    sourceContext?: ProcessedEffectSourceContext;
}
