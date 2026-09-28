/**
 * Assassin (Rogue) Assassinate and tool proficiencies.
 *
 * Assassinate grants advantage on attacks against a creature that has not yet
 * acted this round and turns a hit against a surprised creature into a critical.
 * This file owns the subclass-aware roll modifiers so a caller does not
 * hand-roll either rule in preview text, plus the disguise/poisoner kit merge
 * for the level-3 tool grant. Both are gated on the `assassinate` ability, so a
 * non-Assassin rogue never inherits the modifiers.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: hooks/combat/useActionExecutor.ts, utils/combat/combatUtils.ts, utils/combat/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatCharacter, CombatState } from '../../types/combat';

export const ASSASSINATE_FEATURE_ID = 'assassinate';
export const ASSASSINS_TOOLS_FEATURE_ID = 'assassins_tools';

// ============================================================================
// Tool Proficiencies
// ============================================================================

export const ASSASSIN_TOOL_PROFICIENCIES = ['disguise_kit', 'poisoners_kit'] as const;
export type AssassinToolProficiency = (typeof ASSASSIN_TOOL_PROFICIENCIES)[number];

export function hasAssassinsTools(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === ASSASSINS_TOOLS_FEATURE_ID);
}

/**
 * Merges the Assassin's disguise kit and poisoner's kit into an existing
 * proficiency list without duplicating entries. The caller persists the result
 * onto the character's tool proficiencies.
 */
export function mergeAssassinToolProficiencies(toolProficiencies: string[] = []): string[] {
  const merged = new Set(toolProficiencies);
  for (const tool of ASSASSIN_TOOL_PROFICIENCIES) merged.add(tool);
  return Array.from(merged);
}

// ============================================================================
// Assassinate Roll Modifiers
// ============================================================================

export function hasAssassinate(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === ASSASSINATE_FEATURE_ID);
}

export interface AssassinateTargetState {
  /** Whether the target has already taken a turn in the current round. */
  hasActedThisRound: boolean;
  /** Whether the target is currently surprised. */
  isSurprised: boolean;
}

export interface AssassinateModifiers {
  /** Advantage on attacks against a creature that has not acted yet this round. */
  advantage: boolean;
  /** A hit against a surprised creature is a critical. */
  criticalOnHit: boolean;
}

export function calculateAssassinateModifiers(
  assassin: CombatCharacter,
  target: AssassinateTargetState,
): AssassinateModifiers {
  if (!hasAssassinate(assassin)) return { advantage: false, criticalOnHit: false };
  return {
    advantage: !target.hasActedThisRound,
    criticalOnHit: target.isSurprised,
  };
}

// ============================================================================
// Turn-Order Derivation
// ============================================================================
// "Has not acted yet this round" is a fact the initiative order already holds:
// a creature earlier in `turnOrder` than the current index has taken its turn,
// and every creature at or after that index has not. Deriving it here stops
// each caller from re-reading the initiative order and guessing.
//
// Surprise is different. This engine carries no surprise state at all — there
// is no surprised condition, status effect, or initiative flag anywhere in the
// combat types — so `targetIsSurprised` stays an explicit caller fact rather
// than a derived one. When a surprise round lands, this is the single place
// that reads it.
// ============================================================================

export type AssassinateFailure =
  | 'assassin_missing'
  | 'target_missing'
  | 'missing_assassinate'
  | 'target_not_in_turn_order';

export interface AssassinateResolution {
  modifiers: AssassinateModifiers;
  resolved: boolean;
  failure?: AssassinateFailure;
  /** The derived fact the modifiers were built from, for the combat log. */
  targetHasActedThisRound?: boolean;
}

/**
 * Reports whether a creature has already taken its turn in the current round.
 * Returns undefined when the creature is not in the initiative order, so the
 * caller can fail instead of treating an unknown creature as a fresh target.
 */
export function hasActedThisRound(state: CombatState, characterId: string): boolean | undefined {
  const index = state.turnState.turnOrder.indexOf(characterId);
  if (index === -1) return undefined;
  return index < state.turnState.currentTurn;
}

/**
 * The Assassinate entry point for attack resolution. It reads both combatants
 * out of the state, derives the target's turn status from the initiative
 * order, and returns the advantage/critical modifiers to apply to the pending
 * attack roll. A rogue without the `assassinate` ability gets neither.
 */
export function resolveAssassinateAgainstTarget(
  state: CombatState,
  request: { assassinId: string; targetId: string; targetIsSurprised: boolean },
): AssassinateResolution {
  const none: AssassinateModifiers = { advantage: false, criticalOnHit: false };

  const assassin = state.characters.find(character => character.id === request.assassinId);
  if (!assassin) return { modifiers: none, resolved: false, failure: 'assassin_missing' };
  if (!hasAssassinate(assassin)) {
    return { modifiers: none, resolved: false, failure: 'missing_assassinate' };
  }

  const target = state.characters.find(character => character.id === request.targetId);
  if (!target) return { modifiers: none, resolved: false, failure: 'target_missing' };

  const targetHasActedThisRound = hasActedThisRound(state, target.id);
  if (targetHasActedThisRound === undefined) {
    return { modifiers: none, resolved: false, failure: 'target_not_in_turn_order' };
  }

  return {
    modifiers: calculateAssassinateModifiers(assassin, {
      hasActedThisRound: targetHasActedThisRound,
      isSurprised: request.targetIsSurprised,
    }),
    resolved: true,
    targetHasActedThisRound,
  };
}
