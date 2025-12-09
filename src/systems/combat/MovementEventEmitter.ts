import { Position } from '../../types/combat';

export interface MovementEvent {
    creatureId: string;
    from: Position;
    to: Position;
    movementType: 'willing' | 'forced';
    distance: number;
    isCancelled: boolean;
}

type MovementListener = (event: MovementEvent) => void | Promise<void>;

export class MovementEventEmitter {
    private listeners: MovementListener[] = [];
    private preMovementListeners: MovementListener[] = [];

    /**
     * Register a listener that gets called BEFORE movement occurs
     * Listeners can cancel movement by setting event.isCancelled = true
     */
    onPreMovement(listener: MovementListener): void {
        this.preMovementListeners.push(listener);
    }

    /**
     * Register a listener that gets called AFTER movement occurs
     */
    onMovement(listener: MovementListener): void {
        this.listeners.push(listener);
    }

    /**
     * Remove a pre-movement listener
     */
    offPreMovement(listener: MovementListener): void {
        this.preMovementListeners = this.preMovementListeners.filter(l => l !== listener);
    }

    /**
     * Remove a post-movement listener
     */
    offMovement(listener: MovementListener): void {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    /**
     * Emit a movement event. Call this when a creature attempts to move.
     * Returns the event after all pre-movement listeners have processed it.
     */
    async emitPreMovement(
        creatureId: string,
        from: Position,
        to: Position,
        movementType: 'willing' | 'forced'
    ): Promise<MovementEvent> {
        const distance = Math.sqrt(
            Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)
        );

        const event: MovementEvent = {
            creatureId,
            from,
            to,
            movementType,
            distance,
            isCancelled: false
        };

        // Call all pre-movement listeners
        for (const listener of this.preMovementListeners) {
            await listener(event);
            if (event.isCancelled) break; // Stop processing if movement is cancelled
        }

        return event;
    }

    /**
     * Emit a post-movement event. Call this after movement has successfully occurred.
     */
    async emitMovement(
        creatureId: string,
        from: Position,
        to: Position,
        movementType: 'willing' | 'forced'
    ): Promise<void> {
        const distance = Math.sqrt(
            Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)
        );

        const event: MovementEvent = {
            creatureId,
            from,
            to,
            movementType,
            distance,
            isCancelled: false
        };

        // Call all post-movement listeners
        for (const listener of this.listeners) {
            await listener(event);
        }
    }

    // Singleton instance
    private static instance: MovementEventEmitter;
    static getInstance(): MovementEventEmitter {
        if (!MovementEventEmitter.instance) {
            MovementEventEmitter.instance = new MovementEventEmitter();
        }
        return MovementEventEmitter.instance;
    }
}

export const movementEvents = MovementEventEmitter.getInstance();
