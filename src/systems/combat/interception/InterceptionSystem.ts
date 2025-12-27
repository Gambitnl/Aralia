import { attackEvents, AttackEvent } from '../AttackEventEmitter';
import { InterceptionLogic } from './InterceptionTypes';
import { MirrorImageLogic } from './MirrorImageLogic';

/**
 * System that orchestrates attack redirection checks.
 * Subscribes to the global AttackEventEmitter.
 */
export class InterceptionSystem {
    private mirrorImageLogic: MirrorImageLogic;

    constructor() {
        this.mirrorImageLogic = new MirrorImageLogic();
        this.setupListeners();
    }

    /**
     * TODO(Steward): Integrate this system into the main application initialization.
     *
     * Current status:
     * - Framework for attack interception is built.
     * - `MirrorImageLogic` implements the specific d20 roll rules.
     * - Hooked into `attackEvents.onPreAttack`.
     *
     * Next steps:
     * 1. Instantiate `InterceptionSystem` in `App.tsx` or `useGameActions` (wherever singletons are init).
     * 2. In `handlePreAttack`, replace the mock `hasMirrorImage` check with a real lookup against `GameState` or `CombatState`.
     *    - Need to access the target's StatusConditions.
     *    - Need to parse the "Mirror Image" condition to get `duplicateCount`.
     * 3. Handle the "Virtual Target" (`targetId_mirror_image`) in the damage resolution phase.
     *    - When `event.redirectTargetId` is set, the damage calculator needs to know this target has AC = 10 + Dex and 1 HP (destroyed on hit).
     */
    private setupListeners() {
        attackEvents.onPreAttack(this.handlePreAttack.bind(this));
    }

    /**
     * Main handler for pre-attack interception checks.
     */
    private async handlePreAttack(event: AttackEvent): Promise<void> {
        // Guard: If already cancelled or redirected, skip
        if (event.isCancelled || event.redirectTargetId) return;

        // TODO(Steward): Look up real GameState/CombatState here
        // We need to check if event.targetId has the "Mirror Image" status condition.
        // For now, this is a framework scaffold.

        // Mock check for demonstration:
        const hasMirrorImage = false; // Placeholder

        if (hasMirrorImage) {
            // Retrieve state from status effect (this data structure needs to exist in CombatState)
            const context = { duplicateCount: 3, casterDexMod: 2 };

            const result = await this.mirrorImageLogic.evaluateInterception(
                event.attackerId,
                event.targetId,
                context
            );

            if (result.intercepted && result.newTargetId) {
                event.redirectTargetId = result.newTargetId;
                // TODO: Log interception event
            }
        }
    }
}
