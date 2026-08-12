// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 01:08:51
 * Dependents: components/DesignPreview/steps/scenarioControls/sustainActionsOngoingControlScenarioControls.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns Witch Bolt's structured ongoing rules into live combat state.
 *
 * The spell data already says that the first cast uses an Action and slot, a
 * later turn may use a Bonus Action for automatic damage, and range, Total
 * Cover, concentration, or duration can end the arc. This resolver connects
 * those facts to the shared action ledger, attack/damage helpers, HP state,
 * line-of-sight map, concentration pointer, and owner-linked effect records.
 *
 * Called by: the Tactical Sandbox Sustain Actions & Ongoing Control adapter.
 * Depends on: canonical Witch Bolt JSON and shared combat-rule utilities.
 */

import witchBoltData from '@/data/spells/level-1/witch-bolt.json';
import type { PlayerCharacter } from '../../../types';
import type {
  BattleMapData,
  CombatCharacter,
  Position,
} from '../../../types/combat';
import type { DamageEffect, Spell } from '../../../types/spells';
import { isDamageEffect } from '../../../types/spells';
import { createAbilityFromSpell } from '../../../utils/character/spellAbilityFactory';
import { calculateProficiencyBonus } from '../../../utils/character/savingThrowUtils';
import { getAbilityModifierValue } from '../../../utils/character/statUtils';
import {
  canAffordActionCost,
  consumeActionCost,
} from '../../../utils/combat/actionEconomyUtils';
import {
  getCharacterDistance,
  resolveAttack,
  rollDamage,
  type AttackResult,
} from '../../../utils/combat/combatUtils';
import { applyDamageAndCheckDowned } from '../../../utils/combat/deathSaveUtils';
import { hasLineOfSight } from '../../../utils/spatial/lineOfSight';

// ============================================================================
// Canonical Spell Facts
// ============================================================================
// The resolver reads the live spell record rather than restating action costs,
// dice, range, or duration in scenario code. Missing facts reject visibly.
// ============================================================================

const WITCH_BOLT = witchBoltData as unknown as Spell;
const INITIAL_DAMAGE_EFFECT = WITCH_BOLT.effects.find((effect): effect is DamageEffect => (
  isDamageEffect(effect) && effect.trigger?.type === 'immediate'
));
const REPEAT_DAMAGE_EFFECT = WITCH_BOLT.effects.find((effect): effect is DamageEffect => (
  isDamageEffect(effect) && effect.trigger?.type === 'on_caster_action'
));

export const WITCH_BOLT_RANGE_FEET = WITCH_BOLT.targeting.range
  ?? WITCH_BOLT.range.distance
  ?? 0;
export const WITCH_BOLT_DURATION_ROUNDS = WITCH_BOLT.duration.unit === 'minute'
  ? (WITCH_BOLT.duration.value ?? 0) * 10
  : WITCH_BOLT.duration.unit === 'round'
    ? WITCH_BOLT.duration.value ?? 0
    : 0;

// ============================================================================
// Public Resolution Receipt
// ============================================================================
// UI and tests receive the changed combatants plus the exact reason, resource,
// range, damage, and cleanup facts used to describe the outcome.
// ============================================================================

export type WitchBoltOutcome = 'established' | 'activated' | 'skipped' | 'ended' | 'rejected';
export type WitchBoltReason =
  | 'initial_hit'
  | 'initial_miss'
  | 'repeat_damage'
  | 'skipped_optional_action'
  | 'action_unavailable'
  | 'target_out_of_range'
  | 'target_has_total_cover'
  | 'concentration_lost'
  | 'duration_expired'
  | 'missing_actor'
  | 'missing_canonical_effect'
  | 'invalid_spellcasting_ability'
  | 'unaffordable_initial_cost'
  | 'missing_link';

export interface WitchBoltCleanupCounts {
  statusEffects: number;
  conditions: number;
  activeEffects: number;
  concentrationLinks: number;
}

export interface WitchBoltResolution {
  outcome: WitchBoltOutcome;
  reason: WitchBoltReason;
  characters: CombatCharacter[];
  damage: number;
  distanceFeet?: number;
  remainingRounds?: number;
  attack?: AttackResult;
  cleanup: WitchBoltCleanupCounts;
}

export interface EstablishWitchBoltLinkInput {
  characters: CombatCharacter[];
  casterId: string;
  targetId: string;
  startedTurn: number;
}

export interface ResolveWitchBoltInitialCastInput extends EstablishWitchBoltLinkInput {
  mapData: BattleMapData;
  d20Roll: number;
  /** Deterministic tests and previews can inject dice; normal play can omit it. */
  damageRng?: () => number;
}

