
import { Spell } from '../../../types/spells';

// Auditor: Systematic integrity validation for spells
// Captures patterns like "Duration says Concentration but Tags don't"
// or "Enchantment spells missing humanoid filters"

export class SpellIntegrityValidator {
  /**
   * Validates a spell against systematic integrity rules.
   * Returns a list of error messages.
   */
  static validate(spell: Spell): string[] {
    const errors: string[] = [];

    // Rule 1: Concentration Sync
    // If duration.concentration is true, 'tags' MUST include 'concentration'
    if (spell.duration.concentration) {
      if (!spell.tags || !spell.tags.includes('concentration')) {
        errors.push(`Concentration Mismatch: duration.concentration is true but 'tags' is missing "concentration"`);
      }
    }

    // Rule 2: Enchantment Targeting
    // If school is Enchantment and targets a single creature, check for targeting constraints
    if (spell.school === 'Enchantment' && spell.targeting.type === 'single') {
      const filter = spell.targeting.filter;
      const hasInclusions = filter?.creatureTypes && filter.creatureTypes.length > 0;
      const hasExclusions = filter?.excludeCreatureTypes && filter.excludeCreatureTypes.length > 0;

      // If no inclusions (target everything) AND no exclusions (don't exclude anything), it's too broad for Enchantment
      if (!hasInclusions && !hasExclusions) {
        errors.push(`Enchantment Gap: Single-target Enchantment spell has no targeting filters (expected creature type restriction or exclusions)`);
      }
    }

    // Rule 3: Upcast Scaling Sync
    // If higherLevels text exists and is substantive, scaling should be present
    if (spell.higherLevels && spell.higherLevels.length > 20 && spell.higherLevels !== 'None') {
      // Check for scaling in effects
      const hasEffectScaling = spell.effects.some(e =>
        e.scaling && (e.scaling.bonusPerLevel || e.scaling.customFormula)
      );

      // Check if text implies target scaling (which isn't always in effect scaling)
      const mentionsTargets = spell.higherLevels.toLowerCase().includes('target');

      if (!hasEffectScaling && !mentionsTargets) {
         errors.push(`Upcast Gap: 'higherLevels' description exists but no effect scaling or target scaling detected.`);
      }
    }

    return errors;
  }
}
