// @dependencies-start
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
// @dependencies-end

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

interface CombatEventListenerRegistration {
    listener: CombatEventListener<AllCombatEvents>;
    priority: CombatEventPriority;
    phase: CombatEventPhase;
    order: number;
}

export class CombatEventEmitter {
    private listeners: Map<string, CombatEventListenerRegistration[]> = new Map();
    private listenerOrder = 0;
    private dispatchLog: CombatEventTraceEntry[] = [];
    private dispatchSequence = 0;

    // Listener dispatch is deterministic: phase order first, then high priority, then registration order.
    // This keeps old call sites stable while giving future replay/scheduling work a real ordering contract.
    static readonly phaseOrder: Record<CombatEventPhase, number> = {
        pre: 0,
        resolve: 1,
        post: 2
    };

    private static compareListenerPriority(
        a: CombatEventListenerRegistration,
        b: CombatEventListenerRegistration
    ): number {
        if (a.phase !== b.phase) {
            return CombatEventEmitter.phaseOrder[a.phase] - CombatEventEmitter.phaseOrder[b.phase];
        }

        if (a.priority !== b.priority) {
            return b.priority - a.priority;
        }

        return a.order - b.order;
    }

    on<T extends AllCombatEvents>(
        eventType: T['type'],
        listener: CombatEventListener<T>,
        options?: CombatEventListenerOptions
    ) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        const registrations = this.listeners.get(eventType);
        if (!registrations) return;

        registrations.push({
            listener: listener as CombatEventListener<AllCombatEvents>,
            priority: options?.priority ?? 0,
            phase: options?.phase ?? 'resolve',
            order: this.listenerOrder++
        });
    }

    onPre<T extends AllCombatEvents>(
        eventType: T['type'],
        listener: CombatEventListener<T>,
        options?: Omit<CombatEventListenerOptions, 'phase'>
    ) {
        this.on(eventType, listener, { ...options, phase: 'pre' });
    }

    off<T extends AllCombatEvents>(eventType: T['type'], listener: CombatEventListener<T>) {
        const listeners = this.listeners.get(eventType);
        if (listeners) {
            this.listeners.set(eventType, listeners.filter(({ listener: registeredListener }) => registeredListener !== listener));
        }
    }

    emit(event: AllCombatEvents) {
        // Capture the emitted event before listeners can mutate anything.
        // This keeps the trace stable enough for deterministic replay and postmortem inspection.
        this.dispatchLog.push(this.snapshotDispatchEvent(event));

        const listeners = this.listeners.get(event.type);
        if (listeners) {
            listeners
                .slice()
                .sort(CombatEventEmitter.compareListenerPriority)
                .forEach(({ listener }) => listener(event));
        }
    }

    getDispatchLog(): readonly CombatEventTraceEntry[] {
        // Return a fresh snapshot so callers can persist or compare the trace
        // without mutating the emitter's internal history.
        return structuredClone(this.dispatchLog);
    }

    createReplaySnapshot(): CombatEventReplaySnapshot {
        // Snapshot both the trace and the next sequence number so replay can
        // resume from the same point after a restore.
        return {
            events: structuredClone(this.dispatchLog),
            nextSequence: this.dispatchSequence
        };
    }

    restoreReplaySnapshot(snapshot: CombatEventReplaySnapshot): void {
        // Restoring a replay snapshot rehydrates the trace exactly as captured.
        // The caller still owns where it lives; this bus only defines the shape.
        this.dispatchLog = structuredClone(snapshot.events);
        this.dispatchSequence = snapshot.nextSequence;
    }

    getAttackResultsSince(sequenceStart: number, query: AttackResultQuery = {}): CombatAttackResult[] {
        const targetFilter = query.targetIds ? new Set(query.targetIds) : undefined;

        // Attack-result consumers need a machine-readable hit/miss feed, not
        // prose combat-log parsing. This method projects resolved attack events
        // into the same compact result shape used by CombatAction.attackResults
        // while letting callers isolate only the events emitted after their own
        // command/action snapshot.
        return this.dispatchLog
            .filter(event => event.seq >= sequenceStart)
            .filter((event): event is CombatEventTraceEntry & AttackEvent =>
                event.type === 'unit_attack' && typeof event.isHit === 'boolean'
            )
            .filter(event => !query.attackerId || event.attackerId === query.attackerId)
            .filter(event => !targetFilter || targetFilter.has(event.targetId))
            .map(event => ({
                targetId: event.targetId,
                isHit: event.isHit,
                isCritical: event.isCrit,
                attackType: event.attackType,
                weaponType: event.weaponType,
                rollResult: undefined,
                total: undefined
            }));
    }

    clearDispatchLog(): void {
        this.dispatchLog = [];
        this.dispatchSequence = 0;
    }

    onPost<T extends AllCombatEvents>(
        eventType: T['type'],
        listener: CombatEventListener<T>,
        options?: Omit<CombatEventListenerOptions, 'phase'>
    ) {
        this.on(eventType, listener, { ...options, phase: 'post' });
    }

    onResolve<T extends AllCombatEvents>(
        eventType: T['type'],
        listener: CombatEventListener<T>,
        options?: Omit<CombatEventListenerOptions, 'phase'>
    ) {
        this.on(eventType, listener, { ...options, phase: 'resolve' });
    }

    clearForTest(): void {
        this.listeners = new Map();
        this.listenerOrder = 0;
        this.clearDispatchLog();
    }

    private snapshotDispatchEvent(event: AllCombatEvents): CombatEventTraceEntry {
        return {
            ...structuredClone(event),
            seq: this.dispatchSequence++,
            priority: event.priority ?? 0,
            phase: event.phase ?? 'resolve'
        };
    }

    // Singleton instance
    private static instance: CombatEventEmitter;
    static getInstance(): CombatEventEmitter {
        if (!CombatEventEmitter.instance) {
            CombatEventEmitter.instance = new CombatEventEmitter();
        }
        return CombatEventEmitter.instance;
    }
}

export const combatEvents = CombatEventEmitter.getInstance();
