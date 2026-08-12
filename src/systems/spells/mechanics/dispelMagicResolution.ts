// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/08/2026, 23:59:13
 * Dependents: components/DesignPreview/steps/scenarioControls/dispelMagicCleanupScenarioControls.ts, systems/spells/mechanics/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves the 2024 Dispel Magic rule against live combat state.
 *
 * A caller supplies the canonical Dispel Magic record, the canonical ongoing
 * spell record, and the characters that own the effect. This mechanic verifies
 * that the target actually carries that spell, pays the normal Action and slot,
 * rolls the shared spellcasting-ability check when needed, and removes only
 * records linked to the ending spell and caster. Scenario controls call this
 * file today; a future command bridge can reuse the same result without
 * rebuilding the rule from UI state or combat-log prose.
 *
 * Called by: dispelMagicCleanupScenarioControls.ts.
 * Depends on: spellAbilityFactory, checkUtils, and actionEconomyUtils.
 */

import type { AbilityScoreName, PlayerCharacter, Spell } from '../../../types';
import type { CombatCharacter, LightSource } from '../../../types/combat';
import { createAbilityFromSpell } from '../../../utils/character/spellAbilityFactory';
import { rollAbilityCheck, type CheckResult } from '../../../utils/character/checkUtils';
import {
  canAffordActionCost,
  consumeActionCost,
} from '../../../utils/combat/actionEconomyUtils';

// ============================================================================
// Public Resolution Contract
// ============================================================================
// Callers receive both the updated canonical state and auditable evidence about
// cost, check, and cleanup. This keeps UI narration derived from state changes.
// ============================================================================

export type DispelMagicResolutionStatus = 'rejected' | 'failed' | 'dispelled';

export interface DispelMagicCleanupCounts {
  statusEffects: number;
  conditions: number;
  activeEffects: number;
  lightSources: number;
  concentrationLinks: number;
}

export interface ResolveDispelMagicInput {
  characters: CombatCharacter[];
  activeLightSources: LightSource[];
  dispellerId: string;
  targetCharacterId: string;
  sourceCasterId: string;
  dispelMagicSpell: Spell;
  targetSpell: Spell;
  castAtLevel: number;
  /** Deterministic scenario/tests can inject a stream; ordinary play omits it. */
  rng?: () => number;
}

export interface DispelMagicResolution {
  status: DispelMagicResolutionStatus;
  reason:
    | 'automatic_end'
    | 'ability_check_succeeded'
    | 'ability_check_failed'
    | 'instantaneous_spell'
    | 'no_ongoing_spell'
    | 'invalid_spellcasting_ability'
    | 'invalid_slot_level'
    | 'unaffordable_cost'
    | 'missing_actor';
  characters: CombatCharacter[];
  activeLightSources: LightSource[];
  targetSpellLevel: number;
  castAtLevel: number;
  checkDc?: number;
  check?: CheckResult;
  cleanup: DispelMagicCleanupCounts;
}

const EMPTY_CLEANUP: DispelMagicCleanupCounts = {
  statusEffects: 0,
  conditions: 0,
  activeEffects: 0,
  lightSources: 0,
  concentrationLinks: 0,
};

// ============================================================================
// Canonical Ownership Matching
// ============================================================================
// Spell id plus source caster id is the deletion boundary. A readable spell
// name is accepted only for a structured condition that also names its caster.
// ============================================================================

function statusBelongsToSpell(
  status: CombatCharacter['statusEffects'][number],
  spell: Spell,
  sourceCasterId: string,
  trackedEffectIds: ReadonlySet<string>,
): boolean {
  if (trackedEffectIds.has(status.id)) {
    return true;
  }

  return status.sourceSpellId === spell.id
    && status.sourceCasterId === sourceCasterId;
}

function conditionBelongsToSpell(
  condition: NonNullable<CombatCharacter['conditions']>[number],
  spell: Spell,
  sourceCasterId: string,
): boolean {
  const sourceMatches = condition.source === spell.id || condition.source === spell.name;
  return sourceMatches && condition.sourceCasterId === sourceCasterId;
}

function activeEffectBelongsToSpell(
  effect: NonNullable<CombatCharacter['activeEffects']>[number],
  spell: Spell,
  sourceCasterId: string,
  trackedEffectIds: ReadonlySet<string>,
): boolean {
  return trackedEffectIds.has(effect.id)
    || (effect.spellId === spell.id && effect.casterId === sourceCasterId);
}

