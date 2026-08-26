// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SCRIPT-GATED AND TEST-GATED VALIDATOR: the spell integrity suite gates the
 * mechanical rules, and scripts/validate-data.ts calls validateSemantics().
 *
 * Last Sync: 20/09/2026 (hand-refreshed; re-run --sync to regenerate)
 * Dependents: scripts/validate-data.ts, plus the test files under
 *   systems/spells/validation/__tests__/spellIntegrity/
 * Imports: 2 files (types/spells, types/spellEffectMetadata) + ./modeChoiceSchemas
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell } from '../../../types/spells';
import type { GrantedAction, SpellActionCost } from '../../../types/spellEffectMetadata';
import { MULTI_SELECT_MODE_CHOICE_TYPES } from './modeChoiceSchemas';

/**
 * Canonical action cost for every action-cost label the spell corpus authors.
 *
 * Spell records name their granted actions in source terms - a Magic action, a
 * free command, a narrative flourish - while the action economy only spends an
 * Action, a Bonus Action, a Reaction, nothing, or nothing at all. This table is
 * the single mapping between the two vocabularies, so a validator, a UI, and a
 * command factory all read one answer for what a granted action costs.
 */
export const CANONICAL_ACTION_COSTS: Readonly<Record<string, SpellActionCost>> = {
  // Costs an Action. The 2024 Magic action is an Action, and a magic-jar soul
  // whose only available action is projecting itself still spends that Action.
  action: 'action',
  magic_action: 'action',
  only_available_action: 'action',
  // Costs a Bonus Action.
  bonus_action: 'bonus_action',
  // Costs a Reaction.
  reaction: 'reaction',
  // Costs nothing. Verbal commands to a summon, telepathic orders to a
  // dominated creature, questions put to an otherworldly entity, and dream
  // scene-setting all happen without spending an action.
  free: 'free',
  free_command: 'free',
  no_action: 'free',
  narrative_control: 'free',
  question: 'free',
  // Not an action. Tenser's Transformation changes how the Attack action
  // resolves rather than granting a new action to spend.
  attack_action_modifier: 'special',
};

/**
 * Resolves one granted-action row onto the canonical action-cost vocabulary.
 *
 * The canonical spelling is `type` / `action` / `frequency`. Legacy rows author
 * the same three facts as `actionType` / `name` / `timing`, and pool-limited
 * legacy rows spell their cadence `cost`. Both spellings normalize here so the
 * rules below read one shape.
 */
export function normalizeGrantedAction(grantedAction: GrantedAction): {
  sourceCost: string | undefined;
  canonicalCost: SpellActionCost | undefined;
  label: unknown;
  cadence: unknown;
  rangeCap: unknown;
} {
  const sourceCost = grantedAction.type ?? grantedAction.actionType;

  return {
    sourceCost: sourceCost === undefined ? undefined : String(sourceCost),
    canonicalCost: sourceCost === undefined ? undefined : CANONICAL_ACTION_COSTS[String(sourceCost)],
    label: grantedAction.action ?? grantedAction.name,
    cadence: grantedAction.frequency ?? grantedAction.timing ?? grantedAction.cost,
    rangeCap: grantedAction.rangeLimit ?? grantedAction.rangeFeet ?? grantedAction.range,
  };
}

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

/**
 * Target-filter keys whose spell-level restriction a direct effect is expected
 * to repeat on its own condition payload.
 */
export const RESTRICTED_FILTER_KEYS = ['creatureTypes', 'excludeCreatureTypes', 'sizes', 'alignments'] as const;

export type RestrictedFilterKey = typeof RESTRICTED_FILTER_KEYS[number];

/**
 * One reviewed Rule 7 exemption: an Enchantment spell whose own text names no
 * creature type, size, or communication gate at all.
 */
export interface EnchantmentTargetingExemption {
  /** The spell id exactly as the data file records it. */
  spellId: string;
  /** Why the spell carries no creature-type restriction by design. */
  reason: string;
  /** Who reviewed the spell text and signed off on the exemption. */
  reviewedBy: string;
  /** ISO date of that review. */
  reviewedOn: string;
}

/**
 * Normalizes one restricted-filter value into a sorted list of comparable
 * strings.
 *
 * The spell data sometimes records "Huge or smaller" as explanatory source text
 * while the effect payload stores the actual creature sizes. Expanding that
 * phrase here lets rows such as Tsunami's ongoing wave damage compare equal
 * instead of needing a permanent semantic exception. The `not_applicable`
 * sentinel means "no restriction", so it never becomes a comparable value.
 *
 * Exported because the corpus gate in
 * `__tests__/spellIntegrity/systematicAllSpellValidation.test.ts` compares the
 * same rows. One copy keeps the executable rule and the gate from drifting.
 */
export function normalizeFilterValues(value: unknown, key?: RestrictedFilterKey): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const expandedValues = value.flatMap(item => {
    if (
      key === 'sizes'
      && typeof item === 'string'
      && item.toLowerCase().startsWith('huge or smaller')
    ) {
      return ['Huge', 'Large', 'Medium', 'Small', 'Tiny'];
    }

    return item;
  });

  return expandedValues.filter(item => item !== 'not_applicable').map(String).sort();
}

/**
 * True when two restricted-filter values name the same restriction.
 */
