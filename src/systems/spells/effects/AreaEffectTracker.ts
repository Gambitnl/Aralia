// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 21:41:20
 * Dependents: hooks/combat/engine/useCombatEngine.ts, hooks/combat/useActionExecutor.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/systems/spells/effects/AreaEffectTracker.ts
 * 
 * Centralized tracking for active spell zones.
 * Manages entry, exit, and end-of-turn triggers for area effects.
 * Emits combat events for zone interactions.
 */
// RESOLVED 2026-09-09 (was TODO #951, "processEntry/processExit/processEndTurn duplicate
// triggerHandler"). WHAT CHANGED: nothing today; the marker was stale. WHY IT IS GONE: every
// public method on this class already delegates its effect decision to the shared trigger
// functions re-exported from `triggerHandler.ts` (now living in `./trigger/areaTriggerProcessing.ts`) --
// `processEntry`/`processExit` call `processAreaEntryTriggers`/`processAreaExitTriggers`,
// `processEndTurn` calls `processAreaEndTurnTriggers` plus `processAreaProximityTriggers`,
// `processStartTurn` calls `processAreaStartTurnTriggers`, and `processMovementWithin` calls
// `processAreaMoveWithinTriggers`. Effect filtering, frequency gates, target filters, and
// source context therefore have one implementation, not two.
// WHAT IS PRESERVED: the division of labour that made the tracker worth keeping. The tracker
// owns `combatEvents` emission (`unit_enter_area`/`unit_exit_area`) and the zone list; the
// shared functions own the rules. That is why `processEntry`/`processExit` still evaluate
// `isPositionInArea` themselves: the boundary crossing gates the EVENT, and the delegate then
// re-derives it to gate the EFFECTS. The duplicated predicate call is deliberate and cheap;
// collapsing it would require the shared functions to emit combat events, which would couple
// pure trigger math to the event bus.
// STILL DEFERRED: nothing for this marker. Zone geometry accuracy is tracked separately (GG-201).

import { combatEvents } from '../../events/CombatEvents';
import {
    isPositionInArea,
    processAreaEntryTriggers,
    processAreaExitTriggers,
    processAreaEndTurnTriggers,
    processAreaStartTurnTriggers,
    processAreaMoveWithinTriggers,
    processAreaProximityTriggers,
    ActiveSpellZone,
    TriggerResult
} from './triggerHandler';
import { CombatCharacter, Position } from '../../../types/combat';

export class AreaEffectTracker {
    private zones: ActiveSpellZone[] = [];

    constructor(initialZones: ActiveSpellZone[] = []) {
        this.zones = initialZones;
    }

    /**
     * Update the list of active zones.
     */
    public setZones(zones: ActiveSpellZone[]) {
        this.zones = zones;
    }

    /**
     * Get current active zones.
     */
    public getZones(): ActiveSpellZone[] {
        return this.zones;
    }

    /**
     * Handle character movement events, processing both exit and entry triggers.
     * Use this when a character completes a move step.
     */
    public handleMovement(
        character: CombatCharacter,
        newPosition: Position,
        previousPosition: Position,
        currentRound: number,
        movementPath?: Position[]
    ): TriggerResult[] {
        const results: TriggerResult[] = [];

        // Process Exits first
        const exitResults = this.processExit(character, newPosition, previousPosition);
        results.push(...exitResults);

        // Process Entries second
        const entryResults = this.processEntry(character, newPosition, previousPosition, currentRound);
        results.push(...entryResults);

        // Process Movement Within third
        const movementResults = this.processMovementWithin(character, newPosition, previousPosition, movementPath);
        results.push(...movementResults);

        // Source-backed proximity mechanics fire when a creature enters the
        // threat radius. Their recurring payload is resolved by the same
        // caller that already handles ordinary area-trigger results.
        results.push(...processAreaProximityTriggers(this.zones, character, newPosition, previousPosition));

        return results;
    }

