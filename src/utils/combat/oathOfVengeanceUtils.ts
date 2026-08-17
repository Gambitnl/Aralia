// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 14:10:51
 * Dependents: utils/combat/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Oath of Vengeance (Paladin) Vow of Enmity — a target-bound Channel Divinity.
 *
 * The existing `vow_of_enmity` self-buff grants blanket attack advantage because
 * it is modeled as a per-attack modifier. The canonical rule is target-bound:
 * the paladin swears against ONE foe and gains advantage only against that foe.
 * This file owns that restriction: it spends one `channel_divinity` use, records
 * the sworn target id on the paladin, and exposes `hasVowAdvantageAgainst` so an
 * attack resolver can grant advantage against the sworn foe and nobody else.
 */

import type { CombatCharacter, CombatState } from '../../types/combat';
import type { LimitedUses } from '../../types/character';
import {
  CHANNEL_DIVINITY_DEFAULT_USES,
  CHANNEL_DIVINITY_RESOURCE_KEY,
  getChannelDivinityUses,
} from './oathOfDevotionUtils';

export const VOW_OF_ENMITY_FEATURE_ID = 'vow_of_enmity';
export const VOW_OF_ENMITY_DURATION_ROUNDS = 10;
export const VOW_OF_ENMITY_STATUS_ID = 'vow_of_enmity';

export function hasVowOfEnmity(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === VOW_OF_ENMITY_FEATURE_ID);
}

function spendChannelDivinityUse(character: CombatCharacter): CombatCharacter {
  const uses = getChannelDivinityUses(character);
  if (uses <= 0) return character;
  const pool = character.limitedUses?.[CHANNEL_DIVINITY_RESOURCE_KEY];
  const max = typeof pool?.max === 'number' ? pool.max : CHANNEL_DIVINITY_DEFAULT_USES;
  const nextUses: LimitedUses = {
    ...(character.limitedUses ?? {}),
    [CHANNEL_DIVINITY_RESOURCE_KEY]: {
      name: 'Channel Divinity',
      current: uses - 1,
      max,
      resetOn: 'short_rest',
    },
  };
  return { ...character, limitedUses: nextUses };
}

export function hasVowAdvantageAgainst(paladin: CombatCharacter, targetId: string): boolean {
  return paladin.vowOfEnmityTargetId === targetId;
}

export type VowOfEnmityFailure =
  | 'paladin_missing'
  | 'missing_vow_of_enmity'
  | 'no_channel_divinity'
  | 'target_missing';

export interface VowOfEnmityResult {
  state: CombatState;
  resolved: boolean;
  failure?: VowOfEnmityFailure;
  swornTargetId?: string;
  remainingChannelDivinityUses?: number;
}

export function resolveVowOfEnmity(
  state: CombatState,
  request: { paladinId: string; targetId: string },
): VowOfEnmityResult {
  const paladin = state.characters.find(character => character.id === request.paladinId);
  if (!paladin) return { state, resolved: false, failure: 'paladin_missing' };
  if (!hasVowOfEnmity(paladin)) return { state, resolved: false, failure: 'missing_vow_of_enmity' };
  if (getChannelDivinityUses(paladin) <= 0) {
    return { state, resolved: false, failure: 'no_channel_divinity' };
  }

  const target = state.characters.find(character => character.id === request.targetId);
  if (!target) return { state, resolved: false, failure: 'target_missing' };

  const spent = spendChannelDivinityUse(paladin);
  const nextPaladin: CombatCharacter = {
    ...spent,
    vowOfEnmityTargetId: target.id,
    statusEffects: [
      ...spent.statusEffects,
      {
        id: VOW_OF_ENMITY_STATUS_ID,
        name: 'Vow of Enmity',
        type: 'buff',
        duration: VOW_OF_ENMITY_DURATION_ROUNDS,
        source: 'Vow of Enmity',
        icon: '👁️',
      },
    ],
  };

  return {
    state: {
      ...state,
      characters: state.characters.map(character => (
        character.id === paladin.id ? nextPaladin : character
      )),
    },
    resolved: true,
    swornTargetId: target.id,
    remainingChannelDivinityUses: getChannelDivinityUses(spent),
  };
}
