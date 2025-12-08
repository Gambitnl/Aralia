import { Position } from '../../types/combat';

export interface CombatEvent {
    type: string;
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
    isHit: boolean;
    isCrit: boolean;
    damage?: number;
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

type CombatEventListener<T extends CombatEvent> = (event: T) => void;

export class CombatEventEmitter {
    private listeners: Map<string, CombatEventListener<any>[]> = new Map();

    on<T extends AllCombatEvents>(eventType: T['type'], listener: CombatEventListener<T>) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType)?.push(listener);
    }

    off<T extends AllCombatEvents>(eventType: T['type'], listener: CombatEventListener<T>) {
        const listeners = this.listeners.get(eventType);
        if (listeners) {
            this.listeners.set(eventType, listeners.filter(l => l !== listener));
        }
    }

    emit(event: AllCombatEvents) {
        const listeners = this.listeners.get(event.type);
        if (listeners) {
            listeners.forEach(listener => listener(event));
        }
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
