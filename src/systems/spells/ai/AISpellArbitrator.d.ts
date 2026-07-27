/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/06/2026, 17:23:11
 * Dependents: commands/factory/SpellCommandFactory.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Spell } from '../../../types/spells';
import { CombatCharacter, CombatState } from '../../../types/combat';
import { GameState } from '../../../types';
export interface ArbitrationRequest {
    spell: Spell;
    caster: CombatCharacter;
    targets: CombatCharacter[];
    combatState: CombatState;
    gameState: GameState;
    playerInput?: string;
}
export interface SimplifiedSpellEffect {
    type: 'DAMAGE' | 'HEALING' | 'STATUS_CONDITION';
    damage?: {
        dice: string;
        type: string;
    };
    healing?: {
        dice: string;
    };
    statusCondition?: {
        name: string;
        duration: {
            type: 'rounds';
            value: number;
        };
    };
    target?: string;
}
export interface ArbitrationResult {
    allowed: boolean;
    reason?: string;
    mechanicalEffects?: SimplifiedSpellEffect[];
    narrativeOutcome?: string;
    stateChanges?: Partial<GameState>;
}
/**
 * This file arbitrates spells that need AI judgment instead of pure mechanics.
 *
 * Mechanical spells return immediately, AI-assisted spells ask a narrow
 * prerequisite question, and AI-DM spells ask for a fuller ruling with player
 * input. The small in-memory cache below avoids paying for the exact same AI
 * ruling twice while keeping the cache key tied to the full scene prompt so
 * changed terrain, targets, caster context, or player text cannot reuse a stale
 * decision.
 */
declare class AISpellArbitrator {
    private arbitrationCache;
    /**
     * Main arbitration entry point
     */
    arbitrate(request: ArbitrationRequest): Promise<ArbitrationResult>;
    /**
     * Clears cached arbitration rulings for focused tests and future combat
     * lifecycle hooks.
     *
     * The live game can call this when leaving combat or loading a materially
     * different scene. Tests call it before each case so one assertion cannot
     * accidentally inherit another assertion's AI ruling.
     */
    clearCacheForTest(): void;
    /**
     * Tier 2: Validate context (e.g., "is there stone nearby?")
     */
    private validateContext;
    /**
     * Tier 3: Full AI DM adjudication (e.g., Suggestion, Prestidigitation)
     */
    private aiDMAdjudication;
    /**
     * Build context string for AI
     */
    private buildGameStateContext;
    private describeNearbyCreatures;
    private describeNearbyTerrain;
    private getDistance;
    private calculateSpellDC;
    private buildCacheKey;
    private getCachedResult;
    private setCachedResult;
}
export declare const aiSpellArbitrator: AISpellArbitrator;
export {};
