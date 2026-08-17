// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 16:29:14
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
 * Armorer (Artificer) Arcane Armor — Guardian and Infiltrator models.
 *
 * At level 3 the Armorer turns heavy armor into a conduit: the Guardian model
 * gains Thunder Gauntlets (thunder damage + a taunt that penalizes attacks
 * against others) and the Infiltrator model gains a Lightning Launcher. This
 * file owns the model choice and each model's attack transaction, gated on the
 * `arcane_armor` ability and the persisted `armorerModel`.
 */

import type { CombatCharacter, CombatState } from '../../types/combat';
import { rollDice } from './combatUtils';

export const ARCANE_ARMOR_FEATURE_ID = 'arcane_armor';
export const THUNDER_GAUNTLET_DICE = '1d8';
export const LIGHTNING_LAUNCHER_DICE = '1d6';

export type ArmorerModel = NonNullable<CombatCharacter['armorerModel']>;

export interface ArmorerModelDefinition {
  id: ArmorerModel;
  name: string;
  description: string;
}

export const ARMORER_MODELS: Record<ArmorerModel, ArmorerModelDefinition> = {
  guardian: {
    id: 'guardian',
    name: 'Guardian',
    description: 'Thunder Gauntlets taunt foes and deal thunder damage; Defensive Field grants temporary HP.',
  },
  infiltrator: {
    id: 'infiltrator',
    name: 'Infiltrator',
    description: 'Lightning Launcher fires a ranged bolt of lightning damage.',
  },
};

export function isArmorerModel(id: string): id is ArmorerModel {
  return id in ARMORER_MODELS;
}

export function hasArcaneArmor(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === ARCANE_ARMOR_FEATURE_ID);
}

export function getArmorerModel(character: CombatCharacter): ArmorerModel | undefined {
  return character.armorerModel;
}

/** Persists the chosen model onto the Armorer. Unknown ids are rejected. */
export function applyArmorerModel<T extends CombatCharacter>(character: T, model: string): T {
  if (!isArmorerModel(model)) return character;
  return { ...character, armorerModel: model };
}

// ============================================================================
// Guardian — Thunder Gauntlets
// ============================================================================

export type ThunderGauntletFailure = 'armorer_missing' | 'wrong_model' | 'target_missing';

export interface ThunderGauntletResult {
  state: CombatState;
  resolved: boolean;
  failure?: ThunderGauntletFailure;
  damageApplied?: number;
}

export function resolveThunderGauntlet(
  state: CombatState,
  request: { armorerId: string; targetId: string; rng?: () => number },
): ThunderGauntletResult {
  const armorer = state.characters.find(character => character.id === request.armorerId);
  if (!armorer) return { state, resolved: false, failure: 'armorer_missing' };
  if (!hasArcaneArmor(armorer) || getArmorerModel(armorer) !== 'guardian') {
    return { state, resolved: false, failure: 'wrong_model' };
  }

  const target = state.characters.find(character => character.id === request.targetId);
  if (!target) return { state, resolved: false, failure: 'target_missing' };

  const damageApplied = Math.max(0, Math.min(target.currentHP, rollDice(THUNDER_GAUNTLET_DICE, { rng: request.rng })));

  const nextTarget: CombatCharacter = {
    ...target,
    currentHP: target.currentHP - damageApplied,
    statusEffects: [
      ...target.statusEffects,
      {
        id: `thunder-gauntlet-taunt-${armorer.id}-${target.id}`,
        name: 'Taunted',
        type: 'debuff',
        duration: 1,
        source: 'Thunder Gauntlets',
        sourceCasterId: armorer.id,
        icon: '⚡',
      },
    ],
  };

  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === target.id ? nextTarget : character
      )),
    },
    resolved: true,
    damageApplied,
  };
}

// ============================================================================
// Infiltrator — Lightning Launcher
// ============================================================================

export type LightningLauncherFailure = 'armorer_missing' | 'wrong_model' | 'target_missing';

export interface LightningLauncherResult {
  state: CombatState;
  resolved: boolean;
  failure?: LightningLauncherFailure;
  damageApplied?: number;
}

export function resolveLightningLauncher(
  state: CombatState,
  request: { armorerId: string; targetId: string; rng?: () => number },
): LightningLauncherResult {
  const armorer = state.characters.find(character => character.id === request.armorerId);
  if (!armorer) return { state, resolved: false, failure: 'armorer_missing' };
  if (!hasArcaneArmor(armorer) || getArmorerModel(armorer) !== 'infiltrator') {
    return { state, resolved: false, failure: 'wrong_model' };
  }

  const target = state.characters.find(character => character.id === request.targetId);
  if (!target) return { state, resolved: false, failure: 'target_missing' };

  const damageApplied = Math.max(0, Math.min(target.currentHP, rollDice(LIGHTNING_LAUNCHER_DICE, { rng: request.rng })));
  const nextTarget: CombatCharacter = { ...target, currentHP: target.currentHP - damageApplied };

  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === target.id ? nextTarget : character
      )),
    },
    resolved: true,
    damageApplied,
  };
}