export interface ResolveWitchBoltLaterTurnInput {
  characters: CombatCharacter[];
  mapData: BattleMapData;
  casterId: string;
  targetId: string;
  currentTurn: number;
  choice: 'activate' | 'skip';
  /** Deterministic tests and previews can inject dice; normal play can omit it. */
  damageRng?: () => number;
}

const EMPTY_CLEANUP: WitchBoltCleanupCounts = {
  statusEffects: 0,
  conditions: 0,
  activeEffects: 0,
  concentrationLinks: 0,
};

// ============================================================================
// Stable Link Identity And Character Replacement
// ============================================================================
// Status, active-effect, and concentration records use stable owner-aware ids.
// Re-establishing the same arc therefore replaces it instead of duplicating it.
// ============================================================================

function statusId(casterId: string, targetId: string): string {
  return `${WITCH_BOLT.id}-${casterId}-${targetId}-status`;
}

function activeEffectId(casterId: string, targetId: string): string {
  return `${WITCH_BOLT.id}-${casterId}-${targetId}-active-effect`;
}

function replaceCharacters(
  characters: CombatCharacter[],
  replacements: CombatCharacter[],
): CombatCharacter[] {
  const replacementById = new Map(replacements.map(character => [character.id, character]));
  return characters.map(character => replacementById.get(character.id) ?? character);
}

function findActors(
  characters: CombatCharacter[],
  casterId: string,
  targetId: string,
): { caster: CombatCharacter; target: CombatCharacter } | null {
  const caster = characters.find(character => character.id === casterId);
  const target = characters.find(character => character.id === targetId);
  return caster && target ? { caster, target } : null;
}

// ============================================================================
// Owner-Linked Cleanup
// ============================================================================
// Only records naming both Witch Bolt and this caster are removed. Another
// spell on either actor remains even if it is also a buff or debuff.
// ============================================================================

function cleanWitchBoltLink(
  characters: CombatCharacter[],
  casterId: string,
): { characters: CombatCharacter[]; cleanup: WitchBoltCleanupCounts } {
  const caster = characters.find(character => character.id === casterId);
  const trackedIds = new Set(
    caster?.concentratingOn?.spellId === WITCH_BOLT.id
      ? caster.concentratingOn.effectIds
      : [],
  );
  const cleanup = { ...EMPTY_CLEANUP };

  const cleanedCharacters = characters.map(character => {
    const nextStatusEffects = character.statusEffects.filter(effect => {
      const belongsToArc = trackedIds.has(effect.id) || (
        effect.sourceSpellId === WITCH_BOLT.id
        && effect.sourceCasterId === casterId
      );
      return !belongsToArc;
    });
    const nextConditions = (character.conditions ?? []).filter(condition => {
      const sourceMatches = condition.source === WITCH_BOLT.id
        || condition.source === WITCH_BOLT.name;
      return !(sourceMatches && condition.sourceCasterId === casterId);
    });
    const nextActiveEffects = (character.activeEffects ?? []).filter(effect => {
      const belongsToArc = trackedIds.has(effect.id) || (
        effect.spellId === WITCH_BOLT.id
        && effect.casterId === casterId
      );
      return !belongsToArc;
    });
    const clearsConcentration = character.id === casterId
      && character.concentratingOn?.spellId === WITCH_BOLT.id;

    cleanup.statusEffects += character.statusEffects.length - nextStatusEffects.length;
    cleanup.conditions += (character.conditions ?? []).length - nextConditions.length;
    cleanup.activeEffects += (character.activeEffects ?? []).length - nextActiveEffects.length;
    cleanup.concentrationLinks += clearsConcentration ? 1 : 0;

    if (
      nextStatusEffects.length === character.statusEffects.length
      && nextConditions.length === (character.conditions ?? []).length
      && nextActiveEffects.length === (character.activeEffects ?? []).length
      && !clearsConcentration
    ) {
      return character;
    }

    return {
      ...character,
      statusEffects: nextStatusEffects,
      conditions: nextConditions,
      activeEffects: nextActiveEffects,
      concentratingOn: clearsConcentration ? undefined : character.concentratingOn,
    };
  });

  return { characters: cleanedCharacters, cleanup };
}

function targetHasLinkedArc(
  target: CombatCharacter,
  casterId: string,
): boolean {
  return target.statusEffects.some(effect => (
    effect.sourceSpellId === WITCH_BOLT.id && effect.sourceCasterId === casterId
  )) || (target.activeEffects ?? []).some(effect => (
    effect.spellId === WITCH_BOLT.id && effect.casterId === casterId
  ));
}