export function sameFilterValues(left: unknown, right: unknown, key?: RestrictedFilterKey): boolean {
  const normalizedLeft = normalizeFilterValues(left, key);
  const normalizedRight = normalizeFilterValues(right, key);

  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

/**
 * One issue raised by the named-spell targeting backstop,
 * `SpellIntegrityValidator.validateSemantics`.
 *
 * `validate` returns plain strings because every rule it runs is a hard error.
 * The named-spell checks carry two severities, so they keep a structured shape
 * and `scripts/validate-data.ts` decides which severity stops the build.
 */
export interface SpellSemanticIssue {
  spellId: string;
  issueType: 'missing_immunity_filter' | 'generic_targeting' | 'nonstandard_scaling_format';
  message: string;
  severity: 'warning' | 'error';
}

export class SpellIntegrityValidator {
  /**
   * Spells whose own text restricts them to Humanoid targets.
   *
   * Rule 7 below is the structural gate: it fails any single-target
   * Enchantment that declares no creature-type inclusion, no exclusion, no
   * size limit, and no communication prerequisite at all. These named spells are the backstop
   * behind that rule. A spell can satisfy Rule 7 with some other gate and still
   * be wrong if the gate it declares is not the Humanoid restriction its own
   * description names.
   */
  private static readonly HUMANOID_ONLY_SPELLS: ReadonlySet<string> = new Set([
    'charm-person',
    'hold-person',
    'crown-of-madness',
    'friends',
  ]);

  /**
   * Mind-affecting spells that need a creature-type gate on the data so the
   * engine never applies them to a target the spell text rules out.
   *
   * Rule 7 accepts a communication prerequisite as a valid gate, which is right
   * for a social enchantment such as Suggestion. This list is narrower: these
   * spells also need the creature-type side of the filter, on the spell-level
   * targeting or on an effect condition, before the runtime can decide who is
   * immune.
   */
  private static readonly MENTAL_IMMUNITY_SPELLS: ReadonlySet<string> = new Set([
    'charm-person',
    'command',
    'sleep',
    'tashas-hideous-laughter',
    'crown-of-madness',
    'suggestion',
    'animal-friendship',
  ]);

  /**
   * Named-spell targeting backstop behind Rule 7.
   *
   * `validate` covers every spell structurally. This pass covers the handful of
   * spells whose individual text names a restriction that no structural rule
   * can infer, and it reports severity so the data gate can keep a known gap as
   * a warning while a real authoring mistake stops the build.
   */
  static validateSemantics(spell: Spell): SpellSemanticIssue[] {
    const issues: SpellSemanticIssue[] = [];

    if (
      spell.school === 'Enchantment'
      && SpellIntegrityValidator.MENTAL_IMMUNITY_SPELLS.has(spell.id)
      && !SpellIntegrityValidator.hasCreatureTypeGate(spell)
    ) {
      issues.push({
        spellId: spell.id,
        issueType: 'missing_immunity_filter',
        message: `Spell is a mental enchantment but lacks 'excludeCreatureTypes' or 'creatureTypes' on its targeting filter or on an effect condition.`,
        severity: 'warning',
      });
    }

    if (SpellIntegrityValidator.HUMANOID_ONLY_SPELLS.has(spell.id)) {
      const validTargets = spell.targeting.validTargets || [];
      const explicitlyHumanoid =
        validTargets.some(target => target.toLowerCase() === 'humanoids')
        || Boolean(spell.targeting.filter?.creatureTypes?.includes('Humanoid'));

      if (!explicitlyHumanoid) {
        issues.push({
          spellId: spell.id,
          issueType: 'generic_targeting',
          message: `Spell should be restricted to Humanoids but uses generic targeting.`,
          severity: 'error',
        });
      }
    }

    // A `bonusPerLevel` the dice math can read is "+1d6", "1d6", "+5", or "-1".
    // Anything else - "+1 target", "+5 temp HP", "+1 maximum devil CR" - is a
    // rule the engine still has to interpret, so the upcast is not yet
    // automatic. That is real debt rather than an authoring mistake, so it
    // stays a warning and names the row it found.
    (spell.effects ?? []).forEach((effect, effectIndex) => {
      const bonusPerLevel = effect.scaling?.bonusPerLevel;
      if (!bonusPerLevel) return;

      const isStandard = /^([+-]?\d+)(d\d+)?$/.test(String(bonusPerLevel).replace(/\s/g, ''));
      if (isStandard) return;

      issues.push({
        spellId: spell.id,
        issueType: 'nonstandard_scaling_format',
        message: `Effect ${effectIndex} scaling "${bonusPerLevel}" is not standard dice or flat math, so upcasting needs custom handling.`,
        severity: 'warning',
      });
    });

    return issues;
  }

  /**
   * True when some part of the spell names the creature types it can or cannot
   * affect. A positive list implies the exclusion, so either side counts.
   */
  private static hasCreatureTypeGate(spell: Spell): boolean {
    const filter = spell.targeting.filter;
    if (filter?.excludeCreatureTypes?.length) return true;
    if (filter?.creatureTypes?.length) return true;

    return (spell.effects ?? []).some(effect => {
      const effectFilter = effect.condition?.targetFilter;
      return Boolean(effectFilter?.excludeCreatureTypes?.length)
        || Boolean(effectFilter?.creatureTypes?.length);
    });
  }

  /**
   * Returns classified restricted-filter mismatches with the explanation needed
   * by future audit, validation, and UI/debug surfaces.
   *
   * Each detail names the exact spell/effect/filter row, groups it into a
   * semantic family, and explains why copying the spell-level target filter
   * would be misleading until a more specific model exists. Keeping this in the
   * validator makes the executable rule and the human-facing reason share one
   * source of truth.
   */
  static getClassifiedRestrictedFilterMismatchDetails(): Array<{ key: string; category: string; reason: string }> {
    return [
      {
        key: 'plant-growth:0:creatureTypes',
        category: 'plant/terrain target semantics',
        reason: 'Plant Growth mixes normal vegetation, plant creatures, and terrain conversion, so the Plant filter needs a plant-target model before it can be copied onto this effect.'
      },
      {
        key: 'plant-growth:1:creatureTypes',
        category: 'plant/terrain target semantics',
        reason: 'Plant Growth mixes normal vegetation, plant creatures, and terrain conversion, so the Plant filter needs a plant-target model before it can be copied onto this effect.'
      },
      {
        key: 'speak-with-plants:0:creatureTypes',
        category: 'plant/terrain target semantics',
        reason: 'Speak with Plants can affect ordinary plants and plant creatures, so the Plant filter needs a plant-target model before it can be treated as a direct creature target filter.'
      },
      {
        key: 'awaken:1:creatureTypes',
        category: 'mixed creature/object transformation',
        reason: 'Awaken can target Beast or Plant creatures and natural plants that are not creatures, so a creature-only effect filter would hide the non-creature plant path until object/plant eligibility is modeled.'
      },
      {
        key: 'simulacrum:1:creatureTypes',
        category: 'created-creature repair target',
        reason: 'The Simulacrum repair row acts on the created simulacrum later, not on the original Beast or Humanoid creature used for creation.'
      },
      {
        key: 'antipathy-sympathy:0:sizes',
        category: 'chosen-kind aura',
        reason: 'The Huge-or-smaller gate describes the target or source object/creature, while this aura effect applies to creatures of a chosen kind approaching that source.'
      },
      {
        key: 'antipathy-sympathy:1:sizes',
        category: 'chosen-kind aura',
        reason: 'The Huge-or-smaller gate describes the target or source object/creature, while this aura effect applies to creatures of a chosen kind approaching that source.'
      },
      {
        key: 'antipathy-sympathy:2:sizes',
        category: 'chosen-kind aura',
        reason: 'The Huge-or-smaller gate describes the target or source object/creature, while this aura effect applies to creatures of a chosen kind approaching that source.'
      },
      {
        key: 'antipathy-sympathy:3:sizes',
        category: 'chosen-kind aura',
        reason: 'The Huge-or-smaller gate describes the target or source object/creature, while this aura effect applies to creatures of a chosen kind approaching that source.'
      },
      {
        key: 'tsunami:0:sizes',
        category: 'ongoing wave-size semantics',
        reason: 'Tsunami size text applies to ongoing wall movement damage, not the initial wall appearance or utility rows. Effect 2 is handled by concrete size normalization instead.'
      },
      {
        key: 'tsunami:1:sizes',
        category: 'ongoing wave-size semantics',
        reason: 'Tsunami size text applies to ongoing wall movement damage, not the initial wall appearance or utility rows. Effect 2 is handled by concrete size normalization instead.'
      },
      {
        key: 'tsunami:3:sizes',
        category: 'ongoing wave-size semantics',
        reason: 'Tsunami size text applies to ongoing wall movement damage, not the movement row itself. Effect 2 is handled by concrete size normalization instead.'
      },
      {
        key: 'shapechange:0:excludeCreatureTypes',
        category: 'form-choice eligibility',
        reason: 'Shapechange excludes Construct and Undead as chosen form options, not as caster targets, so this needs a form-choice eligibility model before the exclusion is copied onto the effect target.'
      },
      {
        key: 'shapechange:1:excludeCreatureTypes',
        category: 'form-choice eligibility',
        reason: 'Shapechange excludes Construct and Undead as chosen form options, not as caster targets, so this needs a form-choice eligibility model before the exclusion is copied onto the effect target.'
      }
    ];
  }

  /**
   * Returns the restricted-filter mismatches that are known semantic exceptions,
   * not direct data omissions.
   *
   * These rows stay visible here because their spell-level filter describes a
   * different thing than a normal direct effect target: plant or object
   * eligibility, a chosen aura source, a later repair target, an ongoing area
   * rule, or a form-choice rule. The validator and the corpus regression both
   * use this list so spell JSON validation and tests do not drift apart.
   */
  static getClassifiedRestrictedFilterMismatchKeys(): string[] {
    return SpellIntegrityValidator
      .getClassifiedRestrictedFilterMismatchDetails()
      .map(detail => detail.key);
  }

  /**
   * Returns the Enchantment spells that are reviewed and exempt from Rule 7.
   *
   * Rule 7 asks every single-target Enchantment spell to name who it can
   * affect. A small number of spells name nobody because their own text names
   * nobody: they are Enchantment by school only and carry no mind-affecting
   * clause to constrain. Forcing the usual Construct + Undead exclusion onto
   * them would break real play, so each one is reviewed by hand and recorded
   * here.
   *
   * The list lives in this file, not in the spell JSON, on purpose. A data
   * author editing a spell file must not be able to self-exempt that spell
   * from a validator rule; changing this list is a code change that a reviewer
   * sees. The stale-exemption check in Rule 7 is the other half of that guard:
   * if a listed spell ever gains a real creature-type filter, the exemption is
   * no longer true and the validator fails until the row is removed.
   */
  static getEnchantmentTargetingExemptions(): EnchantmentTargetingExemption[] {
    return [
      {
        spellId: 'hex',
        reason: 'Hex is a curse that deals necrotic damage and saps one ability. It is not mind-affecting, and warlocks are expected to hex Undead, so its text names no creature type to restrict.',
        reviewedBy: 'Remy',
        reviewedOn: '2026-09-21',
      },
      {
        spellId: 'power-word-heal',
        reason: 'Power Word Heal is healing, not mind control. Its text names no creature type, and excluding Constructs and Undead would stop the spell from healing an ally of those kinds.',
        reviewedBy: 'Remy',
        reviewedOn: '2026-09-21',
      },
    ];
  }

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
    // Rule 2: Ritual Sync
    // =========================================================================
    // The ritual boolean is the casting-rule source of truth, while the ritual
    // tag is used by spellbook, glossary, and audit surfaces. Keep them aligned
    // so a ritual spell does not disappear from player-facing filters.
    if (spell.ritual) {
      if (!spell.tags || !spell.tags.includes('ritual')) {
        errors.push(`Ritual Mismatch: ritual is true but 'tags' is missing "ritual"`);
      }
    }

    // =========================================================================
    // Rule 3: Duration Progression Integrity
    // =========================================================================
    // Duration progression is the structured home for rules that turn a normal
    // duration into a longer-lived, until-dispelled, or permanent outcome. This
    // rule keeps those records executable enough for future UI/runtime surfaces
    // without rewriting spell mechanics from description text.
    const durationProgression = (spell as Spell & {
      durationProgression?: Array<{
        trigger?: unknown;
        requiredCasts?: unknown;
        cadence?: unknown;
        sameTargetRequired?: unknown;
        sameLocationRequired?: unknown;
        sameConfigurationRequired?: unknown;
        requiresFullConcentration?: unknown;
        outcomeDuration?: unknown;
        dispellable?: unknown;
        notes?: unknown;
      }>;
    }).durationProgression;

    if (durationProgression !== undefined) {
      const knownTriggers = ['repeated_casts', 'recast_while_active', 'full_duration_concentration', 'not_applicable'];
      const knownOutcomes = ['extend_current_duration', 'until_dispelled', 'permanent', 'non_dispellable_permanent', 'not_applicable'];

      if (!Array.isArray(durationProgression) || durationProgression.length === 0) {
        errors.push('Duration Progression Invalid: durationProgression must be a non-empty array when present');
      } else {
        durationProgression.forEach((entry, index) => {
          if (!knownTriggers.includes(String(entry.trigger))) {
            errors.push(`Duration Progression Invalid: entry ${index} uses unknown trigger "${String(entry.trigger)}"`);
          }

          if (!knownOutcomes.includes(String(entry.outcomeDuration))) {
            errors.push(`Duration Progression Invalid: entry ${index} uses unknown outcomeDuration "${String(entry.outcomeDuration)}"`);
          }

          if (typeof entry.dispellable !== 'boolean' && entry.dispellable !== 'not_applicable') {
            errors.push(`Duration Progression Invalid: entry ${index} must declare boolean or not_applicable dispellable metadata`);
          }

          if (typeof entry.notes !== 'string' || entry.notes.trim().length === 0) {
            errors.push(`Duration Progression Invalid: entry ${index} must include explanatory notes`);
          }

          if (entry.trigger === 'repeated_casts') {
            const repeatsAcrossStableContext = entry.sameTargetRequired === true
              || entry.sameLocationRequired === true
              || entry.sameConfigurationRequired === true;

            if (typeof entry.requiredCasts !== 'number' || entry.requiredCasts <= 0) {
              errors.push(`Duration Progression Invalid: entry ${index} repeated_casts requires a positive requiredCasts number`);
            }

            if (entry.cadence === 'not_applicable') {
              errors.push(`Duration Progression Invalid: entry ${index} repeated_casts requires an applicable cadence`);
            }

            if (!repeatsAcrossStableContext) {
              errors.push(`Duration Progression Invalid: entry ${index} repeated_casts must require the same target, location, or configuration`);
            }
          }

          if (entry.trigger === 'full_duration_concentration') {
            if (entry.requiresFullConcentration !== true) {
              errors.push(`Duration Progression Invalid: entry ${index} full_duration_concentration must require full concentration`);
            }

            if (!spell.duration.concentration) {
              errors.push(`Duration Progression Mismatch: entry ${index} requires full concentration but spell duration is not concentration`);
            }
          }

          if (entry.trigger !== 'full_duration_concentration' && entry.requiresFullConcentration === true && !spell.duration.concentration) {
            errors.push(`Duration Progression Mismatch: entry ${index} requires full concentration but spell duration is not concentration`);
          }
        });
      }
    }

    // =========================================================================
    // Rule 4: Mode Choice Integrity
    // =========================================================================
    // Mode-choice spells let the player choose one branch before command
    // creation. When a menu points at effect or control-option indexes, those
    // links must stay inside the real payload arrays or the UI can offer a
    // choice that silently creates no runtime command.
    const modeChoice = (spell as Spell & {
      modeChoice?: {
        type?: unknown;
        optionCount?: unknown;
        minSelections?: unknown;
        maxSelections?: unknown;
        optionsSource?: unknown;
        options?: Array<{
          label?: unknown;
          summary?: unknown;
          effectIndices?: unknown;
          controlOptionIndices?: unknown;
        }>;
      };
    }).modeChoice;

    if (modeChoice !== undefined) {
      if (!Array.isArray(modeChoice.options) || modeChoice.options.length === 0) {
        errors.push('Mode Choice Invalid: modeChoice must include at least one option');
      } else {
        // A single-select menu resolves to exactly one entry, so its
        // optionCount records the menu size. A multi-select menu resolves to
        // several entries out of a larger menu, so its optionCount is the
        // selection budget and only has to fit inside the menu: Commune with
        // Nature offers 5 information categories and the caster picks 3.
        const menuSize = modeChoice.options.length;
        const isMultiSelect = MULTI_SELECT_MODE_CHOICE_TYPES.includes(String(modeChoice.type));

        if (!isMultiSelect) {
          if (modeChoice.optionCount !== menuSize) {
            errors.push(`Mode Choice Invalid: optionCount ${String(modeChoice.optionCount)} does not match options length ${menuSize}`);
          }

          if (modeChoice.minSelections !== undefined || modeChoice.maxSelections !== undefined) {
            errors.push(`Mode Choice Invalid: single-select type "${String(modeChoice.type)}" must not declare a selection range`);
          }
        } else {
          const selectionCount = modeChoice.optionCount;

          if (!Number.isInteger(selectionCount) || Number(selectionCount) < 1 || Number(selectionCount) > menuSize) {
            errors.push(`Mode Choice Invalid: multi-select optionCount ${String(selectionCount)} must select between 1 and ${menuSize} of its options`);
          }

          const minSelections = modeChoice.minSelections;
          const maxSelections = modeChoice.maxSelections;

          if (minSelections !== undefined && (!Number.isInteger(minSelections) || Number(minSelections) < 1 || Number(minSelections) > menuSize)) {
            errors.push(`Mode Choice Invalid: minSelections ${String(minSelections)} must be an integer between 1 and ${menuSize}`);
          }

          if (maxSelections !== undefined && (!Number.isInteger(maxSelections) || Number(maxSelections) < 1 || Number(maxSelections) > menuSize)) {
            errors.push(`Mode Choice Invalid: maxSelections ${String(maxSelections)} must be an integer between 1 and ${menuSize}`);
          }

          if (Number.isInteger(minSelections) && Number.isInteger(maxSelections) && Number(minSelections) > Number(maxSelections)) {
            errors.push(`Mode Choice Invalid: minSelections ${String(minSelections)} exceeds maxSelections ${String(maxSelections)}`);
          }

          if (Number.isInteger(minSelections) && Number(selectionCount) < Number(minSelections)) {
            errors.push(`Mode Choice Invalid: optionCount ${String(selectionCount)} falls below minSelections ${String(minSelections)}`);
          }

          if (Number.isInteger(maxSelections) && Number(selectionCount) > Number(maxSelections)) {
            errors.push(`Mode Choice Invalid: optionCount ${String(selectionCount)} exceeds maxSelections ${String(maxSelections)}`);
          }
        }

        const controlOptionLengths = spell.effects
          .map(effect => (effect as { controlOptions?: unknown[] }).controlOptions)
          .filter((controlOptions): controlOptions is unknown[] => Array.isArray(controlOptions))
          .map(controlOptions => controlOptions.length);

        modeChoice.options.forEach((option, optionIndex) => {
          if (typeof option.label !== 'string' || option.label.trim().length === 0) {
            errors.push(`Mode Choice Invalid: option ${optionIndex} must include a non-empty label`);
          }

          if (typeof option.summary !== 'string' || option.summary.trim().length === 0) {
            errors.push(`Mode Choice Invalid: option ${optionIndex} must include a non-empty summary`);
          }

          if (option.effectIndices !== undefined) {
            if (!Array.isArray(option.effectIndices)) {
              errors.push(`Mode Choice Invalid: option ${optionIndex} effectIndices must be an array when present`);
            } else {
              option.effectIndices.forEach(effectIndex => {
                if (!Number.isInteger(effectIndex) || effectIndex < 0 || effectIndex >= spell.effects.length) {
                  errors.push(`Mode Choice Invalid: option ${optionIndex} points at missing effect index ${String(effectIndex)}`);
                }
              });
            }
          }

          if (option.controlOptionIndices !== undefined) {
            if (!Array.isArray(option.controlOptionIndices)) {
              errors.push(`Mode Choice Invalid: option ${optionIndex} controlOptionIndices must be an array when present`);
            } else {
              option.controlOptionIndices.forEach(controlOptionIndex => {
                const pointsAtKnownControlOption = Number.isInteger(controlOptionIndex)
                  && controlOptionIndex >= 0
                  && controlOptionLengths.some(length => controlOptionIndex < length);

                if (!pointsAtKnownControlOption) {
                  errors.push(`Mode Choice Invalid: option ${optionIndex} points at missing control option index ${String(controlOptionIndex)}`);
                }
              });
            }
          }
        });
      }
    }

    // Choice-bearing utility effects need the same top-level input signal that
    // combat UI and AI arbitration use to ask the caster for a selected option.
    // Limit this rule to actual mode-choice menus that point at controlOptions:
    // many older rows carry non-empty controlOptions as structured summaries,
    // and those should not be forced into a player-input flow until the owning
    // lane converts them into real choose-one menus.
    const modeChoiceUsesControlOptions = modeChoice !== undefined && (
      modeChoice.optionsSource === 'controlOptions' ||
      modeChoice.optionsSource === 'mixed' ||
      (modeChoice.options ?? []).some(option =>
        Array.isArray(option.controlOptionIndices) && option.controlOptionIndices.length > 0
      )
    );

    if (modeChoiceUsesControlOptions && spell.aiContext?.playerInputRequired !== true) {
      errors.push('Mode Choice Invalid: controlOptions-backed modeChoice requires aiContext.playerInputRequired true');
    }

    // =========================================================================
    // Rule 5: Action Cost Metadata Integrity
    // =========================================================================
    // Created-object, sustained hazard, and re-commanded spell effects often
    // depend on action-cost metadata rather than new effect rows. These checks
    // keep the existing structured fields usable without requiring a broad
    // object-lifecycle engine or forcing optional legacy granted-action fields.
    const knownActionCosts = ['action', 'bonus_action', 'reaction'];
    const castingCombatCost = spell.castingTime?.combatCost;

    if (castingCombatCost !== undefined) {
      if (!knownActionCosts.includes(castingCombatCost.type)) {
        errors.push(`Action Cost Invalid: castingTime.combatCost uses unknown type "${String(castingCombatCost.type)}"`);
      }

      if (knownActionCosts.includes(String(spell.castingTime?.unit)) && castingCombatCost.type !== spell.castingTime?.unit) {
        errors.push(`Action Cost Mismatch: castingTime.unit "${spell.castingTime.unit}" does not match combatCost.type "${castingCombatCost.type}"`);
      }
    }

    (spell.effects ?? []).forEach((effect, effectIndex) => {
      const sustainCost = effect.trigger?.sustainCost;

      // Reactive effects still carry a legacy numeric sustain cost, while newer
      // on-caster-action triggers describe the exact action and whether it is
      // optional. Only the structured form can be checked by this rule; keeping
      // the numeric form untouched preserves old reactive spell data until that
      // model is intentionally migrated.
      if (typeof sustainCost === 'object' && sustainCost !== null) {
        if (!knownActionCosts.includes(sustainCost.actionType)) {
          errors.push(`Action Cost Invalid: effect ${effectIndex} sustainCost uses unknown actionType "${String(sustainCost.actionType)}"`);
        }

        if (typeof sustainCost.optional !== 'boolean') {
          errors.push(`Action Cost Invalid: effect ${effectIndex} sustainCost.optional must be boolean`);
        }
      }

      const grantedActions = (effect as { grantedActions?: GrantedAction[] }).grantedActions;

      if (Array.isArray(grantedActions)) {
        grantedActions.forEach((grantedAction, actionIndex) => {
          // Granted-action rows use two authored spellings. normalizeGrantedAction
          // resolves both onto one shape and maps the source cost label - a Magic
          // action, a free command, a narrative flourish - onto the canonical cost
          // the action economy actually spends.
          const { sourceCost, canonicalCost, label, cadence, rangeCap } = normalizeGrantedAction(grantedAction);

          if (canonicalCost === undefined) {
            errors.push(`Action Cost Invalid: effect ${effectIndex} granted action ${actionIndex} uses unmapped action cost "${String(sourceCost)}"`);
          }

          if (typeof label !== 'string' || label.trim().length === 0) {
            errors.push(`Action Cost Invalid: effect ${effectIndex} granted action ${actionIndex} must include a non-empty action label`);
          }

          if (typeof cadence !== 'string' || cadence.trim().length === 0) {
            errors.push(`Action Cost Invalid: effect ${effectIndex} granted action ${actionIndex} must include a non-empty frequency`);
          }

          if (rangeCap !== undefined && typeof rangeCap !== 'number') {
            errors.push(`Action Cost Invalid: effect ${effectIndex} granted action ${actionIndex} rangeLimit must be numeric when present`);
          }
        });
      }
    });

    // =========================================================================
    // Rule 6: Light Metadata Integrity
    // =========================================================================
    // Light spells create map-visible artifacts through UtilityCommand. The
    // renderer and turn lifecycle need concrete radius and attachment data, so
    // a real `utilityType: light` row cannot rely on the zeroed placeholder
    // light blocks that still exist on many non-light utility rows.
    const knownLightAttachments = ['caster', 'target', 'point'];

    (spell.effects ?? []).forEach((effect, effectIndex) => {
      const utilityEffect = effect as {
        utilityType?: unknown;
        light?: {
          brightRadius?: unknown;
          dimRadius?: unknown;
          attachedTo?: unknown;
        };
      };

      if (utilityEffect.utilityType !== 'light') {
        return;
      }

      const light = utilityEffect.light;
      if (!light || typeof light !== 'object') {
        errors.push(`Light Metadata Invalid: effect ${effectIndex} utilityType light must include a light payload`);
        return;
      }

      const brightRadius = light.brightRadius;
      const dimRadius = light.dimRadius;

      if (typeof brightRadius !== 'number' || brightRadius < 0) {
        errors.push(`Light Metadata Invalid: effect ${effectIndex} brightRadius must be a nonnegative number`);
      }

      if (typeof dimRadius !== 'number' || dimRadius < 0) {
        errors.push(`Light Metadata Invalid: effect ${effectIndex} dimRadius must be a nonnegative number`);
      }

      if (typeof brightRadius === 'number' && typeof dimRadius === 'number' && brightRadius === 0 && dimRadius === 0) {
        errors.push(`Light Metadata Invalid: effect ${effectIndex} utilityType light must emit bright or dim light`);
      }

      if (!knownLightAttachments.includes(String(light.attachedTo))) {
        errors.push(`Light Metadata Invalid: effect ${effectIndex} attachedTo must be caster, target, or point`);
      }
    });

    // =========================================================================
    // Rule 7: Enchantment Targeting
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

      // A size limit is a real target restriction as well. Antipathy/Sympathy
      // names no creature type at all: its own text gates the anchor on
      // "Huge or smaller", which the data records either as that source
      // phrase or as a concrete size list. normalizeFilterValues() expands the
      // phrase and drops the "not_applicable" sentinel, so both spellings
      // count and an empty or placeholder size list does not.
      const hasSizeRestriction = normalizeFilterValues(filter?.sizes, 'sizes').length > 0;

      // Social enchantments like Suggestion constrain targets through explicit
      // communication prerequisites rather than a creature-type list. Treat any
      // required hearing/understanding/sight gate as a real targeting filter.
      const communication = filter?.communicationPrerequisites;
      const hasCommunicationPrerequisites = Boolean(
        communication?.canHearCaster === 'required'
        || communication?.canUnderstandCaster === 'required'
        || communication?.canSeeCaster === 'required'
      );

      // A hand-reviewed exemption covers the spells whose own text names no
      // creature type at all. The list is code, not data, so a data author
      // cannot self-exempt a spell by editing its JSON.
      const exemption = SpellIntegrityValidator
        .getEnchantmentTargetingExemptions()
        .find(entry => entry.spellId === spell.id);

      if (exemption) {
        // The exemption says "this spell has no creature-type restriction".
        // The moment the data gives it one, that statement is false, so the
        // exemption must be removed rather than quietly outliving its reason.
        if (SpellIntegrityValidator.hasCreatureTypeGate(spell)) {
          errors.push(`Stale Exemption: Spell is on the reviewed Enchantment targeting exemption list (reviewed by ${exemption.reviewedBy} on ${exemption.reviewedOn}) but now declares a creature-type filter. Remove the exemption entry in SpellIntegrityValidator.ts.`);
        }
      } else if (!hasInclusions && !hasExclusions && !hasSizeRestriction && !hasCommunicationPrerequisites) {
        // If no recognized gate is populated, the targeting is unconstrained.
        errors.push(`Enchantment Gap: Single-target Enchantment spell has no targeting filters (expected creature type, exclusion, size limit, or communication restriction)`);
      }
    }

    // =========================================================================
    // Rule 8: Upcast Scaling Sync
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

      // Walk every effect and check for machine-readable scaling. A cantrip
      // records its growth as a `scalingTiers` table keyed by character level
      // rather than a per-slot bonus, so a tier table counts as real scaling
      // just as `bonusPerLevel` and `customFormula` do. Missing that third
      // shape is what made this rule fire on cantrips such as Fire Bolt.
      const hasEffectScaling = spell.effects.some(effect => {
        const scaling = effect.scaling;
        if (!scaling) return false;

        const tiers = (scaling as { scalingTiers?: Record<string, unknown> }).scalingTiers;

        return Boolean(scaling.bonusPerLevel)
          || Boolean(scaling.customFormula)
          || Boolean(tiers && Object.keys(tiers).length > 0);
      });

      // Some spells scale by adding more targets, not by changing damage values.
      // Those are valid even without effect-level scaling data.
      const mentionsTargets = spell.higherLevels.toLowerCase().includes('target');

      if (!hasEffectScaling && !mentionsTargets) {
         errors.push(`Upcast Gap: 'higherLevels' description exists but no effect scaling or target scaling detected.`);
      }
    }

    // =========================================================================
    // Rule 9: Monolithic Effect Formulation
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

    // =========================================================================
    // Rule 10: Effect Description Completeness
    // =========================================================================
    // Each effect row needs its own concise description because downstream UI,
    // glossary, audit, and debugging surfaces often render the effect object
    // directly rather than the full spell prose. A schema-valid effect with an
    // empty or generic description still leaves the runtime trace mechanically
    // opaque, especially for damage, status, save, and targeting-heavy rows.
    //
    // G8/G9 cleared the current corpus, so this rule is intentionally a hard
    // regression gate: future rows must describe the structured effect they add
    // instead of using placeholders like "See description.".
    const genericEffectDescriptions = new Set(['see description', 'see description.', 'varies', 'varies.', 'special', 'special.']);

    // These phrases describe migration internals rather than player-visible or
    // runtime-visible spell behavior. They appeared during blank-description
    // repair batches as cautious placeholders, but they still force UI, logs,
    // and future audits to understand importer history instead of the effect.
    const internalScaffoldPhrases = [
      'row\'s current hit-based resolution',
      'row\'s current always-on',
      'row\'s always-on',
      'row\'s summoning effect',
      'row\'s scaling formula',
      'row\'s special duration',
      'current row preserves',
      'current row records',
      'preserved from the current row',
      'current data keeps',
      'current terrain scaffold',
      'current escape-check metadata',
      'always-on damage scaffold',
      'always-on healing scaffold',
      'always-on status scaffold',
      'always-on summoning scaffold',
      'per ray hit'
    ];

    const effects = Array.isArray(spell.effects) ? spell.effects : [];
    const longDescriptionOwners = new Map<string, number>();
    const normalizedSpellDescription = (spell.description || '').replace(/[\s\W_]+/g, '').toLowerCase();

    effects.forEach((effect, index) => {
      const effectDescription = (effect.description || '').trim();

      if (!effectDescription) {
        errors.push(`Effect Description Gap: effect ${index} has a blank description`);
        return;
      }

      if (genericEffectDescriptions.has(effectDescription.toLowerCase())) {
        errors.push(`Effect Description Placeholder: effect ${index} uses generic placeholder "${effectDescription}"`);
      }

      // Reject importer-facing descriptions even when they are non-empty. The
      // effect text should say what the spell does in game terms, not which
      // transitional data row or scaffold produced it.
      const scaffoldPhrase = internalScaffoldPhrases.find(phrase =>
        effectDescription.toLowerCase().includes(phrase.toLowerCase())
      );

      if (scaffoldPhrase) {
        errors.push(`Effect Description Internal Scaffold: effect ${index} uses importer-facing wording "${scaffoldPhrase}"`);
      }

      // A long description repeated across multiple effect rows usually means
      // the whole spell or mode menu was pasted into each row. That makes UI
      // rows and runtime logs unable to explain which specific effect fired.
      if (effectDescription.length >= 160) {
        const normalizedLongDescription = effectDescription.replace(/[\s\W_]+/g, '').toLowerCase();
        const firstEffectIndex = longDescriptionOwners.get(normalizedLongDescription);

        if (firstEffectIndex !== undefined) {
          errors.push(`Effect Description Duplicate: effects ${firstEffectIndex} and ${index} share the same long description`);
        } else {
          longDescriptionOwners.set(normalizedLongDescription, index);
        }

        // Damage rows should explain their own dice/save/trigger payload rather
        // than repeat the whole spell prose. Non-damage utility rows can still
        // be broad narrative scaffolds until their mechanics are split later.
        if (
          effect.type === 'DAMAGE' &&
          normalizedSpellDescription &&
          (
            normalizedLongDescription === normalizedSpellDescription ||
            normalizedSpellDescription.includes(normalizedLongDescription) ||
            normalizedLongDescription.includes(normalizedSpellDescription)
          )
        ) {
          errors.push(`Effect Description Copied Spell Prose: damage effect ${index} duplicates the top-level spell description`);
        }
      }
    });

    // =========================================================================
    // Rule 11: Effect Target Filter Completeness
    // =========================================================================
    // Some spells restrict the legal target at the spell picker level, for
    // example "only Humanoids" or "only Beasts". When a direct effect later
    // acts on that same target, the effect payload should repeat the restriction
    // so command creation, delayed execution, logs, and future audit tooling can
    // understand the legal target without re-reading the top-level targeting
    // object.
    //
    // Not every mismatch is a bug. Some top-level filters describe a plant or
    // object selected as a source, a chosen form, a later repair target, or an
    // ongoing area rule. Those rows stay explicitly classified here until their
    // dedicated semantic models exist, preventing broad blind filter copying.
    const classifiedRestrictedFilterMismatches = new Set<string>(
      SpellIntegrityValidator.getClassifiedRestrictedFilterMismatchKeys()
    );

    const spellFilter = spell.targeting?.filter as Partial<Record<RestrictedFilterKey, unknown>> | undefined;
    const restrictedKeys = RESTRICTED_FILTER_KEYS.filter(key =>
      normalizeFilterValues(spellFilter?.[key], key).length > 0
    );

    if (restrictedKeys.length > 0) {
      effects.forEach((effect, index) => {
        const effectFilter = effect.condition?.targetFilter as Partial<Record<RestrictedFilterKey, unknown>> | undefined;

        if (!effectFilter) {
          return;
        }

        restrictedKeys.forEach(key => {
          const mismatchKey = `${spell.id}:${index}:${key}`;

          if (
            !classifiedRestrictedFilterMismatches.has(mismatchKey)
            && !sameFilterValues(spellFilter?.[key], effectFilter[key], key)
          ) {
            errors.push(`Effect Target Filter Gap: effect ${index} does not repeat spell-level ${key} restriction`);
          }
        });
      });
    }

    return errors;
  }
}
