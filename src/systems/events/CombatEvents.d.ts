/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 13/06/2026, 10:36:48
 * Dependents: commands/effects/ReactiveEffectCommand.ts, commands/factory/AbilityCommandFactory.ts, hooks/combat/useActionExecutor.ts, systems/spells/effects/AreaEffectTracker.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Position } from '../../types/combat';
export type CombatEventPhase = 'pre' | 'resolve' | 'post';
export type CombatEventPriority = number;
export interface CombatEvent {
    type: string;
    priority?: CombatEventPriority;
    phase?: CombatEventPhase;
}
export interface MovementEvent extends CombatEvent {
    type: 'unit_move';
    unitId: string;
    from: Position;
    to: Position;
    cost: number;
    isForced: boolean;
}
export interface AttackEvent extends CombatEvent {
    type: 'unit_attack';
    attackerId: string;
    targetId: string;
    isHit?: boolean;
    isCrit?: boolean;
    damage?: number;
    /**
     * Attack family facts preserved for reactive spell filters.
     * Armor of Agathys-style effects need to know whether a resolved hit was a
     * weapon, spell, or Unarmed Strike attack and whether it was melee, ranged,
     * or unarmed without parsing combat-log text or re-reading the original
     * ability object.
     */
    attackType?: 'weapon' | 'spell' | 'unarmed' | 'any';
    weaponType?: 'melee' | 'ranged' | 'unarmed' | 'any';
}
export interface CombatAttackResult {
    targetId: string;
    isHit: boolean;
    isCritical?: boolean;
    attackType?: AttackEvent['attackType'];
    weaponType?: AttackEvent['weaponType'];
    rollResult?: number;
    total?: number;
}
export interface AttackResultQuery {
    attackerId?: string;
    targetIds?: string[];
}
export interface CastEvent extends CombatEvent {
    type: 'unit_cast';
    casterId: string;
    spellId: string;
    targets: string[];
}
export interface SustainEvent extends CombatEvent {
    type: 'unit_sustain';
    casterId: string;
    spellId: string;
    actionType: 'action' | 'bonus_action' | 'reaction';
}
export interface ZoneEntryEvent extends CombatEvent {
    type: 'unit_enter_area';
    unitId: string;
    zoneId: string;
    spellId: string;
    position: Position;
}
export interface ZoneExitEvent extends CombatEvent {
    type: 'unit_exit_area';
    unitId: string;
    zoneId: string;
    spellId: string;
    position: Position;
}
export type AllCombatEvents = MovementEvent | AttackEvent | CastEvent | SustainEvent | ZoneEntryEvent | ZoneExitEvent;
export type CombatEventTraceEntry = AllCombatEvents & {
    seq: number;
    priority: CombatEventPriority;
    phase: CombatEventPhase;
};
export interface CombatEventReplaySnapshot {
    events: CombatEventTraceEntry[];
    nextSequence: number;
}
type CombatEventListener<T extends CombatEvent> = (event: T) => void;
type CombatEventListenerOptions = {
    priority?: CombatEventPriority;
    phase?: CombatEventPhase;
};
export declare class CombatEventEmitter {
    private listeners;
    private listenerOrder;
    private dispatchLog;
    private dispatchSequence;
    static readonly phaseOrder: Record<CombatEventPhase, number>;
    private static compareListenerPriority;
    on<T extends AllCombatEvents>(eventType: T['type'], listener: CombatEventListener<T>, options?: CombatEventListenerOptions): void;
    onPre<T extends AllCombatEvents>(eventType: T['type'], listener: CombatEventListener<T>, options?: Omit<CombatEventListenerOptions, 'phase'>): void;
    off<T extends AllCombatEvents>(eventType: T['type'], listener: CombatEventListener<T>): void;
    emit(event: AllCombatEvents): void;
    getDispatchLog(): readonly CombatEventTraceEntry[];
    createReplaySnapshot(): CombatEventReplaySnapshot;
    restoreReplaySnapshot(snapshot: CombatEventReplaySnapshot): void;
    getAttackResultsSince(sequenceStart: number, query?: AttackResultQuery): CombatAttackResult[];
    clearDispatchLog(): void;
    onPost<T extends AllCombatEvents>(eventType: T['type'], listener: CombatEventListener<T>, options?: Omit<CombatEventListenerOptions, 'phase'>): void;
    onResolve<T extends AllCombatEvents>(eventType: T['type'], listener: CombatEventListener<T>, options?: Omit<CombatEventListenerOptions, 'phase'>): void;
    clearForTest(): void;
    private snapshotDispatchEvent;
    private static instance;
    static getInstance(): CombatEventEmitter;
}
export declare const combatEvents: CombatEventEmitter;
export {};