// ============================================================================
// Link Establishment
// ============================================================================
// This is the production bridge from a successful cast to inspectable state:
// concentration owns the arc, the target carries a mechanical active effect,
// and both map renderers receive a visible status cue from the same link.
// ============================================================================

export function establishWitchBoltLink(
  input: EstablishWitchBoltLinkInput,
): CombatCharacter[] {
  const cleaned = cleanWitchBoltLink(input.characters, input.casterId).characters;
  const actors = findActors(cleaned, input.casterId, input.targetId);
  const sustainCost = REPEAT_DAMAGE_EFFECT?.trigger?.sustainCost;
  if (!actors || !sustainCost || typeof sustainCost === 'number') {
    return input.characters;
  }

  const arcStatusId = statusId(input.casterId, input.targetId);
  const arcActiveEffectId = activeEffectId(input.casterId, input.targetId);
  const caster: CombatCharacter = {
    ...actors.caster,
    concentratingOn: {
      spellId: WITCH_BOLT.id,
      spellName: WITCH_BOLT.name,
      spellLevel: WITCH_BOLT.level,
      startedTurn: input.startedTurn,
      effectIds: [arcStatusId, arcActiveEffectId],
      canDropAsFreeAction: true,
      sustainCost: { ...sustainCost },
      sustainedThisTurn: true,
    },
  };
  const target: CombatCharacter = {
    ...actors.target,
    statusEffects: [
      ...actors.target.statusEffects.filter(effect => effect.id !== arcStatusId),
      {
        id: arcStatusId,
        name: 'Witch Bolt Arc',
        type: 'debuff',
        description: WITCH_BOLT.description,
        duration: WITCH_BOLT_DURATION_ROUNDS,
        source: WITCH_BOLT.name,
        sourceSpellId: WITCH_BOLT.id,
        sourceCasterId: input.casterId,
        visualEffect: 'lightning-arc',
      },
    ],
    activeEffects: [
      ...(actors.target.activeEffects ?? []).filter(effect => effect.id !== arcActiveEffectId),
      {
        id: arcActiveEffectId,
        spellId: WITCH_BOLT.id,
        casterId: input.casterId,
        sourceName: WITCH_BOLT.name,
        type: 'debuff',
        duration: WITCH_BOLT.duration,
        startTime: input.startedTurn,
      },
    ],
  };

  return replaceCharacters(cleaned, [caster, target]);
}

// ============================================================================
// Range, Total Cover, Concentration, And Duration Checks
// ============================================================================
// Every later-turn choice crosses this boundary before spending a resource or
// dealing damage. Arc-ending checks clean the owner-linked records immediately.
// ============================================================================

function tileAt(mapData: BattleMapData, position: Position) {
  return mapData.tiles.get(`${position.x}-${position.y}`);
}

function remainingDurationRounds(caster: CombatCharacter, currentTurn: number): number {
  const elapsed = Math.max(0, currentTurn - (caster.concentratingOn?.startedTurn ?? currentTurn));
  return Math.max(0, WITCH_BOLT_DURATION_ROUNDS - elapsed);
}

function endResolution(
  characters: CombatCharacter[],
  casterId: string,
  reason: Extract<WitchBoltReason,
    'target_out_of_range' | 'target_has_total_cover' | 'concentration_lost' | 'duration_expired'>,
  distanceFeet?: number,
): WitchBoltResolution {
  const cleaned = cleanWitchBoltLink(characters, casterId);
  return {
    outcome: 'ended',
    reason,
    characters: cleaned.characters,
    damage: 0,
    distanceFeet,
    remainingRounds: 0,
    cleanup: cleaned.cleanup,
  };
}

