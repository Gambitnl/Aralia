// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/10/2026, 00:42:28
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { createMockSpellSlots } from '@/utils/core/factories';
/**
 * This file owns the live controls for Spell Slots & Upcasting.
 *
 * Cast buttons submit the mounted caster, target, turn, positions, effects,
 * Action, and slots to the shared atomic damage-spell transaction. They never
 * rebuild the fixture. Only Reset restores the two authored CS26 actors, so a
 * repeated, off-turn, exhausted, empty-slot, or invalid request encounters the
 * state produced by earlier play and rejects before a roll, payment, or effect.
 *
 * Called by: the Tactical Sandbox scenario-control registry and mounted host.
 * Depends on: canonical Fireball and Fire Bolt data, the shared damage-spell
 * transaction, and action-economy reset for explicit fixture restoration.
 */

import fireBoltData from '@/data/spells/level-0/fire-bolt.json';
import fireballData from '@/data/spells/level-3/fireball.json';
import type { SpellSlots } from '../../../../types';
import type { CombatCharacter } from '../../../../types/combat';
import type { Spell } from '../../../../types/spells';
import {
  createDamageSpellCastAction,
  resolveDamageSpellCast,
  type DamageSpellCastRejectionReason,
} from '../../../../systems/spells/mechanics/directDamageSpellCastResolution';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Canonical Spell And Auditable Board Facts
// ============================================================================
// Both spells come from the same validated data used by the spell loader.
// Fireball proves legal slot scaling. Fire Bolt proves that character-level
// cantrip scaling cannot be turned into slot-based upcasting.
// ============================================================================

const FIREBALL = fireballData as Spell;
const FIRE_BOLT = fireBoltData as Spell;

export const SPELL_SLOTS_UPCASTING_CASTER_ID = 'spell_slots_upcasting-caster';
export const SPELL_SLOTS_UPCASTING_TARGET_ID = 'spell_slots_upcasting-target';
export const SPELL_SLOTS_UPCASTING_CASTER_START = { x: 4, y: 5 } as const;
export const SPELL_SLOTS_UPCASTING_TARGET_START = { x: 9, y: 5 } as const;
export const SPELL_SLOTS_UPCASTING_BASE_LEVEL = FIREBALL.level;
export const SPELL_SLOTS_UPCASTING_UPCAST_LEVEL = FIREBALL.level + 1;
export const SPELL_SLOTS_UPCASTING_UNAVAILABLE_LEVEL = FIREBALL.level + 2;
export const SPELL_SLOTS_UPCASTING_BELOW_BASE_LEVEL = FIREBALL.level - 1;
export const SPELL_SLOTS_UPCASTING_TARGET_HP = 60;
export const SPELL_SLOTS_UPCASTING_BASE_FORMULA = '8d6';
export const SPELL_SLOTS_UPCASTING_UPCAST_FORMULA = '9d6';
export const SPELL_SLOTS_UPCASTING_BASE_DAMAGE = 32;
export const SPELL_SLOTS_UPCASTING_UPCAST_DAMAGE = 36;

const FIXED_DAMAGE_FACE = 4;
const FIXED_SAVE_D20 = 5;

// ============================================================================
// Authored Fixture And Explicit Reset
// ============================================================================
// The host calls this once when CS26 loads, and Reset calls it deliberately.
// No cast control calls it. Only the two CS26 actor ids are changed; every
// unrelated campaign actor remains byte-for-byte in the roster.
// ============================================================================

function createAuthoredSlots(): SpellSlots {
  return createMockSpellSlots({
    level_3: { current: 1, max: 1 },
    level_4: { current: 1, max: 1 },
  });
}

function readSlot(caster: CombatCharacter, level: number): string {
  const key = `level_${level}` as keyof SpellSlots;
  const slot = caster.spellSlots?.[key];
  return slot ? `${slot.current}/${slot.max}` : 'unavailable';
}

function withAuditableCasterName(caster: CombatCharacter): CombatCharacter {
  const actionState = caster.actionEconomy.action.used ? 'Action spent' : 'Action ready';
  return {
    ...caster,
    name: `Evoker · L3 ${readSlot(caster, 3)} · L4 ${readSlot(caster, 4)} · ${actionState}`,
  };
}

