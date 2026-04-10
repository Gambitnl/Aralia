
import { Spell } from '../../../types/spells';

/**
 * SpellIntegrityValidator
 *
 * This file is a quality-control auditor for spell JSON data. It runs a fixed
 * set of mechanical rules against any given spell and returns a list of problems
 * it found. If the list is empty, the spell passed every check.
 *
 * Why it exists: Aralia's spells are stored as structured JSON files, and many
 * were created during early prototyping before the engine's data standards were
 * fully established. Without automated checks, bad data — like a Concentration
 * spell missing its tag, or a complex multi-damage spell packed into a single
 * generic UTILITY effect block — would slip through silently and break combat
 * resolution at runtime.
 *
 * How it fits in: This validator is called by the regression test suite
 * (SpellIntegrityValidator.test.ts). The tests load every real spell JSON file
 * from public/data/spells/ and run them through this validator. Some rules emit
 * only warnings (the hit list is printed to the console); others are enforced
 * as hard failures that will block CI.
 *
 * Adding a new rule: add a numbered block inside validate() following the same
 * pattern. Give it a descriptive push() message — the test suite filters on
 * that exact string to decide which rule caused each failure.
 */

export class SpellIntegrityValidator {
  /**
   * Validates a spell against systematic integrity rules.
   * Returns a list of error message strings. An empty array means the spell
   * passed all checks.
   */
  static validate(spell: Spell): string[] {
    const errors: string[] = [];

    // =========================================================================
    // Rule 1: Concentration Sync
    // =========================================================================
    // The spell's duration object and its tags array must agree on whether the
    // spell requires concentration. If duration.concentration is true but the
    // 'concentration' tag is absent, the UI won't show the concentration
    // indicator and the combat tracker won't know to drop the spell when the
    // caster takes damage and fails their save. Both fields are set manually
    // during data entry and can easily fall out of sync.
    if (spell.duration.concentration) {
      if (!spell.tags || !spell.tags.includes('concentration')) {
        errors.push(`Concentration Mismatch: duration.concentration is true but 'tags' is missing "concentration"`);
      }
    }

    // =========================================================================
    // Rule 2: Enchantment Targeting
    // =========================================================================
    // Enchantment spells (mind-affecting magic like Charm Person or Hold Person)
    // in D&D 2024 only work on specific creature types — usually Humanoids,
    // sometimes with defined exclusions. If a single-target Enchantment spell
    // has no creature-type inclusions AND no creature-type exclusions, the data
    // author never constrained who it can affect. The engine would apply it to
    // anything, including monsters that should be immune by rule.
    if (spell.school === 'Enchantment' && spell.targeting.type === 'single') {
      const filter = spell.targeting.filter;

      // Check whether the filter locks the spell TO specific creature types
      // (e.g., "only works on Humanoids").
      const hasInclusions = filter?.creatureTypes && filter.creatureTypes.length > 0;

      // Check whether the filter explicitly EXCLUDES certain creature types
      // (e.g., "works on everything except Undead and Constructs").
      const hasExclusions = filter?.excludeCreatureTypes && filter.excludeCreatureTypes.length > 0;

      // If neither list is populated, the targeting is completely unconstrained.
      if (!hasInclusions && !hasExclusions) {
        errors.push(`Enchantment Gap: Single-target Enchantment spell has no targeting filters (expected creature type restriction or exclusions)`);
      }
    }

    // =========================================================================
    // Rule 3: Upcast Scaling Sync
    // =========================================================================
    // Many spells become more powerful when cast using a higher-level spell slot
    // ("upcasting"). If a spell has a substantive higherLevels text description
    // but no matching machine-readable scaling defined on any of its effects,
    // the engine has no automatic way to apply the bonus — it must fall back on
    // AI interpretation of natural language, defeating the purpose of structured
    // spell data.
    //
    // The 20-character threshold filters out placeholder strings like "None" or
    // empty padding so we only fire on real upcast descriptions.
    //
    // Target-based scaling (e.g., "affects one additional creature per slot") is
    // valid even without effect-level scaling values — the word "target" in the
    // higherLevels text is treated as a sufficient signal for those cases.
    if (spell.higherLevels && spell.higherLevels.length > 20 && spell.higherLevels !== 'None') {

      // Walk every effect and check for a bonusPerLevel or customFormula value.
      const hasEffectScaling = spell.effects.some(e =>
        e.scaling && (e.scaling.bonusPerLevel || e.scaling.customFormula)
      );

      // Some spells scale by adding more targets, not by changing damage values.
      // Those are valid even without effect-level scaling data.
      const mentionsTargets = spell.higherLevels.toLowerCase().includes('target');

      if (!hasEffectScaling && !mentionsTargets) {
         errors.push(`Upcast Gap: 'higherLevels' description exists but no effect scaling or target scaling detected.`);
      }
    }

    // =========================================================================
    // Rule 4: Monolithic Effect Formulation
    // =========================================================================
    // This rule hunts for spells imported during early prototyping, before the
    // engine supported arrays of distinct effects. Those spells crammed all
    // their mechanics into one effects[] entry (usually typed as the catch-all
    // UTILITY) and set the effect's description to a copy-paste of the top-level
    // spell description.
    //
    // The problem: the combat engine resolves spells by reading individual Effect
    // components. A monolithic spell gives it nothing to parse — it either applies
    // a single undifferentiated blob, or falls back on the AI to interpret natural
    // language. Both are wrong for a mechanical combat system. These spells need
    // to be broken into discrete DamageEffect, StatusConditionEffect, etc. objects.
    //
    // Detection heuristic — all three conditions must be true to flag the spell:
    //   1. The spell has exactly one item in its effects array.
    //   2. The top-level spell description is longer than 150 characters.
    //      (Under 150 chars usually means it really is a simple one-effect spell
    //      like Blade Ward. We do not want false positives on those.)
    //   3. After stripping punctuation and whitespace, the effect's description
    //      is a near-duplicate of (i.e. a substring of) the spell description.
    //      This is the data signature of a copy-paste from early data entry.
    //
    // NOTE on string normalization: we must strip ALL whitespace and punctuation
    // before comparing. Some spells (like mass-heal) have subtle formatting
    // differences between the two description strings — e.g., "Blinded , Deafened"
    // vs "Blinded, Deafened" — that would cause a naive .includes() to miss the
    // match. Normalization catches all such cases.
    //
    // BUG FIXED (2026-04-09): The original regex was /[\\s\\W_]+/ which due to
    // double-escaping matched only literal backslash-s and backslash-W characters,
    // not actual whitespace or punctuation. This meant mass-heal and other spells
    // with minor punctuation differences were NOT being caught. Fixed to /[\s\W_]+/.
    if (spell.description && spell.effects && spell.effects.length === 1) {
      const effect = spell.effects[0];
      const effectDesc = effect.description || '';

      // Spells under 150 characters are short enough that one effect is probably
      // correct — skip them to avoid flagging genuinely simple spells.
      const isWordy = spell.description.length > 150;

      // Strip whitespace, punctuation, and underscores, then lowercase both
      // strings so minor formatting differences don't hide a real duplicate.
      const normalize = (t: string) => t.replace(/[\s\W_]+/g, '').toLowerCase();
      const normSpellDesc = normalize(spell.description);
      const normEffectDesc = normalize(effectDesc);

      // Check whether either description is contained within the other.
      // We check both directions because occasionally the effect description
      // is slightly longer than the spell description (e.g. when trailing
      // sentences were accidentally included in the effect copy).
      const isSubstring = effectDesc
        ? (normSpellDesc.includes(normEffectDesc) || normEffectDesc.includes(normSpellDesc))
        : false;

      if (isWordy && isSubstring) {
        errors.push(`Monolithic Effect Description`);
      }
    }

    return errors;
  }
}
