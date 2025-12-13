export interface AttackEvent {
    attackerId: string;
    targetId: string;
    attackType: 'weapon' | 'spell' | 'unarmed';
    weaponType?: 'melee' | 'ranged';
    isCancelled: boolean;
    redirectTargetId?: string; // For spells like sanctuary that can redirect attacks
}

type AttackListener = (event: AttackEvent) => void | Promise<void>;

export class AttackEventEmitter {
    private listeners: AttackListener[] = [];
    private preAttackListeners: AttackListener[] = [];

    /**
     * Register a listener that gets called BEFORE an attack occurs
     * Listeners can cancel the attack or redirect it
     */
    onPreAttack(listener: AttackListener): void {
        this.preAttackListeners.push(listener);
    }

    /**
     * Register a listener that gets called AFTER an attack occurs
     */
    onAttack(listener: AttackListener): void {
        this.listeners.push(listener);
    }

    /**
     * Remove a pre-attack listener
     */
    offPreAttack(listener: AttackListener): void {
        this.preAttackListeners = this.preAttackListeners.filter(l => l !== listener);
    }

    /**
     * Remove a post-attack listener
     */
    offAttack(listener: AttackListener): void {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    /**
     * Emit a pre-attack event. Call this when a creature attempts to attack.
     * Returns the event after all pre-attack listeners have processed it.
     * The attack should be cancelled if event.isCancelled is true, or redirected
     * to event.redirectTargetId if set.
     */
    async emitPreAttack(
        attackerId: string,
        targetId: string,
        attackType: 'weapon' | 'spell' | 'unarmed',
        weaponType?: 'melee' | 'ranged'
    ): Promise<AttackEvent> {
        const event: AttackEvent = {
            attackerId,
            targetId,
            attackType,
            weaponType,
            isCancelled: false
        };

        // Call all pre-attack listeners
        for (const listener of this.preAttackListeners) {
            await listener(event);
            // Continue processing even if cancelled - all listeners should have a chance to respond
        }

        return event;
    }

    /**
     * Emit a post-attack event. Call this after an attack has occurred (whether it hit or missed).
     */
    async emitAttack(
        attackerId: string,
        targetId: string,
        attackType: 'weapon' | 'spell' | 'unarmed',
        weaponType?: 'melee' | 'ranged'
    ): Promise<void> {
        const event: AttackEvent = {
            attackerId,
            targetId,
            attackType,
            weaponType,
            isCancelled: false
        };

        // Call all post-attack listeners
        for (const listener of this.listeners) {
            await listener(event);
        }
    }

    // Singleton instance
    private static instance: AttackEventEmitter;
    static getInstance(): AttackEventEmitter {
        if (!AttackEventEmitter.instance) {
            AttackEventEmitter.instance = new AttackEventEmitter();
        }
        return AttackEventEmitter.instance;
    }
}

export const attackEvents = AttackEventEmitter.getInstance();






