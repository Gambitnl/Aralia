
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
 *
 * TODO(Auditor): Integrate this validator into the main build pipeline or the `validate-data` script
 * to prevent regression of these semantic rules.
 */
export class LegacySpellValidator {

  /**
   * Spells known to require "Humanoid" targeting but often missing the filter.
   */
  private static readonly HUMANOID_ONLY_SPELLS = new Set([
    'charm-person', 'hold-person', 'crown-of-madness', 'friends'
  ]);

  /**
   * Spells known to have specific immunity clauses (Undead/Construct/Int).
   */
  private static readonly MENTAL_IMMUNITY_SPELLS = new Set([
    'charm-person', 'command', 'sleep', 'tashas-hideous-laughter',
    'crown-of-madness', 'suggestion', 'animal-friendship'
  ]);

  static validateSpell(spell: Spell): SemanticIssue[] {
    const issues: SemanticIssue[] = [];

    // 1. Check for Enchantment Immunity Gaps
    if (spell.school === 'Enchantment') {
      const hasImmunityFilter = this.checkImmunityFilters(spell);
      const isMentalSpell = this.MENTAL_IMMUNITY_SPELLS.has(spell.id);

      if (isMentalSpell && !hasImmunityFilter) {
        issues.push({
          spellId: spell.id,
          issueType: 'missing_immunity_filter',
          message: `Spell is a mental enchantment but lacks 'excludeCreatureTypes' or 'targetFilter' for Undead/Constructs/etc.`,
          severity: 'warning'
        });
      }
    }

    // 2. Check for Humanoid-Only targeting consistency
    if (this.HUMANOID_ONLY_SPELLS.has(spell.id)) {
      const targeting = spell.targeting;
      const validTargets = targeting.validTargets || [];
      const filter = targeting.filter;

      // TODO: Fix TS2345 - 'humanoids' is not a valid member of TargetFilter. 
      // This check handles legacy data that might still use it.
      const explicitlyHumanoid = (validTargets as string[]).includes('humanoids') ||
                                 filter?.creatureTypes?.includes('Humanoid');

      if (!explicitlyHumanoid) {
         issues.push({
          spellId: spell.id,
          issueType: 'generic_targeting',
          message: `Spell should be restricted to Humanoids but uses generic targeting.`,
          severity: 'error'
        });
      }
    }

    return issues;
  }

  private static checkImmunityFilters(spell: Spell): boolean {
    // Check root targeting filter
    if (spell.targeting.filter?.excludeCreatureTypes?.length) return true;
    if (spell.targeting.filter?.creatureTypes?.length) return true; // Positive filter implies exclusion

    // Check effect conditions
    for (const effect of spell.effects) {
      if (effect.condition?.targetFilter?.excludeCreatureTypes?.length) return true;
      if (effect.condition?.targetFilter?.creatureTypes?.length) return true;
    }

    return false;
  }
}
