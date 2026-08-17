// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/08/2026, 12:52:19
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
 * Circle of the Land (Druid) land choice, Land's Aid, and Natural Recovery.
 *
 * Land's Aid expends one Wild Shape use to heal an ally and damage a foe with
 * the same surging nature roll. Natural Recovery restores one spent spell slot.
 * Both are production transactions: they pay the resource and change real HP or
 * spell-slot state instead of describing the outcome in preview text.
 */

import type { CombatCharacter, CombatState } from '../../types/combat';
import type { LimitedUses } from '../../types/character';
import { rollDice } from './combatUtils';

export const WILD_SHAPE_RESOURCE_KEY = 'wild_shape';
export const LANDS_AID_ABILITY_ID = 'lands_aid';
export const DEFAULT_WILD_SHAPE_USES = 2;
export const LANDS_AID_DICE = '1d8';

// ============================================================================
// Land Choice And Prepared Circle Spells
// ============================================================================
// The chosen land adds two prepared circle spells. This mapping is the canonical
// source; `applyLandChoice` merges the chosen land's spells into the list.
// ============================================================================

export const CIRCLE_OF_THE_LAND_SPELLS: Record<string, string[]> = {
  forest: ['barkskin', 'spike_growth'],
  grassland: ['invisibility', 'pass_without_trace'],
  mountain: ['spider_climb', 'spike_growth'],
  swamp: ['acid_arrow', 'darkness'],
  desert: ['blur', 'silence'],
  coast: ['mirror_image', 'misty_step'],
  arctic: ['hold_person', 'spike_growth'],
  underdark: ['spider_climb', 'web'],
};

export function applyLandChoice(
  landId: string,
  preparedSpells: string[],
): { landId: string; preparedSpells: string[]; rejected?: boolean } {
  const circleSpells = CIRCLE_OF_THE_LAND_SPELLS[landId];
  if (!circleSpells) {
    return { landId, preparedSpells, rejected: true };
  }
  const merged = new Set(preparedSpells);
  for (const id of circleSpells) merged.add(id);
  return { landId, preparedSpells: Array.from(merged) };
}

// ============================================================================
// Wild Shape Resource
// ============================================================================

export function getWildShapeUses(character: CombatCharacter): number {
  const pool = character.limitedUses?.[WILD_SHAPE_RESOURCE_KEY];
  if (typeof pool?.current === 'number') return pool.current;
  return DEFAULT_WILD_SHAPE_USES;
}

function spendWildShapeUse(character: CombatCharacter): CombatCharacter {
  const uses = getWildShapeUses(character);
  if (uses <= 0) return character;
  const pool = character.limitedUses?.[WILD_SHAPE_RESOURCE_KEY];
  const max = typeof pool?.max === 'number' ? pool.max : DEFAULT_WILD_SHAPE_USES;
  const nextUses: LimitedUses = {
    ...(character.limitedUses ?? {}),
    [WILD_SHAPE_RESOURCE_KEY]: {
      name: 'Wild Shape',
      current: uses - 1,
      max,
      resetOn: 'short_rest',
    },
  };
  return { ...character, limitedUses: nextUses };
}

// ============================================================================
// Land's Aid Transaction
// ============================================================================
// One Wild Shape use produces one nature surge: the ally regains the rolled HP
// and the foe takes the same rolled total. Both HP transitions are real (capped
// at max, floored at 0) and only occur after the resource payment succeeds.
// ============================================================================

export type LandsAidFailure =
  | 'caster_missing'
  | 'not_circle_of_the_land'
  | 'no_wild_shape_uses'
  | 'ally_missing'
  | 'foe_missing';

export interface LandsAidResult {
  state: CombatState;
  resolved: boolean;
  failure?: LandsAidFailure;
  healingApplied?: number;
  damageApplied?: number;
  remainingWildShapeUses?: number;
}

export function resolveLandsAid(
  state: CombatState,
  request: {
    casterId: string;
    allyId: string;
    foeId: string;
    wisdomMod: number;
    rng?: () => number;
  },
): LandsAidResult {
  const caster = state.characters.find(character => character.id === request.casterId);
  if (!caster) return { state, resolved: false, failure: 'caster_missing' };

  if (!caster.abilities.some(ability => ability.id === LANDS_AID_ABILITY_ID)) {
    return { state, resolved: false, failure: 'not_circle_of_the_land' };
  }

  if (getWildShapeUses(caster) <= 0) {
    return { state, resolved: false, failure: 'no_wild_shape_uses' };
  }

  const ally = state.characters.find(character => character.id === request.allyId);
  if (!ally) return { state, resolved: false, failure: 'ally_missing' };

  const foe = state.characters.find(character => character.id === request.foeId);
  if (!foe) return { state, resolved: false, failure: 'foe_missing' };

  const spentCaster = spendWildShapeUse(caster);
  const surge = rollDice(LANDS_AID_DICE, { rng: request.rng }) + request.wisdomMod;

  const healingApplied = Math.max(0, Math.min(ally.maxHP - ally.currentHP, surge));
  const damageApplied = Math.max(0, Math.min(foe.currentHP, surge));

  const nextAlly: CombatCharacter = { ...ally, currentHP: ally.currentHP + healingApplied };
  const nextFoe: CombatCharacter = { ...foe, currentHP: foe.currentHP - damageApplied };

  return {
    state: {
      ...state,
      characters: state.characters.map(character => {
        if (character.id === caster.id) return spentCaster;
        if (character.id === ally.id) return nextAlly;
        if (character.id === foe.id) return nextFoe;
        return character;
      }),
    },
    resolved: true,
    healingApplied,
    damageApplied,
    remainingWildShapeUses: getWildShapeUses(spentCaster),
  };
}

// ============================================================================
// Natural Recovery
// ============================================================================
// Once per Long Rest the druid recovers one spent spell slot. This helper
// increments the named slot's current count up to its maximum without changing
// an already-full slot.
// ============================================================================

type SpellSlotLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export function recoverSpellSlot(
  character: CombatCharacter,
  slotLevel: SpellSlotLevel,
): CombatCharacter {
  const key = `level_${slotLevel}` as keyof NonNullable<CombatCharacter['spellSlots']>;
  const slots = character.spellSlots;
  if (!slots || !slots[key]) return character;

  const slot = slots[key];
  if (slot.current >= slot.max) return character;

  return {
    ...character,
    spellSlots: {
      ...slots,
      [key]: { ...slot, current: slot.current + 1 },
    },
  };
}
