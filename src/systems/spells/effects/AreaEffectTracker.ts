// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 22:33:25
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
// TODO: `processEntry`/`processExit`/`processEndTurn` in this class **duplicate** the logic
// found in `processAreaEntryTriggers`/`processAreaExitTriggers`/`processAreaEndTurnTriggers`
// in `triggerHandler.ts`. This violates DRY and risks drift.
// Options:
// 1. Have `AreaEffectTracker` delegate to the standalone functions in `triggerHandler.ts`.
// 2. Deprecate the standalone functions and make `AreaEffectTracker` the single source of truth.
// Recommend Option 2 for cleaner architecture.

import { combatEvents } from '../../events/CombatEvents';
import {
    isPositionInArea,
    processAreaEntryTriggers,
    processAreaExitTriggers,
    processAreaEndTurnTriggers,
    processAreaMoveWithinTriggers,
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

        return results;
    }

    /**
     * Process triggers when a character moves within an area.
     * Used by spells like Spike Growth that damage "for every 5 feet traveled within the area".
     * TODO(Analyst): Migrate Spike Growth and similar spells from simple 'TERRAIN' effects to use this 'on_move_in_area' Zone capability.
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
        // TODO(lint-intent): 'currentRound' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
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
        // TODO(lint-intent): 'currentRound' is an unused parameter, which suggests a planned input for this flow.
        // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
        // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
        _currentRound: number
    ): TriggerResult[] {
        // End-turn zone effects have no tracker-specific event to emit today,
        // so the tracker can fully delegate this decision path to the shared
        // trigger handler and preserve one source of truth for frequency gates,
        // target filters, legacy `turn_end`, and source context.
        return processAreaEndTurnTriggers(this.zones, character, _currentRound);
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
