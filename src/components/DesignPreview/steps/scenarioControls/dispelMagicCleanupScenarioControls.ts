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
 * This file owns the deterministic controls for Dispel Magic & Effect Cleanup.
 *
 * The board carries live Bless, Greater Invisibility, and Mage Armor records.
 * Every action rebuilds that authored baseline, then asks the production Dispel
 * Magic mechanic to validate the target, pay the canonical Action and slot,
 * perform any required spellcasting-ability check, and remove owner-linked
 * status and condition cues. Mage Armor is deliberately unrelated and must
 * survive every successful cleanup.
 *
 * Called by: the Tactical Sandbox scenario-control registry and scenario host.
 * Depends on: canonical spell JSON and dispelMagicResolution.ts.
 */

import blessData from '@/data/spells/level-1/bless.json';
import mageArmorData from '@/data/spells/level-1/mage-armor.json';
import dispelMagicData from '@/data/spells/level-3/dispel-magic.json';
import fireballData from '@/data/spells/level-3/fireball.json';
import greaterInvisibilityData from '@/data/spells/level-4/greater-invisibility.json';
import type { SpellSlots } from '../../../../types';
import type { CombatCharacter } from '../../../../types/combat';
import type { Spell, SpellEffect } from '../../../../types/spells';
import {
  resolveDispelMagic,
  type DispelMagicResolution,
} from '../../../../systems/spells/mechanics/dispelMagicResolution';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Canonical Spell Records And Board Identity
// ============================================================================
// These imports are the live corpus entries. The fixture reads condition names
// and spell levels from them rather than maintaining a second spell rule table.
// ============================================================================

const BLESS = blessData as unknown as Spell;
const MAGE_ARMOR = mageArmorData as unknown as Spell;
const DISPEL_MAGIC = dispelMagicData as unknown as Spell;
const FIREBALL = fireballData as unknown as Spell;
const GREATER_INVISIBILITY = greaterInvisibilityData as unknown as Spell;

export const DISPEL_MAGIC_CLEANUP_DISPELLER_ID = 'dispel_magic_cleanup-dispeller';
export const DISPEL_MAGIC_CLEANUP_BLESSED_TARGET_ID = 'dispel_magic_cleanup-blessed-target';
export const DISPEL_MAGIC_CLEANUP_VEILED_TARGET_ID = 'dispel_magic_cleanup-veiled-target';

export const DISPEL_MAGIC_CLEANUP_DISPELLER_START = { x: 4, y: 5 } as const;
export const DISPEL_MAGIC_CLEANUP_BLESSED_START = { x: 9, y: 3 } as const;
export const DISPEL_MAGIC_CLEANUP_VEILED_START = { x: 9, y: 7 } as const;

export const DISPEL_MAGIC_CLEANUP_CAST_LEVEL = DISPEL_MAGIC.level;
export const DISPEL_MAGIC_CLEANUP_HIGHER_DC = 10 + GREATER_INVISIBILITY.level;
export const DISPEL_MAGIC_CLEANUP_SUCCESS_D20 = 16;
export const DISPEL_MAGIC_CLEANUP_FAILURE_D20 = 5;

const BLESS_STATUS_ID = 'dispel_magic_cleanup-bless-status';
const GREATER_INVISIBILITY_STATUS_ID = 'dispel_magic_cleanup-greater-invisibility-status';

interface DispelMagicCleanupActors {
  dispeller: CombatCharacter;
  blessedTarget: CombatCharacter;
  veiledTarget: CombatCharacter;
}

// ============================================================================
// Canonical Condition And Effect Fixtures
// ============================================================================
// Tactical Sandbox fixtures seed the same CombatCharacter records that spell
// commands produce. Missing canonical status metadata stops preparation rather
// than silently inventing a replacement condition.
// ============================================================================

type EffectWithStatusCondition = SpellEffect & {
  statusCondition?: { name?: string };
};

