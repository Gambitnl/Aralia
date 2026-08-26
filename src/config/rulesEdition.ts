/**
 * @file src/config/rulesEdition.ts
 * The global rules-edition setting (agora-18ab). Remy ruled "offer both": a
 * campaign is played under either the 2014 Player's Handbook or the 2024 one,
 * and the choice is persisted on GameState so it travels with the save.
 *
 * This module is the ONE place that knows the default. Every consumer reads the
 * setting through `getRulesEdition` rather than defaulting for itself, so an old
 * save that predates the field resolves to 2024 in exactly one line of code.
 */

/** The two rulebooks a campaign can be played under. */
export const RULES_EDITIONS = ['2024', '2014'] as const;
export type RulesEdition = (typeof RULES_EDITIONS)[number];

/** Campaigns default to the 2024 PHB, which is the canon the class data encodes. */
export const DEFAULT_RULES_EDITION: RulesEdition = '2024';

export const isRulesEdition = (value: unknown): value is RulesEdition =>
  typeof value === 'string' && (RULES_EDITIONS as readonly string[]).includes(value);

export const nextRulesEdition = (current: RulesEdition): RulesEdition =>
  RULES_EDITIONS[(RULES_EDITIONS.indexOf(current) + 1) % RULES_EDITIONS.length];

export const RULES_EDITION_LABEL: Record<RulesEdition, string> = {
  '2024': '2024 PHB',
  '2014': '2014 PHB',
};

/**
 * THE reader for the rules-edition setting. Consumers must call this instead of
 * reading `state.rulesEdition` directly, because a save written before the field
 * existed carries `undefined` and must resolve to the 2024 default here and
 * nowhere else.
 */
export function getRulesEdition(
  state: { rulesEdition?: RulesEdition } | null | undefined,
): RulesEdition {
  const stored = state?.rulesEdition;
  return isRulesEdition(stored) ? stored : DEFAULT_RULES_EDITION;
}

/**
 * The level at which each class chooses its subclass under the 2014 PHB. The
 * 2024 PHB moved every class to level 3, which is what `src/data/classes` and
 * `tierOneFeatures.ts` already encode, so only the 2014 exceptions are listed.
 */
export const SUBCLASS_LEVEL_2014: Readonly<Record<string, number>> = {
  cleric: 1,
  sorcerer: 1,
  warlock: 1,
  druid: 2,
  wizard: 2,
};

/** Under the 2024 PHB every class chooses its subclass at level 3. */
export const SUBCLASS_LEVEL_2024 = 3;

/**
 * The level at which `classId` chooses its subclass under `edition`.
 * Warlock is the only class wired to this helper today; the remaining 2014
 * exceptions have their own board tasks.
 */
export function getSubclassLevel(classId: string, edition: RulesEdition): number {
  if (edition === '2014') {
    return SUBCLASS_LEVEL_2014[classId] ?? SUBCLASS_LEVEL_2024;
  }
  return SUBCLASS_LEVEL_2024;
}
