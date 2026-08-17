// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 14:10:29
 * Dependents: utils/combat/index.ts, utils/combat/oathOfVengeanceUtils.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Oath of Devotion (Paladin) Sacred Weapon — a Channel Divinity transaction.
 *
 * For one minute the paladin's weapon sheds light and gains a bonus to attack
 * rolls equal to their Charisma modifier. This file owns the resource spend
 * (one `channel_divinity` use) and the authored attack bonus, so a caller does
 * not hand-roll the Charisma math in preview text. It is gated on the
 * `sacred_weapon` ability, so a non-Devotion paladin can never activate it.
 */

import type { CombatCharacter, CombatState } from '../../types/combat';
import type { LimitedUses } from '../../types/character';
import { getAbilityModifierValue } from '../character/statUtils';

export const SACRED_WEAPON_FEATURE_ID = 'sacred_weapon';
export const CHANNEL_DIVINITY_RESOURCE_KEY = 'channel_divinity';
export const CHANNEL_DIVINITY_DEFAULT_USES = 1;
export const SACRED_WEAPON_DURATION_ROUNDS = 10;
export const SACRED_WEAPON_STATUS_ID = 'sacred_weapon';

export function hasSacredWeapon(character: CombatCharacter): boolean {
  return character.abilities.some(ability => ability.id === SACRED_WEAPON_FEATURE_ID);
}

export function getChannelDivinityUses(character: CombatCharacter): number {
  const pool = character.limitedUses?.[CHANNEL_DIVINITY_RESOURCE_KEY];
  if (typeof pool?.current === 'number') return pool.current;
  return CHANNEL_DIVINITY_DEFAULT_USES;
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

/**
 * The canonical Sacred Weapon attack bonus: the paladin's Charisma modifier.
 */
export function calculateSacredWeaponAttackBonus(charismaScore: number): number {
  return getAbilityModifierValue(charismaScore);
}

export type SacredWeaponFailure =
  | 'paladin_missing'
  | 'missing_sacred_weapon'
  | 'no_channel_divinity';

export interface SacredWeaponResult {
  state: CombatState;
  resolved: boolean;
  failure?: SacredWeaponFailure;
  attackBonus?: number;
  remainingChannelDivinityUses?: number;
}

export function resolveSacredWeapon(
  state: CombatState,
  request: { paladinId: string },
): SacredWeaponResult {
  const paladin = state.characters.find(character => character.id === request.paladinId);
  if (!paladin) return { state, resolved: false, failure: 'paladin_missing' };
  if (!hasSacredWeapon(paladin)) return { state, resolved: false, failure: 'missing_sacred_weapon' };
  if (getChannelDivinityUses(paladin) <= 0) {
    return { state, resolved: false, failure: 'no_channel_divinity' };
  }

  const spent = spendChannelDivinityUse(paladin);
  const attackBonus = calculateSacredWeaponAttackBonus(paladin.stats.charisma);

  const nextPaladin: CombatCharacter = {
    ...spent,
    statusEffects: [
      ...spent.statusEffects,
      {
        id: SACRED_WEAPON_STATUS_ID,
        name: 'Sacred Weapon',
        type: 'buff',
        duration: SACRED_WEAPON_DURATION_ROUNDS,
        source: 'Sacred Weapon',
        icon: '✨',
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
    attackBonus,
    remainingChannelDivinityUses: getChannelDivinityUses(spent),
  };
}