export function prepareSpellSlotsUpcastingCharacters(
  characters: CombatCharacter[],
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === SPELL_SLOTS_UPCASTING_CASTER_ID) {
      const freshCaster = resetEconomy({
        ...character,
        level: 7,
        position: { ...SPELL_SLOTS_UPCASTING_CASTER_START },
        team: 'player',
        spellcastingAbility: 'intelligence',
        stats: { ...character.stats, intelligence: 18 },
        spellSlots: createAuthoredSlots(),
        activeEffects: [],
        statusEffects: [],
        conditions: [],
        riders: [],
      });
      const fireball = createDamageSpellCastAction(FIREBALL, freshCaster, FIREBALL.level);
      const fireBolt = createDamageSpellCastAction(FIRE_BOLT, freshCaster, 0);
      return withAuditableCasterName({
        ...freshCaster,
        abilities: [fireball.ability, fireBolt.ability],
      });
    }

    if (character.id === SPELL_SLOTS_UPCASTING_TARGET_ID) {
      return {
        ...character,
        name: 'Fireball Target · DEX -1',
        position: { ...SPELL_SLOTS_UPCASTING_TARGET_START },
        team: 'enemy',
        currentHP: SPELL_SLOTS_UPCASTING_TARGET_HP,
        maxHP: SPELL_SLOTS_UPCASTING_TARGET_HP,
        tempHP: 0,
        damagedThisTurn: false,
        deathSaves: undefined,
        stats: { ...character.stats, dexterity: 8, saveBonuses: undefined },
        savingThrowProficiencies: [],
        resistances: [],
        immunities: [],
        vulnerabilities: [],
        abilities: [],
        activeEffects: [],
        statusEffects: [],
        conditions: [],
        riders: [],
      };
    }

    return character;
  });
}

export function getSpellSlotsUpcastingInitiativeTotal(character: CombatCharacter): number {
  if (character.id === SPELL_SLOTS_UPCASTING_CASTER_ID) return 18;
  if (character.id === SPELL_SLOTS_UPCASTING_TARGET_ID) return 12;
  return 0;
}

// ============================================================================
// Live Atomic Cast Resolution
// ============================================================================
// Deterministic sources choose known faces, while the shared transaction owns
// validation, scaling, saves, defenses, payment, HP, and downing. Rejections
// return no character patch, preserving the exact mounted state identity.
// ============================================================================

function createD20RandomSource(face: number): () => number {
  return () => (face - 0.5) / 20;
}

function createD6RandomSource(face: number): () => number {
  return () => (face - 0.5) / 6;
}

function rejectionExplanation(reason: DamageSpellCastRejectionReason): string {
  if (reason.startsWith('invalid_target:')) {
    return `targeting failed (${reason.slice('invalid_target:'.length)})`;
  }

  const explanations: Record<Exclude<DamageSpellCastRejectionReason, `invalid_target:${string}`>, string> = {
    missing_actor: 'the authored caster or target is unavailable',
    invalid_slot_level: 'the requested slot level is not an integer from 0 to 9',
    below_base_slot: `Fireball requires level ${FIREBALL.level} or higher`,
    cantrip_slot_forbidden: 'cantrips use character-level scaling and cannot consume spell slots',
    spell_not_eligible: 'the live caster does not have that spell ability',
    off_turn: 'the live turn belongs to another actor',
    unsupported_damage_spell: 'the spell is outside the save-based direct-damage contract',
    action_unavailable: 'the live Action is already spent',
    slot_unavailable: 'the exact requested slot is empty or absent',
  };
  return explanations[reason as keyof typeof explanations];
}

function resolveSpellCast(
  application: PreviewCombatScenarioControlApplication,
  spell: Spell,
  castAtLevel: number,
): PreviewCombatScenarioControlPatch {
  const caster = application.snapshot.characters.find(
    character => character.id === SPELL_SLOTS_UPCASTING_CASTER_ID,
  );
  const target = application.snapshot.characters.find(
    character => character.id === SPELL_SLOTS_UPCASTING_TARGET_ID,
  );
  if (!caster || !target || !application.snapshot.turnState) {
    return { logMessage: 'REJECTED (missing_actor): live caster, target, or turn state is unavailable.' };
  }

  const result = resolveDamageSpellCast({
    characters: application.snapshot.characters,
    mapData: application.snapshot.mapData,
    turnState: application.snapshot.turnState,
    casterId: caster.id,
    targetId: target.id,
    action: createDamageSpellCastAction(spell, caster, castAtLevel),
    spellZones: application.snapshot.spellZones,
    damageRng: createD6RandomSource(FIXED_DAMAGE_FACE),
    saveRng: createD20RandomSource(FIXED_SAVE_D20),
  });

  if (result.status === 'rejected') {
    const targetDetail = result.targetRejectionMessage ? ` ${result.targetRejectionMessage}` : '';
    return {
      logMessage: `REJECTED (${result.reason}): ${rejectionExplanation(result.reason)}.${targetDetail} No roll, effect, Action, or slot was spent. L3 ${readSlot(caster, 3)}; L4 ${readSlot(caster, 4)}; target ${target.currentHP}/${target.maxHP} HP.`,
    };
  }

  const paidCaster = result.casterAfter!;
  const resolvedCharacters = result.characters.map(character => (
    character.id === paidCaster.id ? withAuditableCasterName(character) : character
  ));

  return {
    characters: resolvedCharacters,
    logMessage: `${spell.name} level-${castAtLevel} RESOLVED: ${result.baseFormula} scales to ${result.scaledFormula}; fixed d6 ${FIXED_DAMAGE_FACE} rolls ${result.rolledDamage} Fire. Target save d20 ${FIXED_SAVE_D20} - 1 = ${result.saveTotal} vs DC ${result.saveDC} fails; defenses settle ${result.damageAfterSave} to ${result.finalDamage}; HP ${result.targetBefore!.currentHP} → ${result.targetAfter!.currentHP}. L3 ${readSlot(paidCaster, 3)}; L4 ${readSlot(paidCaster, 4)}; Action spent.`,
  };
}

