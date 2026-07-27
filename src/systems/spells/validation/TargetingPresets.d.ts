import { TargetConditionFilter } from '@/types/spells';
/**
 * Standard targeting filters for common D&D spell constraints.
 * Use these to populate the `targeting.filter` field in spell JSONs.
 */
export declare const TARGET_FILTERS: {
    /**
     * For most healing spells (Cure Wounds, Healing Word, etc.)
     * which explicitly do not affect Undead or Constructs.
     */
    readonly HEALING_STANDARD: {
        readonly creatureTypes: readonly [];
        readonly excludeCreatureTypes: readonly ["Undead", "Construct"];
        readonly sizes: readonly [];
        readonly alignments: readonly [];
        readonly hasCondition: readonly [];
        readonly isNativeToPlane: false;
    };
    /**
     * For spells that only affect Humanoids (Charm Person, Hold Person).
     */
    readonly HUMANOID_ONLY: {
        readonly creatureTypes: readonly ["Humanoid"];
        readonly excludeCreatureTypes: readonly [];
        readonly sizes: readonly [];
        readonly alignments: readonly [];
        readonly hasCondition: readonly [];
        readonly isNativeToPlane: false;
    };
    /**
     * For spells that only affect Beasts (Animal Friendship).
     */
    readonly BEAST_ONLY: {
        readonly creatureTypes: readonly ["Beast"];
        readonly excludeCreatureTypes: readonly [];
        readonly sizes: readonly [];
        readonly alignments: readonly [];
        readonly hasCondition: readonly [];
        readonly isNativeToPlane: false;
    };
    /**
     * For spells that do not affect Undead (Sleep, etc.).
     */
    readonly NO_UNDEAD: {
        readonly creatureTypes: readonly [];
        readonly excludeCreatureTypes: readonly ["Undead"];
        readonly sizes: readonly [];
        readonly alignments: readonly [];
        readonly hasCondition: readonly [];
        readonly isNativeToPlane: false;
    };
};
/**
 * Helper to check if a spell JSON matches a known preset pattern.
 * Useful for validation scripts.
 */
export declare function matchTargetFilter(description: string): TargetConditionFilter | null;
