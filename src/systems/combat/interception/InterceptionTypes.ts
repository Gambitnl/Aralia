/**
 * Types for the Combat Interception System.
 * Handles mechanics where an attack is redirected from its original target
 * to a new target (e.g., Mirror Image, Sanctuary, Goblin Boss).
 */

export interface InterceptionResult {
    /** Whether the attack was successfully intercepted/redirected */
    intercepted: boolean;
    /** The ID of the new target (if applicable) */
    newTargetId?: string;
    /** If the interception results in a complete miss/negation without a new target */
    negated?: boolean;
    /** Metadata about the interception for logging */
    reason?: string;
}

/**
 * Interface for logic that determines if an attack is intercepted.
 */
export interface InterceptionLogic {
    /**
     * Evaluates whether an attack against a specific target should be intercepted.
     * @param attackerId - ID of the attacker
     * @param targetId - ID of the original target
     * @param context - Additional context needed for the specific logic
     * @returns Promise resolving to the result
     */
    evaluateInterception(
        attackerId: string,
        targetId: string,
        // Context might be needed here (e.g., current duplicate count)
        context?: any
    ): Promise<InterceptionResult>;
}