function resetSpellSlotsBoard(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const hasCaster = application.snapshot.characters.some(
    character => character.id === SPELL_SLOTS_UPCASTING_CASTER_ID,
  );
  const hasTarget = application.snapshot.characters.some(
    character => character.id === SPELL_SLOTS_UPCASTING_TARGET_ID,
  );
  if (!hasCaster || !hasTarget) {
    return { logMessage: 'Spell Slots reset skipped because its authored caster or target is unavailable.' };
  }

  const characters = prepareSpellSlotsUpcastingCharacters(application.snapshot.characters);
  const caster = characters.find(character => character.id === SPELL_SLOTS_UPCASTING_CASTER_ID)!;
  const target = characters.find(character => character.id === SPELL_SLOTS_UPCASTING_TARGET_ID)!;
  return {
    characters,
    reinitializeCombat: true,
    logMessage: `Reset complete: ${FIREBALL.name} caster has L3 ${readSlot(caster, 3)}, L4 ${readSlot(caster, 4)}, Action ready; target restored to ${target.currentHP}/${target.maxHP} HP.`,
  };
}

// ============================================================================
// Control Routing And Registration
// ============================================================================
// Legal and invalid attempts all use the live transaction. Reset is the only
// control permitted to author the baseline again.
// ============================================================================

function applySpellSlotsUpcastingControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.value === false) return { logMessage: '' };
  if (application.value !== true) {
    return { logMessage: `Spell Slots control ${application.controlId} requires an action trigger.` };
  }

  if (application.controlId === 'cast-level-3') {
    return resolveSpellCast(application, FIREBALL, SPELL_SLOTS_UPCASTING_BASE_LEVEL);
  }
  if (application.controlId === 'cast-level-4') {
    return resolveSpellCast(application, FIREBALL, SPELL_SLOTS_UPCASTING_UPCAST_LEVEL);
  }
  if (application.controlId === 'cast-unavailable-level-5') {
    return resolveSpellCast(application, FIREBALL, SPELL_SLOTS_UPCASTING_UNAVAILABLE_LEVEL);
  }
  if (application.controlId === 'cast-below-base-level-2') {
    return resolveSpellCast(application, FIREBALL, SPELL_SLOTS_UPCASTING_BELOW_BASE_LEVEL);
  }
  if (application.controlId === 'cast-cantrip-with-slot') {
    return resolveSpellCast(application, FIRE_BOLT, 1);
  }
  if (application.controlId === 'reset-slots-board') {
    return resetSpellSlotsBoard(application);
  }

  return { logMessage: `Unknown Spell Slots & Upcasting control: ${application.controlId}.` };
}

const spellSlotsUpcastingScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'spell_slots_upcasting',
  controls: [
    {
      id: 'cast-level-3',
      label: 'Cast Fireball · level 3',
      description: 'Spend the live Action and level-3 slot, then resolve canonical 8d6 save damage.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'cast-level-4',
      label: 'Upcast Fireball · level 4',
      description: 'Spend the live level-4 slot and apply Fireball\'s canonical +1d6 scaling.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'cast-unavailable-level-5',
      label: 'Try unavailable level 5',
      description: 'Reject an absent slot before spending the Action, another slot, or target HP.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'cast-below-base-level-2',
      label: 'Try Fireball · level 2',
      description: 'Reject a below-base slot before a roll, payment, or target effect.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'cast-cantrip-with-slot',
      label: 'Try upcasting Fire Bolt',
      description: 'Reject slot-based upcasting for a cantrip, which scales only by character level.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'reset-slots-board',
      label: 'Reset slots and HP',
      description: 'Restore only the CS26 caster, target, turn order, slots, Action, positions, and HP.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applySpellSlotsUpcastingControl,
};

export default spellSlotsUpcastingScenarioControls;
