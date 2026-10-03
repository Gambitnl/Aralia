/**
 * @file spellValidator.ts
 * 
 * PURPOSE:
 * This file defines the Zod schema used for validating every Spell JSON file in the codebase.
 * It ensures that our "Gold Standard" data remains structuraly sound and consistent.
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Added an explicit 'any' type to 
 * the 'cls' parameter in the 'BASE_CLASS_NAMES' mapping to resolve 
 * implicit any warnings in the script environment.
 * 2026-09-09: [MOD-3.2, board agora-907c.6] Split the schema body out of this
 * file. The primitive/base shapes moved to ./schemas/spellPrimitives.ts and the
 * per-effect-type schemas plus the SpellEffect union moved to
 * ./schemas/spellEffectSchemas.ts, in their original declaration order (these
 * Zod shapes are order-sensitive). This file keeps the SpellValidator object
 * schema and its .superRefine cross-field checks, and stays the barrel: it
 * re-exports both new modules, so every existing import of this path -- and of
 * SummonedEntityStatBlock -- resolves unchanged. No schema was renamed,
 * reordered, loosened, or removed.
 * 
 * WHO USES THIS:
 * 1. Data Validation Script (`scripts/validate-data.ts`): Runs during `npm run validate`.
 * 2. Spell Migration Service: Used by the AI agents when converting new spells to JSON.
 * 3. Combat Engine: Relies on these keys existing to avoid runtime undefined errors.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 09/09/2026, 14:21:17
 * Dependents: components/Glossary/spellGateChecker/buckets/castingTime.ts, components/Glossary/spellGateChecker/buckets/classes.ts, components/Glossary/spellGateChecker/buckets/components.ts, components/Glossary/spellGateChecker/buckets/description.ts, components/Glossary/spellGateChecker/buckets/duration.ts, components/Glossary/spellGateChecker/buckets/higherLevels.ts, components/Glossary/spellGateChecker/buckets/material.ts, components/Glossary/spellGateChecker/buckets/rangeArea.ts, components/Glossary/spellGateChecker/buckets/subClasses.ts, components/Glossary/spellGateChecker/spellGateSelectedRefresh.ts, components/Glossary/spellGateChecker/useSpellGateChecks.ts, data/summonTemplates.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { z } from 'zod';
import { Targeting } from './targetingSchemas';
import { EffectSchedule } from './effectScheduleSchemas';
import { DurationProgression } from './durationProgressionSchemas';
import { ModeChoice } from './modeChoiceSchemas';
import {
  AIContext,
  ArbitrationType,
  CastingTime,
  Components,
  Duration,
  HigherLevelScaling,
  PendingAttackTrigger,
  Range,
  SpellAccessGrant,
  SpellCastingTrigger,
  SpellClassAccess,
  SpellInterruptionState,
  SpellRarity,
  SpellSchool,
} from './schemas/spellPrimitives';
import { SpellEffect } from './schemas/spellEffectSchemas';

// Barrel re-exports: this module path stays the single public entry point for
// the spell schema, so no consumer import had to be rewritten by the split.
export * from './schemas/spellPrimitives';
export * from './schemas/spellEffectSchemas';

/**
 * MAIN SPELL VALIDATOR
 * The root schema for a Spell JSON file.
 * 
 * Key Pillars:
 * - arbitrationType: Determines if the engine (mechanical) or DM (ai_dm) handles it.
 * - aiContext: Instructions for the AI DM for non-mechanical outcomes.
 * - effects: Array of structured mechanical results.
 * - description: Flavor text for the Glossary.
 * - source: intentionally not part of the live schema anymore. The spell JSON files
 *   no longer carry a top-level source field, so validation should not keep enforcing
 *   a dead requirement that the dataset has already moved away from.
 */