function evaluateOngoingArc(
  input: ResolveWitchBoltLaterTurnInput,
  caster: CombatCharacter,
  target: CombatCharacter,
): WitchBoltResolution | null {
  const hasArc = targetHasLinkedArc(target, caster.id);
  if (caster.concentratingOn?.spellId !== WITCH_BOLT.id) {
    return hasArc
      ? endResolution(input.characters, caster.id, 'concentration_lost')
      : {
          outcome: 'rejected',
          reason: 'missing_link',
          characters: input.characters,
          damage: 0,
          cleanup: { ...EMPTY_CLEANUP },
        };
  }

  if (!hasArc) {
    return {
      outcome: 'rejected',
      reason: 'missing_link',
      characters: input.characters,
      damage: 0,
      cleanup: { ...EMPTY_CLEANUP },
    };
  }

  const remainingRounds = remainingDurationRounds(caster, input.currentTurn);
  if (remainingRounds <= 0) {
    return endResolution(input.characters, caster.id, 'duration_expired');
  }

  const distanceFeet = getCharacterDistance(caster, target) * 5;
  if (distanceFeet > WITCH_BOLT_RANGE_FEET) {
    return endResolution(input.characters, caster.id, 'target_out_of_range', distanceFeet);
  }

  const casterTile = tileAt(input.mapData, caster.position);
  const targetTile = tileAt(input.mapData, target.position);
  if (!casterTile || !targetTile || !hasLineOfSight(casterTile, targetTile, input.mapData)) {
    return endResolution(input.characters, caster.id, 'target_has_total_cover', distanceFeet);
  }

  return null;
}

// ============================================================================
// Spellcasting Ability And Sustain Cost
// ============================================================================
// Initial attack math uses the caster's live spellcasting score and proficiency.
// Later-turn cost maps the spell's structured action name onto the shared ledger.
// ============================================================================

function spellcastingScore(caster: CombatCharacter): number | null {
  switch (caster.spellcastingAbility?.toLowerCase()) {
    case 'strength': return caster.stats.strength;
    case 'dexterity': return caster.stats.dexterity;
    case 'constitution': return caster.stats.constitution;
    case 'intelligence': return caster.stats.intelligence;
    case 'wisdom': return caster.stats.wisdom;
    case 'charisma': return caster.stats.charisma;
    default: return null;
  }
}

function sustainAbilityCost(): { type: 'action' | 'bonus' | 'reaction' } | null {
  const actionType = REPEAT_DAMAGE_EFFECT?.trigger?.sustainCost;
  if (!actionType || typeof actionType === 'number') {
    return null;
  }

  if (actionType.actionType === 'bonus_action') return { type: 'bonus' };
  if (actionType.actionType === 'reaction') return { type: 'reaction' };
  return { type: 'action' };
}

// ============================================================================
// Initial Cast
// ============================================================================
// Target legality and affordability are checked before payment. The shared
// attack resolver decides hit/miss; 2024 Witch Bolt establishes its arc either
// way, while only a hit applies the canonical initial damage.
// ============================================================================

export function resolveWitchBoltInitialCast(
  input: ResolveWitchBoltInitialCastInput,
): WitchBoltResolution {
  const actors = findActors(input.characters, input.casterId, input.targetId);
  if (!actors) {
    return {
      outcome: 'rejected',
      reason: 'missing_actor',
      characters: input.characters,
      damage: 0,
      cleanup: { ...EMPTY_CLEANUP },
    };
  }

  if (!INITIAL_DAMAGE_EFFECT?.damage.dice || !REPEAT_DAMAGE_EFFECT?.damage.dice) {
    return {
      outcome: 'rejected',
      reason: 'missing_canonical_effect',
      characters: input.characters,
      damage: 0,
      cleanup: { ...EMPTY_CLEANUP },
    };
  }

  const distanceFeet = getCharacterDistance(actors.caster, actors.target) * 5;
  if (distanceFeet > WITCH_BOLT_RANGE_FEET) {
    return {
      outcome: 'rejected',
      reason: 'target_out_of_range',
      characters: input.characters,
      damage: 0,
      distanceFeet,
      cleanup: { ...EMPTY_CLEANUP },
    };
  }

  const casterTile = tileAt(input.mapData, actors.caster.position);
  const targetTile = tileAt(input.mapData, actors.target.position);
  if (!casterTile || !targetTile || !hasLineOfSight(casterTile, targetTile, input.mapData)) {
    return {
      outcome: 'rejected',
      reason: 'target_has_total_cover',
      characters: input.characters,
      damage: 0,
      distanceFeet,
      cleanup: { ...EMPTY_CLEANUP },
    };
  }

  const score = spellcastingScore(actors.caster);
  if (score === null) {
    return {
      outcome: 'rejected',
      reason: 'invalid_spellcasting_ability',
      characters: input.characters,
      damage: 0,
      distanceFeet,
      cleanup: { ...EMPTY_CLEANUP },
    };
  }

  const ability = createAbilityFromSpell(
    WITCH_BOLT,
    actors.caster as unknown as PlayerCharacter,
  );
  const cost = { ...ability.cost, spellSlotLevel: WITCH_BOLT.level };
  if (!canAffordActionCost(actors.caster, cost)) {
    return {
      outcome: 'rejected',
      reason: 'unaffordable_initial_cost',
      characters: input.characters,
      damage: 0,
      distanceFeet,
      cleanup: { ...EMPTY_CLEANUP },
    };
  }

  const attackBonus = getAbilityModifierValue(score)
    + calculateProficiencyBonus(actors.caster.level || 1);
  const targetAc = actors.target.armorClass ?? actors.target.baseAC ?? 10;
  const attack = resolveAttack(input.d20Roll, attackBonus, targetAc);
  const paidCaster = consumeActionCost(actors.caster, cost);
  const damage = attack.isHit
    ? rollDamage(INITIAL_DAMAGE_EFFECT.damage.dice, attack.isCritical, 1, input.damageRng)
    : 0;
  const damagedTarget = damage > 0
    ? applyDamageAndCheckDowned(actors.target, damage, attack.isCritical)
    : actors.target;
  const paidAndDamaged = replaceCharacters(input.characters, [paidCaster, damagedTarget]);
  const linkedCharacters = establishWitchBoltLink({
    characters: paidAndDamaged,
    casterId: input.casterId,
    targetId: input.targetId,
    startedTurn: input.startedTurn,
  });

  return {
    outcome: 'established',
    reason: attack.isHit ? 'initial_hit' : 'initial_miss',
    characters: linkedCharacters,
    damage,
    distanceFeet,
    remainingRounds: WITCH_BOLT_DURATION_ROUNDS,
    attack,
    cleanup: { ...EMPTY_CLEANUP },
  };
}

