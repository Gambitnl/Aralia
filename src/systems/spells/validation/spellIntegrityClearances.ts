import type { Spell } from '../../../types/spells';

/**
 * Reviewed single-effect spells. Only the monolithic-description heuristic is
 * cleared; every other mechanical integrity failure still blocks validation.
 * Keep this policy shared by the corpus tests and the command-line gate.
 */
export const REVIEWED_MONOLITHIC_EFFECT_CLEARANCES = {
  light: 'One structured light-emission effect; object targeting, radius, color, cover blocking, and recast ending are already modeled.',
  'gentle-repose': 'One corpse/remains protection effect; its target identity filter carries the mechanical gate.',
  'see-invisibility': 'One self-applied sensory effect with no separate damage, status, or action payload.',
  'enhance-ability': 'One advantage-granting effect; scalable targets and the required per-target ability choice are modeled in targeting metadata.',
} as const;

export function filterReviewedMonolithicClearance(
  spell: Pick<Spell, 'id'>,
  errors: readonly string[],
): string[] {
  if (!Object.hasOwn(REVIEWED_MONOLITHIC_EFFECT_CLEARANCES, spell.id)) {
    return [...errors];
  }
  return errors.filter((error) => error !== 'Monolithic Effect Description');
}