    /**
     * Process triggers when a character moves within an area.
     * Used by spells like Spike Growth that damage "for every 5 feet traveled within the area".
     * RESOLVED 2026-09-13 (was TODO #952, then DEFERRED as GG-204). WHAT CHANGED: the missing half
     * was DATA, and it landed. `public/data/spells/level-2/spike-growth.json` now carries a third
     * effect row -- `type: "DAMAGE"`, `trigger.type: "on_move_in_area"`, `damage 2d4 Piercing` --
     * so `processAreaMoveWithinTriggers` emits one 2d4 packet per five-foot step traveled inside
     * the sphere. The two original `TERRAIN` rows are untouched: they still create the damaging
     * and difficult terrain at cast time, which is why the damage was ADDED as its own row rather
     * than migrated onto a TERRAIN row (`convertSpellEffectToProcessed` has no TERRAIN branch and
     * would drop the payload). Proof: `src/systems/spells/effects/__tests__/spikeGrowthMoveTrigger.test.ts`
     * moves a token 10 ft inside the zone and asserts 4d4 total.
     * CORPUS AUDIT (2026-09-13): Spike Growth is the only spell in `public/data/spells` whose text
     * charges damage per distance traveled. Every other damaging-terrain spell (cloud of daggers,
     * moonbeam, wall of fire, spirit guardians, Evard's black tentacles, grease, create bonfire)
     * damages on ENTRY or TURN END, and each already carries the matching
     * `on_enter_area` / `on_end_turn_in_area` / composite trigger, so none gained `on_move_in_area`.
     */
    public processMovementWithin(
        character: CombatCharacter,
        newPosition: Position,
        previousPosition: Position,
        movementPath?: Position[]
    ): TriggerResult[] {
        // Movement-within effects now share the same triggerHandler decision
        // path as entry, exit, and end-turn effects. This keeps per-tile damage,
        // frequency gates, target filters, and source context from drifting.
        return processAreaMoveWithinTriggers(this.zones, character, newPosition, previousPosition, movementPath);
    }

    /**
     * Process triggers when a character enters an area.
     * Emits `unit_enter_area` event.
     */
    public processEntry(
        character: CombatCharacter,
        newPosition: Position,
        previousPosition: Position,
        _currentRound: number
    ): TriggerResult[] {
        const results: TriggerResult[] = [];

        for (const zone of this.zones) {
            if (!zone.areaOfEffect) continue;

            const wasInZone = isPositionInArea(previousPosition, zone.position, zone.areaOfEffect, zone.direction);
            const isNowInZone = isPositionInArea(newPosition, zone.position, zone.areaOfEffect, zone.direction);

            if (!wasInZone && isNowInZone) {
                // Emit event regardless of whether there are effects
                combatEvents.emit({
                    type: 'unit_enter_area',
                    unitId: character.id,
                    zoneId: zone.id,
                    spellId: zone.spellId,
                    position: newPosition
                });
                // Keep AreaEffectTracker responsible for combat events, but
                // share effect filtering/frequency/source-context behavior
                // with triggerHandler so the two area-trigger paths cannot
                // drift apart.
                results.push(...processAreaEntryTriggers([zone], character, newPosition, previousPosition, _currentRound));
            }
        }

        return results;
    }

    /**
     * Process triggers when a character exits an area.
     * Emits `unit_exit_area` event.
     */
    public processExit(
        character: CombatCharacter,
        newPosition: Position,
        previousPosition: Position
    ): TriggerResult[] {
        const results: TriggerResult[] = [];

        for (const zone of this.zones) {
            if (!zone.areaOfEffect) continue;

            const wasInZone = isPositionInArea(previousPosition, zone.position, zone.areaOfEffect, zone.direction);
            const isNowInZone = isPositionInArea(newPosition, zone.position, zone.areaOfEffect, zone.direction);

            if (wasInZone && !isNowInZone) {
                // Emit event
                combatEvents.emit({
                    type: 'unit_exit_area',
                    unitId: character.id,
                    zoneId: zone.id,
                    spellId: zone.spellId,
                    position: newPosition
                });
                // Event emission stays here, while effect filtering delegates
                // to the shared trigger handler used by compatibility callers.
                results.push(...processAreaExitTriggers([zone], character, newPosition, previousPosition));
            }
        }

        return results;
    }

    /**
     * Process triggers when a character ends their turn in an area.
     */
    public processEndTurn(
        character: CombatCharacter,
        _currentRound: number
    ): TriggerResult[] {
        // End-turn zone effects have no tracker-specific event to emit today,
        // so the tracker can fully delegate this decision path to the shared
        // trigger handler and preserve one source of truth for frequency gates,
        // target filters, legacy `turn_end`, and source context.
        return [
            ...processAreaEndTurnTriggers(this.zones, character, _currentRound),
            ...processAreaProximityTriggers(this.zones, character, character.position, undefined, true)
        ];
    }

    /** Process turn-start effects for a creature currently inside each zone. */
    public processStartTurn(
        character: CombatCharacter,
        _currentRound: number
    ): TriggerResult[] {
        return processAreaStartTurnTriggers(this.zones, character, _currentRound);
    }

    /**
     * Reset turn-based tracking for all managed zones.
     */
    public resetTurnTracking() {
        for (const zone of this.zones) {
            zone.triggeredThisTurn.clear();
        }
    }
}