function findStatusConditionName(spell: Spell): string | null {
  // Bless keeps its status payload on an ATTACK_ROLL_MODIFIER row, while
  // Greater Invisibility uses STATUS_CONDITION. The property, not the outer
  // effect family, is therefore the stable canonical seam.
  const statusEffect = spell.effects.find(
    effect => 'statusCondition' in effect,
  ) as EffectWithStatusCondition | undefined;
  return statusEffect?.statusCondition?.name ?? null;
}

function createSpellSlots(): SpellSlots {
  return createMockSpellSlots({
    level_3: { current: 1, max: 1 },
  });
}

function readSlot(character: CombatCharacter, level: number): string {
  const slotKey = `level_${level}` as keyof SpellSlots;
  const slot = character.spellSlots?.[slotKey];
  return slot ? `${slot.current}/${slot.max}` : 'unavailable';
}

function withSafeModifierLists(character: CombatCharacter): CombatCharacter {
  return {
    ...character,
    modifiers: {
      ...character.modifiers,
      advantage: character.modifiers?.advantage ?? [],
      disadvantage: character.modifiers?.disadvantage ?? [],
      bonuses: character.modifiers?.bonuses ?? [],
    },
  };
}

function createMageArmorEffect(characterId: string) {
  return {
    id: `${characterId}-mage-armor`,
    spellId: MAGE_ARMOR.id,
    casterId: characterId,
    sourceName: MAGE_ARMOR.name,
    type: 'buff' as const,
    duration: { type: 'hours' as const, value: MAGE_ARMOR.duration.value ?? 8 },
    startTime: 0,
    mechanics: {
      baseAC: 13,
      baseACFormula: '13 + dex_mod',
    },
  };
}

function prepareActors(actors: DispelMagicCleanupActors): DispelMagicCleanupActors | null {
  const blessConditionName = findStatusConditionName(BLESS);
  const invisibleConditionName = findStatusConditionName(GREATER_INVISIBILITY);
  if (!blessConditionName || !invisibleConditionName) {
    return null;
  }

  const dispeller = resetEconomy(withSafeModifierLists({
    ...actors.dispeller,
    name: 'Abjurer · INT +4 · L3 1/1 · Action ready',
    position: { ...DISPEL_MAGIC_CLEANUP_DISPELLER_START },
    team: 'player',
    level: 7,
    spellcastingAbility: 'intelligence',
    spellSlots: createSpellSlots(),
    stats: {
      ...actors.dispeller.stats,
      intelligence: 18,
    },
    abilities: [],
    concentratingOn: undefined,
    statusEffects: [],
    conditions: [],
    activeEffects: [],
  }));

  const blessedTarget = resetEconomy(withSafeModifierLists({
    ...actors.blessedTarget,
    name: 'Blessed Guardian · Blessed + Mage Armor',
    position: { ...DISPEL_MAGIC_CLEANUP_BLESSED_START },
    team: 'enemy',
    spellcastingAbility: 'wisdom',
    baseAC: 15,
    armorClass: 15,
    abilities: [],
    activeEffects: [createMageArmorEffect(actors.blessedTarget.id)],
    statusEffects: [{
      id: BLESS_STATUS_ID,
      name: blessConditionName,
      type: 'buff',
      description: BLESS.effects[0]?.description,
      duration: 10,
      source: BLESS.name,
      sourceSpellId: BLESS.id,
      sourceCasterId: actors.blessedTarget.id,
      modifiers: {
        attackRollBonusDice: '1d4',
        savingThrowBonusDice: '1d4',
      },
      visualEffect: 'blessed',
    }],
    conditions: [{
      name: blessConditionName,
      duration: { type: 'minutes', value: BLESS.duration.value ?? 1 },
      appliedTurn: 0,
      source: BLESS.id,
      sourceCasterId: actors.blessedTarget.id,
    }],
    concentratingOn: {
      spellId: BLESS.id,
      spellName: BLESS.name,
      spellLevel: BLESS.level,
      startedTurn: 0,
      effectIds: [BLESS_STATUS_ID],
      canDropAsFreeAction: true,
    },
  }));

  const veiledTarget = resetEconomy(withSafeModifierLists({
    ...actors.veiledTarget,
    name: 'Veiled Scout · Invisible + Mage Armor',
    position: { ...DISPEL_MAGIC_CLEANUP_VEILED_START },
    team: 'enemy',
    spellcastingAbility: 'intelligence',
    baseAC: 15,
    armorClass: 15,
    abilities: [],
    activeEffects: [createMageArmorEffect(actors.veiledTarget.id)],
    statusEffects: [{
      id: GREATER_INVISIBILITY_STATUS_ID,
      name: invisibleConditionName,
      type: 'buff',
      description: GREATER_INVISIBILITY.effects[0]?.description,
      duration: 10,
      source: GREATER_INVISIBILITY.name,
      sourceSpellId: GREATER_INVISIBILITY.id,
      sourceCasterId: actors.veiledTarget.id,
      visualEffect: 'invisible',
    }],
    conditions: [{
      name: invisibleConditionName,
      duration: {
        type: 'minutes',
        value: GREATER_INVISIBILITY.duration.value ?? 1,
      },
      appliedTurn: 0,
      source: GREATER_INVISIBILITY.id,
      sourceCasterId: actors.veiledTarget.id,
    }],
    concentratingOn: {
      spellId: GREATER_INVISIBILITY.id,
      spellName: GREATER_INVISIBILITY.name,
      spellLevel: GREATER_INVISIBILITY.level,
      startedTurn: 0,
      effectIds: [GREATER_INVISIBILITY_STATUS_ID],
      canDropAsFreeAction: true,
    },
  }));

  return { dispeller, blessedTarget, veiledTarget };
}