function targetCarriesOngoingSpell(
  target: CombatCharacter,
  sourceCaster: CombatCharacter,
  spell: Spell,
): boolean {
  const trackedEffectIds = new Set(
    sourceCaster.concentratingOn?.spellId === spell.id
      ? sourceCaster.concentratingOn.effectIds
      : [],
  );

  return (
    (target.id === sourceCaster.id && sourceCaster.concentratingOn?.spellId === spell.id)
    || target.statusEffects.some(status => (
      statusBelongsToSpell(status, spell, sourceCaster.id, trackedEffectIds)
    ))
    || (target.conditions ?? []).some(condition => (
      conditionBelongsToSpell(condition, spell, sourceCaster.id)
    ))
    || (target.activeEffects ?? []).some(effect => (
      activeEffectBelongsToSpell(effect, spell, sourceCaster.id, trackedEffectIds)
    ))
  );
}

// ============================================================================
// Spellcasting Ability And Cost
// ============================================================================
// Dispel Magic uses the caster's spellcasting ability without proficiency. The
// shared check helper supplies the d20 and modifier; the shared cost helper owns
// Action and spell-slot payment.
// ============================================================================

const ABILITY_NAME_BY_KEY: Record<string, AbilityScoreName> = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
};

function resolveSpellcastingAbility(character: CombatCharacter): AbilityScoreName | null {
  const key = character.spellcastingAbility?.toLowerCase();
  return key ? ABILITY_NAME_BY_KEY[key] ?? null : null;
}

function replaceCharacter(
  characters: CombatCharacter[],
  replacement: CombatCharacter,
): CombatCharacter[] {
  return characters.map(character => (
    character.id === replacement.id ? replacement : character
  ));
}

// ============================================================================
// Owner-Linked Cleanup
// ============================================================================
// Ending a concentration spell removes every record it owns. Ending a durable
// non-concentration spell removes only its records from the selected target.
// Unrelated spells from the same caster remain because every filter checks id.
// ============================================================================

function cleanEndedSpell(
  characters: CombatCharacter[],
  activeLightSources: LightSource[],
  targetCharacterId: string,
  sourceCasterId: string,
  spell: Spell,
): Pick<DispelMagicResolution, 'characters' | 'activeLightSources' | 'cleanup'> {
  const sourceCaster = characters.find(character => character.id === sourceCasterId);
  const breaksConcentration = sourceCaster?.concentratingOn?.spellId === spell.id;
  const trackedEffectIds = new Set(
    breaksConcentration ? sourceCaster.concentratingOn?.effectIds ?? [] : [],
  );
  const cleanup: DispelMagicCleanupCounts = { ...EMPTY_CLEANUP };

  const cleanedCharacters = characters.map(character => {
    // Concentration ending is spell-wide. A non-concentration spell is removed
    // only from the creature that Dispel Magic selected.
    const shouldInspect = breaksConcentration || character.id === targetCharacterId;
    if (!shouldInspect) {
      return character;
    }

    const nextStatusEffects = character.statusEffects.filter(status => (
      !statusBelongsToSpell(status, spell, sourceCasterId, trackedEffectIds)
    ));
    const nextConditions = (character.conditions ?? []).filter(condition => (
      !conditionBelongsToSpell(condition, spell, sourceCasterId)
    ));
    const nextActiveEffects = (character.activeEffects ?? []).filter(effect => (
      !activeEffectBelongsToSpell(effect, spell, sourceCasterId, trackedEffectIds)
    ));

    cleanup.statusEffects += character.statusEffects.length - nextStatusEffects.length;
    cleanup.conditions += (character.conditions ?? []).length - nextConditions.length;
    cleanup.activeEffects += (character.activeEffects ?? []).length - nextActiveEffects.length;

    const shouldClearConcentration = character.id === sourceCasterId
      && character.concentratingOn?.spellId === spell.id;
    if (shouldClearConcentration) {
      cleanup.concentrationLinks += 1;
    }

    if (
      nextStatusEffects.length === character.statusEffects.length
      && nextConditions.length === (character.conditions ?? []).length
      && nextActiveEffects.length === (character.activeEffects ?? []).length
      && !shouldClearConcentration
    ) {
      return character;
    }

    return {
      ...character,
      statusEffects: nextStatusEffects,
      conditions: nextConditions,
      activeEffects: nextActiveEffects,
      concentratingOn: shouldClearConcentration ? undefined : character.concentratingOn,
    };
  });

  const cleanedLightSources = activeLightSources.filter(light => (
    light.sourceSpellId !== spell.id || light.casterId !== sourceCasterId
  ));
  cleanup.lightSources = activeLightSources.length - cleanedLightSources.length;

  return {
    characters: cleanedCharacters,
    activeLightSources: cleanedLightSources,
    cleanup,
  };
}

