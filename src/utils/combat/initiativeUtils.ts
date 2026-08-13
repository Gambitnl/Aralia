// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 04:16:31
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, hooks/combat/useTurnManager.ts, hooks/combat/useTurnOrder.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file builds the canonical combat initiative sequence.
 *
 * Combatants act from the highest initiative total to the lowest. Equal totals
 * use the real Dexterity score and initiative bonus as deterministic facts,
 * then preserve the encounter's authored order when every fact still ties.
 * Summons whose live metadata says they share initiative remain directly after
 * their caster, but they still receive their own turn because the combat engine
 * does not currently execute several actors inside one simultaneous group turn.
 *
 * Called by: useTurnOrder and useTurnManager.
 * Depends on: CombatCharacter initiative, stats, and summon metadata.
 */

import type { CombatCharacter } from '../../types/combat';

export function rollInitiativeTotal(
  character: CombatCharacter,
  randomSource: () => number = Math.random,
): number {
  // Convert the supplied random fraction into the same inclusive d20 face used
  // by production combat, then add Dexterity and the authored initiative bonus.
  const dexterityModifier = Math.floor((character.stats.dexterity - 10) / 2);
  const d20Face = Math.floor(randomSource() * 20) + 1;
  return d20Face + dexterityModifier + character.stats.baseInitiative;
}

// ============================================================================
// Canonical Tie-Break Facts
// ============================================================================
// These comparisons use only durable combat facts. Returning zero preserves the
// input order through JavaScript's stable sort, which makes exact replays agree
// without pretending an arbitrary character id is a D&D rule.
// ============================================================================

export function compareInitiativeTieFacts(
  first: CombatCharacter,
  second: CombatCharacter,
): number {
  // The initiative total is always the primary ordering fact.
  const totalDifference = second.initiative - first.initiative;
  if (totalDifference !== 0) {
    return totalDifference;
  }

  // A higher Dexterity score decides a tied total before any lower-priority
  // authored ordering is considered.
  const dexterityDifference = second.stats.dexterity - first.stats.dexterity;
  if (dexterityDifference !== 0) {
    return dexterityDifference;
  }

  // Initiative bonuses distinguish combatants whose total and Dexterity score
  // match, including monsters that add proficiency through baseInitiative.
  return second.stats.baseInitiative - first.stats.baseInitiative;
}

// ============================================================================
// Shared-Initiative Sequence Assembly
// ============================================================================
// Shared-initiative summons are consecutive actors, not one merged actor. The
// scheduler therefore anchors each summon immediately after its caster while
// preserving exactly one id per living combatant in the final sequence.
// ============================================================================

function isAnchoredSharedSummon(
  character: CombatCharacter,
  availableIds: ReadonlySet<string>,
): boolean {
  return Boolean(
    character.isSummon
      && character.summonMetadata?.initiativePolicy === 'shared'
      && availableIds.has(character.summonMetadata.casterId),
  );
}

export function buildInitiativeOrder(
  characters: CombatCharacter[],
): CombatCharacter[] {
  const availableIds = new Set(characters.map(character => character.id));
  const sharedSummonsByCaster = new Map<string, CombatCharacter[]>();

  // Separate anchored summons from ordinary initiative heads. Orphaned shared
  // summons remain ordinary actors so a missing caster never makes one vanish.
  const initiativeHeads = characters.filter(character => {
    if (!isAnchoredSharedSummon(character, availableIds)) {
      return true;
    }

    const casterId = character.summonMetadata!.casterId;
    const currentSummons = sharedSummonsByCaster.get(casterId) ?? [];
    currentSummons.push(character);
    sharedSummonsByCaster.set(casterId, currentSummons);
    return false;
  });

  const ordered: CombatCharacter[] = [];
  const appendActorAndSharedFollowers = (actor: CombatCharacter): void => {
    ordered.push(actor);

    // Several summons may share one caster's count. Tie facts order those
    // followers deterministically, while the set prevents accidental repeats.
    const followers = [...(sharedSummonsByCaster.get(actor.id) ?? [])]
      .sort(compareInitiativeTieFacts);
    for (const follower of followers) {
      appendActorAndSharedFollowers(follower);
    }
  };

  for (const actor of [...initiativeHeads].sort(compareInitiativeTieFacts)) {
    appendActorAndSharedFollowers(actor);
  }

  return ordered;
}