function requireActors(
  characters: CombatCharacter[],
): DispelMagicCleanupActors | null {
  const dispeller = characters.find(character => (
    character.id === DISPEL_MAGIC_CLEANUP_DISPELLER_ID
  ));
  const blessedTarget = characters.find(character => (
    character.id === DISPEL_MAGIC_CLEANUP_BLESSED_TARGET_ID
  ));
  const veiledTarget = characters.find(character => (
    character.id === DISPEL_MAGIC_CLEANUP_VEILED_TARGET_ID
  ));

  return dispeller && blessedTarget && veiledTarget
    ? { dispeller, blessedTarget, veiledTarget }
    : null;
}

function replaceActors(
  characters: CombatCharacter[],
  actors: DispelMagicCleanupActors,
): CombatCharacter[] {
  const replacements = new Map<string, CombatCharacter>([
    [actors.dispeller.id, actors.dispeller],
    [actors.blessedTarget.id, actors.blessedTarget],
    [actors.veiledTarget.id, actors.veiledTarget],
  ]);
  return characters.map(character => replacements.get(character.id) ?? character);
}

/**
 * Seeds the rendered board with the canonical ongoing spell records.
 * The host owns only actor construction and calls this exported initializer;
 * all spell-specific fixture knowledge remains beside the controls and tests.
 */
export function prepareDispelMagicCleanupCharacters(
  characters: CombatCharacter[],
): CombatCharacter[] {
  const found = requireActors(characters);
  const prepared = found ? prepareActors(found) : null;
  return prepared ? replaceActors(characters, prepared) : characters;
}

// ============================================================================
// Result Presentation
// ============================================================================
// Token names expose resources and surviving effects in both renderers. They
// are derived after resolution and never decide whether cleanup succeeded.
// ============================================================================

function hasSpellStatus(character: CombatCharacter, spellId: string): boolean {
  return character.statusEffects.some(status => status.sourceSpellId === spellId)
    || (character.conditions ?? []).some(condition => condition.source === spellId);
}

function hasActiveSpell(character: CombatCharacter, spellId: string): boolean {
  return (character.activeEffects ?? []).some(effect => effect.spellId === spellId);
}