export const SpellValidator = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  level: z.number(),
  school: SpellSchool,
  legacy: z.boolean(),
  // Spread the dedicated class-access schema into the main spell shape so the
  // validator can enforce the explicit split everywhere, not only in new data.
  ...SpellClassAccess.shape,
  accessGrants: z.array(SpellAccessGrant).optional(),
  ritual: z.boolean(), // Validation Rule: Must be false for Level 0 (enforce via .refine or subclass)
  // Spell-side ritual data the ritual runtime reads: ceremony requirements, the
  // consequence of a failed ceremony, and a prose casting time for spells whose
  // header reads "Special". Optional because most spells hold no ritual block.
  ritualData: z.object({
    requirements: z.array(z.object({
      type: z.enum(['time_of_day', 'location', 'biome', 'weather', 'participants_count', 'custom']),
      value: z.union([z.string(), z.number(), z.array(z.string())]),
      description: z.string().optional(),
    })).optional(),
    backlash: z.object({
      type: z.enum(['damage', 'status', 'summon', 'area_damage', 'drain_slot']),
      value: z.string(),
      damageType: z.string().optional(),
      radius: z.number().optional(),
      saveDC: z.number().optional(),
      minProgress: z.number().optional(),
      description: z.string(),
    }).optional(),
    castingTimeSpecial: z.string().optional(),
  }).optional(),
  rarity: SpellRarity,
  attackType: z.string(),
  castingTime: CastingTime,
  range: Range,
  components: Components,
  duration: Duration,
  targeting: Targeting,
  // Mode choice records spell menus such as "choose one of the following
  // effects." The actual payload still lives in effects/controlOptions.
  modeChoice: ModeChoice.optional(),
  // Spell-level triggers are runtime routing contracts for spells whose legal
  // casting moment is created by another event, such as a hit or an enemy cast.
  castingTrigger: SpellCastingTrigger.optional(),
  pendingAttackTrigger: PendingAttackTrigger.optional(),
  interruptionState: SpellInterruptionState.optional(),
  // Effect schedules describe when already-modeled effects become active for
  // spells with turn-numbered stages. The field is optional so ordinary spells
  // do not have to carry an empty schedule object.
  effectSchedule: EffectSchedule.optional(),
  effects: z.array(SpellEffect),
  arbitrationType: ArbitrationType,
  aiContext: AIContext,
  description: z.string(),
  higherLevels: z.string(),
  higherLevelScaling: HigherLevelScaling.optional(),
  durationProgression: z.array(DurationProgression).optional(),
  tags: z.array(z.string()),
}).superRefine((spell, ctx) => {
  /**
   * SUPER REFINE LOGIC
   * Performs advanced validation that can't be expressed by simple types.
   * Currently handles:
   * 1. Material Component Cost Mismatch (checks desc vs numeric data)
   * 2. Material Consumption Mismatch (checks desc vs boolean flag)
   */
  if (spell.components.material) {
    const desc = spell.components.materialDescription || '';

    // Check for Cost Mismatch
    const costMatches = Array.from(desc.matchAll(/worth (?:at least )?([\d,]+)(?:\+)? gp/gi));
    if (costMatches.length) {
      const foundCosts = costMatches
        .map(m => parseInt(String(m[1]).replace(/,/g, ''), 10))
        .filter(n => Number.isFinite(n));

      const expectedCost = foundCosts.length === 1 ? foundCosts[0] : undefined;
      const expectedSum = foundCosts.reduce((sum, n) => sum + n, 0);
      const expectedMax = foundCosts.length ? Math.max(...foundCosts) : undefined;
      const actualCost = spell.components.materialCost;

      // Allow for "each" pricing logic (e.g. "each worth 5 gp" for multiple components).
      // If the actual cost is an integer multiple of the found cost, we assume it's intentional.
      const isPair = desc.includes('pair') || desc.includes('each');

      const actualCostNumber = actualCost ?? 0;

      // Multiple distinct costs are inherently ambiguous (sum vs max vs quantity multipliers),
      // so accept either the max single component cost or the straight sum.
      if (foundCosts.length >= 2) {
        const ok =
          actualCost != null &&
          (actualCostNumber === expectedSum ||
            (expectedMax != null && actualCostNumber === expectedMax) ||
            (isPair && expectedMax != null && expectedMax > 0 && actualCostNumber % expectedMax === 0));

        if (!ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Material cost mismatch: Description costs suggest ${expectedMax ?? 0} gp (max) or ${expectedSum} gp (sum), but data has ${actualCostNumber} gp.`,
            path: ['components', 'materialCost'],
          });
        }
      } else if (expectedCost != null && actualCostNumber !== expectedCost) {
        if (
          isPair &&
          expectedCost > 0 &&
          actualCost != null &&
          Number.isFinite(actualCost) &&
          actualCostNumber % expectedCost === 0 &&
          actualCostNumber >= expectedCost * 2
        ) {
          // Acceptable deviation for multi-item "each" pricing
        } else {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Material cost mismatch: Description says ${expectedCost} gp, but data has ${actualCostNumber} gp.`,
            path: ['components', 'materialCost'],
          });
        }
      }
    }

    // Check for Consumption Mismatch
    const consumedMatch = desc.match(/consumes?|consumed/i);
    const expectedConsumed = !!consumedMatch;
    const actualConsumed = spell.components.isConsumed ?? false;

    if (expectedConsumed && !actualConsumed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Material consumption mismatch: Description implies consumption, but isConsumed is false/missing.`,
        path: ['components', 'isConsumed'],
      });
    }
  }

  // Subclass verification refinement retired 2026-05-11 with the field.
  // See SpellClassAccess above for context.
});


