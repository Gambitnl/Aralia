// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 14:34:24
 * Dependents: utils/combat/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Alchemist (Artificer) Experimental Elixir.
 *
 * At level 3 the Alchemist can produce an Experimental Elixir. The d6-selected
 * effect is one of six authored outcomes. This file owns the effect catalog, the
 * deterministic creation roll, and the drink resolution (healing or a status
 * buff) so a caller does not hand-roll the d6 or the healing in preview text.
 */

import type { CombatCharacter, CombatState } from '../../types/combat';
import { rollDice } from './combatUtils';

export const EXPERIMENTAL_ELIXIR_FEATURE_ID = 'experimental_elixir';
export const HEALING_ELIXIR_DICE = '2d4';
export const HEALING_ELIXIR_FLAT_BONUS = 2;

export type ElixirEffectKind = 'healing' | 'buff';

export interface ExperimentalElixirEffect {
  id: string;
  name: string;
  description: string;
  kind: ElixirEffectKind;
}

export const EXPERIMENTAL_ELIXIR_EFFECTS: ExperimentalElixirEffect[] = [
  { id: 'healing', name: 'Healing', description: 'Regain 2d4 + 2 hit points.', kind: 'healing' },
  { id: 'swiftness', name: 'Swiftness', description: 'Gain a +10-foot bonus to Speed for 1 hour.', kind: 'buff' },
  { id: 'resilience', name: 'Resilience', description: 'Gain a +1 bonus to Armor Class for 10 minutes.', kind: 'buff' },
  { id: 'boldness', name: 'Boldness', description: 'Roll a d4 and add it to one attack roll or saving throw within 1 minute.', kind: 'buff' },
  { id: 'flight', name: 'Flight', description: 'Gain a 10-foot Fly Speed for 10 minutes.', kind: 'buff' },
  { id: 'transformation', name: 'Transformation', description: 'Alter Self for 10 minutes.', kind: 'buff' },
];

export function getExperimentalElixirEffect(effectId: string): ExperimentalElixirEffect | undefined {
  return EXPERIMENTAL_ELIXIR_EFFECTS.find(effect => effect.id === effectId);
}

export function hasExperimentalElixir(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === EXPERIMENTAL_ELIXIR_FEATURE_ID);
}

// ============================================================================
// Creation
// ============================================================================

export interface CreatedElixir {
  effectId: string;
  effectName: string;
  effectDescription: string;
}

/** Deterministically rolls the d6 and returns the authored elixir effect. */
export function rollExperimentalElixirEffect(rng: () => number = Math.random): ExperimentalElixirEffect {
  const index = Math.min(
    EXPERIMENTAL_ELIXIR_EFFECTS.length - 1,
    Math.floor(rng() * EXPERIMENTAL_ELIXIR_EFFECTS.length),
  );
  return EXPERIMENTAL_ELIXIR_EFFECTS[index];
}

export function createExperimentalElixir(rng: () => number = Math.random): CreatedElixir {
  const effect = rollExperimentalElixirEffect(rng);
  return {
    effectId: effect.id,
    effectName: effect.name,
    effectDescription: effect.description,
  };
}

// ============================================================================
// Drink Resolution
// ============================================================================

export type DrinkElixirFailure = 'drinker_missing' | 'unknown_effect';

export interface DrinkElixirResult {
  state: CombatState;
  resolved: boolean;
  failure?: DrinkElixirFailure;
  effectId?: string;
  healingApplied?: number;
}

export function resolveDrinkExperimentalElixir(
  state: CombatState,
  request: { drinkerId: string; effectId: string; rng?: () => number },
): DrinkElixirResult {
  const drinker = state.characters.find(character => character.id === request.drinkerId);
  if (!drinker) return { state, resolved: false, failure: 'drinker_missing' };

  const effect = getExperimentalElixirEffect(request.effectId);
  if (!effect) return { state, resolved: false, failure: 'unknown_effect' };

  if (effect.kind === 'healing') {
    const healingApplied = Math.max(0, Math.min(
      drinker.maxHP - drinker.currentHP,
      rollDice(HEALING_ELIXIR_DICE, { rng: request.rng }) + HEALING_ELIXIR_FLAT_BONUS,
    ));
    const nextDrinker: CombatCharacter = { ...drinker, currentHP: drinker.currentHP + healingApplied };
    return {
      state: {
        ...state,
        characters: state.characters.map(character => (
          character.id === drinker.id ? nextDrinker : character
        )),
      },
      resolved: true,
      effectId: effect.id,
      healingApplied,
    };
  }

  const nextDrinker: CombatCharacter = {
    ...drinker,
    statusEffects: [
      ...drinker.statusEffects,
      {
        id: `experimental-elixir-${effect.id}-${drinker.id}`,
        name: effect.name,
        type: 'buff',
        duration: 10,
        source: 'Experimental Elixir',
        icon: '🧪',
      },
    ],
  };
  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === drinker.id ? nextDrinker : character
      )),
    },
    resolved: true,
    effectId: effect.id,
  };
}