// ============================================================================
// Later-Turn Choice
// ============================================================================
// Skipping Witch Bolt's optional Bonus Action leaves the arc intact. Choosing
// it requires a ready Bonus Action and applies the automatic repeat damage with
// no attack roll. Maintenance failures end and clean the arc before payment.
// ============================================================================

export function resolveWitchBoltLaterTurn(
  input: ResolveWitchBoltLaterTurnInput,
): WitchBoltResolution {
  const actors = findActors(input.characters, input.casterId, input.targetId);
  if (!actors) {
    return {
      outcome: 'rejected',
      reason: 'missing_actor',
      characters: input.characters,
      damage: 0,
      cleanup: { ...EMPTY_CLEANUP },
    };
  }

  if (!REPEAT_DAMAGE_EFFECT?.damage.dice) {
    return {
      outcome: 'rejected',
      reason: 'missing_canonical_effect',
      characters: input.characters,
      damage: 0,
      cleanup: { ...EMPTY_CLEANUP },
    };
  }

  const ended = evaluateOngoingArc(input, actors.caster, actors.target);
  if (ended) {
    return ended;
  }

  const distanceFeet = getCharacterDistance(actors.caster, actors.target) * 5;
  const remainingRounds = remainingDurationRounds(actors.caster, input.currentTurn);
  if (input.choice === 'skip') {
    return {
      outcome: 'skipped',
      reason: 'skipped_optional_action',
      characters: input.characters,
      damage: 0,
      distanceFeet,
      remainingRounds,
      cleanup: { ...EMPTY_CLEANUP },
    };
  }

  const cost = sustainAbilityCost();
  if (!cost) {
    return {
      outcome: 'rejected',
      reason: 'missing_canonical_effect',
      characters: input.characters,
      damage: 0,
      distanceFeet,
      remainingRounds,
      cleanup: { ...EMPTY_CLEANUP },
    };
  }

  if (!canAffordActionCost(actors.caster, cost)) {
    return {
      outcome: 'rejected',
      reason: 'action_unavailable',
      characters: input.characters,
      damage: 0,
      distanceFeet,
      remainingRounds,
      cleanup: { ...EMPTY_CLEANUP },
    };
  }

  const paidCaster = consumeActionCost(actors.caster, cost);
  const casterWithSustainReceipt: CombatCharacter = {
    ...paidCaster,
    concentratingOn: paidCaster.concentratingOn
      ? { ...paidCaster.concentratingOn, sustainedThisTurn: true }
      : undefined,
  };
  const damage = rollDamage(
    REPEAT_DAMAGE_EFFECT.damage.dice,
    false,
    1,
    input.damageRng,
  );
  const damagedTarget = applyDamageAndCheckDowned(actors.target, damage);

  return {
    outcome: 'activated',
    reason: 'repeat_damage',
    characters: replaceCharacters(input.characters, [casterWithSustainReceipt, damagedTarget]),
    damage,
    distanceFeet,
    remainingRounds,
    cleanup: { ...EMPTY_CLEANUP },
  };
}

