import type { Spell } from '@/types/spells';
export interface SemanticIssue {
    spellId: string;
    issueType: 'missing_immunity_filter' | 'missing_scaling' | 'generic_targeting';
    message: string;
    severity: 'warning' | 'error';
}
/**
 * Framework for auditing logical/semantic gaps in Spell data that schema validation misses.
 * Specifically checks for "Implicit Rules" like Enchantment immunities.
 */
export declare class LegacySpellValidator {
    /**
     * Spells known to require "Humanoid" targeting but often missing the filter.
     */
    private static readonly HUMANOID_ONLY_SPELLS;
    /**
     * Spells known to have specific immunity clauses (Undead/Construct/Int).
     */
    private static readonly MENTAL_IMMUNITY_SPELLS;
    static validateSpell(spell: Spell): SemanticIssue[];
    private static checkImmunityFilters;
}
