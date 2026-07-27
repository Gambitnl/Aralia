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
import { ActiveSpellZone, TriggerResult } from './triggerHandler';
import { CombatCharacter, Position } from '../../../types/combat';
export declare class AreaEffectTracker {
    private zones;
    constructor(initialZones?: ActiveSpellZone[]);
    /**
     * Update the list of active zones.
     */
    setZones(zones: ActiveSpellZone[]): void;
    /**
     * Get current active zones.
     */
    getZones(): ActiveSpellZone[];
    /**
     * Handle character movement events, processing both exit and entry triggers.
     * Use this when a character completes a move step.
     */
    handleMovement(character: CombatCharacter, newPosition: Position, previousPosition: Position, currentRound: number, movementPath?: Position[]): TriggerResult[];
    /**
     * Process triggers when a character moves within an area.
     * Used by spells like Spike Growth that damage "for every 5 feet traveled within the area".
     * TODO #952(Analyst): Migrate Spike Growth and similar spells from simple 'TERRAIN' effects to use this 'on_move_in_area' Zone capability.
     */
    processMovementWithin(character: CombatCharacter, newPosition: Position, previousPosition: Position, movementPath?: Position[]): TriggerResult[];
    /**
     * Process triggers when a character enters an area.
     * Emits `unit_enter_area` event.
     */
    processEntry(character: CombatCharacter, newPosition: Position, previousPosition: Position, _currentRound: number): TriggerResult[];
    /**
     * Process triggers when a character exits an area.
     * Emits `unit_exit_area` event.
     */
    processExit(character: CombatCharacter, newPosition: Position, previousPosition: Position): TriggerResult[];
    /**
     * Process triggers when a character ends their turn in an area.
     */
    processEndTurn(character: CombatCharacter, _currentRound: number): TriggerResult[];
    /** Process turn-start effects for a creature currently inside each zone. */
    processStartTurn(character: CombatCharacter, _currentRound: number): TriggerResult[];
    /**
     * Reset turn-based tracking for all managed zones.
     */
    resetTurnTracking(): void;
}