// ============================================================================
// 2024 Dispel Magic Resolution
// ============================================================================
// A spell at or below the slot used ends automatically. A higher-level spell
// ends only when the spellcasting-ability check meets DC 10 + spell level.
// ============================================================================

export function resolveDispelMagic(input: ResolveDispelMagicInput): DispelMagicResolution {
  const dispeller = input.characters.find(character => character.id === input.dispellerId);
  const target = input.characters.find(character => character.id === input.targetCharacterId);
  const sourceCaster = input.characters.find(character => character.id === input.sourceCasterId);

  const reject = (
    reason: DispelMagicResolution['reason'],
  ): DispelMagicResolution => ({
    status: 'rejected',
    reason,
    characters: input.characters,
    activeLightSources: input.activeLightSources,
    targetSpellLevel: input.targetSpell.level,
    castAtLevel: input.castAtLevel,
    cleanup: { ...EMPTY_CLEANUP },
  });

  if (!dispeller || !target || !sourceCaster) {
    return reject('missing_actor');
  }

  // Instantaneous spells leave no ongoing spell to end. Damage, scorch marks,
  // or other aftermath are separate facts and are not valid Dispel Magic state.
  if (input.targetSpell.duration.type === 'instantaneous') {
    return reject('instantaneous_spell');
  }

  if (!targetCarriesOngoingSpell(target, sourceCaster, input.targetSpell)) {
    return reject('no_ongoing_spell');
  }

  if (input.castAtLevel < input.dispelMagicSpell.level) {
    return reject('invalid_slot_level');
  }

  const spellcastingAbility = resolveSpellcastingAbility(dispeller);
  if (!spellcastingAbility) {
    return reject('invalid_spellcasting_ability');
  }

  // The spell factory reads the live casting-time record. Combat characters
  // are the tactical projection of the same caster; only the returned cost is
  // consumed here, so character-sheet-only fields are not consulted.
  const ability = createAbilityFromSpell(
    input.dispelMagicSpell,
    dispeller as unknown as PlayerCharacter,
  );
  const cost = {
    ...ability.cost,
    spellSlotLevel: input.castAtLevel,
  };

  if (!canAffordActionCost(dispeller, cost)) {
    return reject('unaffordable_cost');
  }

  const paidDispeller = consumeActionCost(dispeller, cost);
  const paidCharacters = replaceCharacter(input.characters, paidDispeller);
  const automaticEnd = input.targetSpell.level <= input.castAtLevel;

  if (automaticEnd) {
    const cleaned = cleanEndedSpell(
      paidCharacters,
      input.activeLightSources,
      input.targetCharacterId,
      input.sourceCasterId,
      input.targetSpell,
    );
    return {
      status: 'dispelled',
      reason: 'automatic_end',
      ...cleaned,
      targetSpellLevel: input.targetSpell.level,
      castAtLevel: input.castAtLevel,
    };
  }

  const checkDc = 10 + input.targetSpell.level;
  const check = rollAbilityCheck(
    paidDispeller,
    spellcastingAbility,
    undefined,
    { rng: input.rng },
  );

  if (check.total < checkDc) {
    return {
      status: 'failed',
      reason: 'ability_check_failed',
      characters: paidCharacters,
      activeLightSources: input.activeLightSources,
      targetSpellLevel: input.targetSpell.level,
      castAtLevel: input.castAtLevel,
      checkDc,
      check,
      cleanup: { ...EMPTY_CLEANUP },
    };
  }

  const cleaned = cleanEndedSpell(
    paidCharacters,
    input.activeLightSources,
    input.targetCharacterId,
    input.sourceCasterId,
    input.targetSpell,
  );
  return {
    status: 'dispelled',
    reason: 'ability_check_succeeded',
    ...cleaned,
    targetSpellLevel: input.targetSpell.level,
    castAtLevel: input.castAtLevel,
    checkDc,
    check,
  };
}

