// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 15/07/2026, 22:29:48
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
        optionCount?: unknown;
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
        if (modeChoice.optionCount !== modeChoice.options.length) {
          errors.push(`Mode Choice Invalid: optionCount ${String(modeChoice.optionCount)} does not match options length ${modeChoice.options.length}`);
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

      const grantedActions = (effect as { grantedActions?: Array<{
        type?: unknown;
        action?: unknown;
        frequency?: unknown;
        rangeLimit?: unknown;
      }> }).grantedActions;

      if (Array.isArray(grantedActions)) {
        grantedActions.forEach((grantedAction, actionIndex) => {
          if (!knownActionCosts.includes(String(grantedAction.type))) {
            errors.push(`Action Cost Invalid: effect ${effectIndex} granted action ${actionIndex} uses unknown type "${String(grantedAction.type)}"`);
          }

          if (typeof grantedAction.action !== 'string' || grantedAction.action.trim().length === 0) {
            errors.push(`Action Cost Invalid: effect ${effectIndex} granted action ${actionIndex} must include a non-empty action label`);
          }

          if (typeof grantedAction.frequency !== 'string' || grantedAction.frequency.trim().length === 0) {
            errors.push(`Action Cost Invalid: effect ${effectIndex} granted action ${actionIndex} must include a non-empty frequency`);
          }

          if (grantedAction.rangeLimit !== undefined && typeof grantedAction.rangeLimit !== 'number') {
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

      // Social enchantments like Suggestion constrain targets through explicit
      // communication prerequisites rather than a creature-type list. Treat any
      // required hearing/understanding/sight gate as a real targeting filter.
      const communication = filter?.communicationPrerequisites;
      const hasCommunicationPrerequisites = Boolean(
        communication?.canHearCaster === 'required'
        || communication?.canUnderstandCaster === 'required'
        || communication?.canSeeCaster === 'required'
      );

      // If no recognized gate is populated, the targeting is unconstrained.
      if (!hasInclusions && !hasExclusions && !hasCommunicationPrerequisites) {
        errors.push(`Enchantment Gap: Single-target Enchantment spell has no targeting filters (expected creature type, exclusion, or communication restriction)`);
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

    // =========================================================================
    // Rule 5: Effect Description Completeness
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
    // Rule 6: Effect Target Filter Completeness
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
    const restrictedFilterKeys = ['creatureTypes', 'excludeCreatureTypes', 'sizes', 'alignments'] as const;
    type RestrictedFilterKey = typeof restrictedFilterKeys[number];

    const classifiedRestrictedFilterMismatches = new Set<string>(
      SpellIntegrityValidator.getClassifiedRestrictedFilterMismatchKeys()
    );

    const normalizeFilterValues = (value: unknown, key?: RestrictedFilterKey): string[] => {
      if (!Array.isArray(value)) {
        return [];
      }

      // The spell data sometimes records "Huge or smaller" as explanatory
      // source text while the effect payload stores the actual creature sizes.
      // Treat those as the same filter for validation so rows like Tsunami's
      // ongoing wave damage do not need a permanent semantic exception.
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
    };

    const sameFilterValues = (left: unknown, right: unknown, key?: RestrictedFilterKey): boolean => {
      const normalizedLeft = normalizeFilterValues(left, key);
      const normalizedRight = normalizeFilterValues(right, key);

      return normalizedLeft.length === normalizedRight.length
        && normalizedLeft.every((value, index) => value === normalizedRight[index]);
    };

    const spellFilter = spell.targeting?.filter as Partial<Record<RestrictedFilterKey, unknown>> | undefined;
    const restrictedKeys = restrictedFilterKeys.filter(key =>
      normalizeFilterValues(spellFilter?.[key]).length > 0
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