function decorateResolvedCharacters(characters: CombatCharacter[]): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === DISPEL_MAGIC_CLEANUP_DISPELLER_ID) {
      const actionState = character.actionEconomy.action.used ? 'Action spent' : 'Action ready';
      return {
        ...character,
        name: `Abjurer · INT +4 · L3 ${readSlot(character, 3)} · ${actionState}`,
      };
    }

    if (character.id === DISPEL_MAGIC_CLEANUP_BLESSED_TARGET_ID) {
      const blessState = hasSpellStatus(character, BLESS.id) ? 'Blessed' : 'Bless removed';
      const armorState = hasActiveSpell(character, MAGE_ARMOR.id) ? 'Mage Armor kept' : 'Mage Armor missing';
      return { ...character, name: `Guardian · ${blessState} · ${armorState}` };
    }

    if (character.id === DISPEL_MAGIC_CLEANUP_VEILED_TARGET_ID) {
      const veilState = hasSpellStatus(character, GREATER_INVISIBILITY.id)
        ? 'Invisible'
        : 'Visible';
      const armorState = hasActiveSpell(character, MAGE_ARMOR.id) ? 'Mage Armor kept' : 'Mage Armor missing';
      return { ...character, name: `Veiled Scout · ${veilState} · ${armorState}` };
    }

    return character;
  });
}

function d20RandomSource(face: number): () => number {
  return () => (face - 0.5) / 20;
}

function cleanupSummary(result: DispelMagicResolution): string {
  return `${result.cleanup.statusEffects} mechanical status, ${result.cleanup.conditions} visible condition cue, ${result.cleanup.activeEffects} active effect, ${result.cleanup.lightSources} light cue, and ${result.cleanup.concentrationLinks} concentration link removed`;
}

// ============================================================================
// Four Deterministic Cast Attempts
// ============================================================================
// Each button starts from the same board so the existing Reset Board gesture and
// repeated comparisons never inherit a spent slot or a prior cleanup result.
// ============================================================================

function resolveScenarioCast(
  application: PreviewCombatScenarioControlApplication,
  targetCharacterId: string,
  sourceCasterId: string,
  targetSpell: Spell,
  rng?: () => number,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application.snapshot.characters);
  const prepared = found ? prepareActors(found) : null;
  if (!prepared) {
    return {
      logMessage: 'Dispel Magic proof skipped because its actors or canonical condition metadata are unavailable.',
    };
  }

  const baselineCharacters = replaceActors(application.snapshot.characters, prepared);
  const result = resolveDispelMagic({
    characters: baselineCharacters,
    activeLightSources: application.snapshot.activeLightSources,
    dispellerId: prepared.dispeller.id,
    targetCharacterId,
    sourceCasterId,
    dispelMagicSpell: DISPEL_MAGIC,
    targetSpell,
    castAtLevel: DISPEL_MAGIC_CLEANUP_CAST_LEVEL,
    rng,
  });
  const characters = decorateResolvedCharacters(result.characters);
  const dispeller = characters.find(character => character.id === prepared.dispeller.id);
  const resourceSummary = dispeller
    ? `L3 ${readSlot(dispeller, 3)}; ${dispeller.actionEconomy.action.used ? 'Action spent' : 'Action ready'}`
    : 'dispeller unavailable';

  if (result.reason === 'automatic_end') {
    return {
      characters,
      activeLightSources: result.activeLightSources,
      logMessage: `${DISPEL_MAGIC.name} level ${result.castAtLevel}: ${targetSpell.name} level ${targetSpell.level} is no higher than the slot, so it ends automatically after payment. ${cleanupSummary(result)}; unrelated ${MAGE_ARMOR.name} remains. ${resourceSummary}.`,
    };
  }

  if (result.reason === 'ability_check_succeeded') {
    return {
      characters,
      activeLightSources: result.activeLightSources,
      logMessage: `${DISPEL_MAGIC.name} pays first, then INT check d20 ${result.check?.roll} + 4 = ${result.check?.total} vs DC ${result.checkDc} succeeds against level-${targetSpell.level} ${targetSpell.name}. ${cleanupSummary(result)}; unrelated ${MAGE_ARMOR.name} remains. ${resourceSummary}.`,
    };
  }

  if (result.reason === 'ability_check_failed') {
    return {
      characters,
      activeLightSources: result.activeLightSources,
      logMessage: `${DISPEL_MAGIC.name} pays first, then INT check d20 ${result.check?.roll} + 4 = ${result.check?.total} vs DC ${result.checkDc} fails. ${targetSpell.name}, its mechanical ${findStatusConditionName(targetSpell)} status, visible badge, and concentration remain. ${resourceSummary}.`,
    };
  }

  if (result.reason === 'instantaneous_spell') {
    return {
      characters,
      activeLightSources: result.activeLightSources,
      logMessage: `${targetSpell.name} is instantaneous, so aftermath is not an ongoing spell Dispel Magic can end. Rejected before payment: ${resourceSummary}; no effect changed.`,
    };
  }

  return {
    characters,
    activeLightSources: result.activeLightSources,
    logMessage: `${DISPEL_MAGIC.name} rejected (${result.reason.replace(/_/g, ' ')}). ${resourceSummary}; no effect changed.`,
  };
}

function applyDispelMagicCleanupControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.value === false) {
    return { logMessage: '' };
  }
  if (application.value !== true) {
    return { logMessage: `Dispel Magic control ${application.controlId} requires an action trigger.` };
  }

  if (application.controlId === 'dispel-lower-level') {
    return resolveScenarioCast(
      application,
      DISPEL_MAGIC_CLEANUP_BLESSED_TARGET_ID,
      DISPEL_MAGIC_CLEANUP_BLESSED_TARGET_ID,
      BLESS,
    );
  }
  if (application.controlId === 'dispel-higher-success') {
    return resolveScenarioCast(
      application,
      DISPEL_MAGIC_CLEANUP_VEILED_TARGET_ID,
      DISPEL_MAGIC_CLEANUP_VEILED_TARGET_ID,
      GREATER_INVISIBILITY,
      d20RandomSource(DISPEL_MAGIC_CLEANUP_SUCCESS_D20),
    );
  }
  if (application.controlId === 'dispel-higher-failure') {
    return resolveScenarioCast(
      application,
      DISPEL_MAGIC_CLEANUP_VEILED_TARGET_ID,
      DISPEL_MAGIC_CLEANUP_VEILED_TARGET_ID,
      GREATER_INVISIBILITY,
      d20RandomSource(DISPEL_MAGIC_CLEANUP_FAILURE_D20),
    );
  }
  if (application.controlId === 'reject-instantaneous') {
    return resolveScenarioCast(
      application,
      DISPEL_MAGIC_CLEANUP_DISPELLER_ID,
      DISPEL_MAGIC_CLEANUP_DISPELLER_ID,
      FIREBALL,
    );
  }

  return { logMessage: `Unknown Dispel Magic cleanup control: ${application.controlId}.` };
}

// ============================================================================
// Scenario Registration
// ============================================================================
// Four action buttons cover automatic cleanup, both higher-level check outcomes,
// and the invalid instantaneous boundary without introducing hidden toggles.
// ============================================================================

const dispelMagicCleanupScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'dispel_magic_cleanup',
  controls: [
    {
      id: 'dispel-lower-level',
      label: 'Dispel Bless · automatic',
      description: 'Pay a level-3 Dispel Magic to end level-1 Bless and keep unrelated Mage Armor.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'dispel-higher-success',
      label: 'Dispel level 4 · success',
      description: 'Roll a fixed successful spellcasting-ability check against Greater Invisibility.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'dispel-higher-failure',
      label: 'Dispel level 4 · failure',
      description: 'Pay the same costs, fail the fixed check, and leave the spell and cues intact.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'reject-instantaneous',
      label: 'Try Fireball aftermath',
      description: 'Reject an instantaneous spell with no ongoing dispellable effect before payment.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyDispelMagicCleanupControl,
};

export default dispelMagicCleanupScenarioControls;
