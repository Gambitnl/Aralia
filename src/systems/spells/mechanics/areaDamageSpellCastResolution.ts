// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 15:35:55
 * Dependents: components/DesignPreview/steps/scenarioControls/areaEffectScenarioControls.ts
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Resolves one immediate save-based area damage spell as an atomic transaction.
 *
 * Canonical spell targeting supplies shape, origin policy, dimensions, range,
 * sight, saves, scaling, and damage type. The resolver expands those facts into
 * map cells, intersects complete creature footprints once, then commits one
 * action/slot payment with every target result. Invalid and replayed event ids
 * return the original roster by identity before dice or resources are touched.
 *
 * Called by: Tactical Sandbox Area of Effect controls and focused spell tests.
 * Depends on: spell data, AoE geometry, sight, saving throws, defenses, action
 * economy, temporary-hit-point/downing helpers, and occupied creature tiles.
 */

import type { PlayerCharacter } from '../../../types';
import type {
  Ability,
  AbilityCost,
  AreaOfEffect as CombatAreaOfEffect,
  BattleMapData,
  CombatCharacter,
  Position,
  TurnState,
} from '../../../types/combat';
import type { DamageEffect, Spell } from '../../../types/spells';
import { isDamageEffect } from '../../../types/spells';
import { createAbilityFromSpell } from '../../../utils/character/spellAbilityFactory';
import {
  calculateSaveDamage,
  calculateSpellDC,
  rollSavingThrow,
} from '../../../utils/character/savingThrowUtils';
import {
  canAffordActionCost,
  consumeActionCost,
} from '../../../utils/combat/actionEconomyUtils';
import { calculateAffectedTiles, type AoEParams } from '../../../utils/combat/aoeCalculations';
import { getDistance, getOccupiedTiles, rollDamage } from '../../../utils/combat/combatUtils';
import { applyDamageAndCheckDowned } from '../../../utils/combat/deathSaveUtils';
import { ResistanceCalculator } from '../../../utils/combat/resistanceUtils';
import { hasLineOfSight } from '../../../utils/spatial/lineOfSight';
import { resolveAoEParams } from '../../../utils/spatial/targetingUtils';
import type { ActiveSpellZone } from '../effects';
import { ScalingEngine } from './ScalingEngine';

// ============================================================================
// Public Transaction Contract
// ============================================================================
// The receipt keeps geometry, membership, per-target saves/damage, payment, and
// replay state together. This makes both runtime callers and visible scenarios
// inspect one production-shaped result instead of reconstructing hidden facts.
// ============================================================================

export interface AreaDamageSpellCastAction {
  spell: Spell;
  ability: Ability;
  cost: AbilityCost;
  requestedSlotLevel: number;
}

export interface ResolveAreaDamageSpellCastInput {
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  turnState: TurnState;
  casterId: string;
  placement: Position;
  action: AreaDamageSpellCastAction;
  executionEventId: string;
  processedEventIds: ReadonlySet<string>;
  spellZones?: ActiveSpellZone[];
  damageRng?: () => number;
  saveRng?: (target: CombatCharacter) => number;
}

export type AreaDamageSpellCastRejectionReason =
  | 'invalid_event_id'
  | 'replayed_event'
  | 'missing_actor'
  | 'invalid_slot_level'
  | 'below_base_slot'
  | 'cantrip_slot_forbidden'
  | 'spell_not_eligible'
  | 'off_turn'
  | 'unsupported_damage_spell'
  | 'unsupported_area_shape'
  | 'action_unavailable'
  | 'slot_unavailable'
  | 'no_eligible_targets'
  | `invalid_placement:${'off_map' | 'out_of_range' | 'line_of_sight_blocked' | 'self_origin_required'}`;

export interface AreaDamageTargetResult {
  targetId: string;
  saveTotal: number;
  saveDC: number;
  saveSucceeded: boolean;
  damageAfterSave: number;
  finalDamage: number;
  hpBefore: number;
  hpAfter: number;
  tempHPBefore: number;
  tempHPAfter: number;
  downed: boolean;
}

export interface AreaDamageSpellCastResolution {
  status: 'resolved' | 'rejected';
  reason: 'resolved' | AreaDamageSpellCastRejectionReason;
  characters: CombatCharacter[];
  casterBefore?: CombatCharacter;
  casterAfter?: CombatCharacter;
  geometry?: AoEParams;
  affectedTiles: Position[];
  includedTargetIds: string[];
  excludedTargetIds: string[];
  targetResults: AreaDamageTargetResult[];
  baseFormula?: string;
  scaledFormula?: string;
  rolledDamage: number;
  processedEventIds: string[];
}

/**
 * Converts one canonical spell and slot choice into the paid cast action.
 * The factory owns UI-facing ability metadata; canonical spell targeting below
 * remains authoritative for area geometry rather than parsed description text.
 */
export function createAreaDamageSpellCastAction(
  spell: Spell,
  caster: CombatCharacter,
  requestedSlotLevel: number,
): AreaDamageSpellCastAction {
  const ability = createAbilityFromSpell(spell, caster as unknown as PlayerCharacter);
  const cost = { ...ability.cost, spellSlotLevel: requestedSlotLevel };
  return { spell, ability: { ...ability, cost }, cost, requestedSlotLevel };
}

// ============================================================================
// Canonical Geometry And Eligibility
// ============================================================================
// Spell JSON measures areas in feet while the combat adapter measures them in
// five-foot cells. Unsupported authored geometry rejects rather than silently
// becoming a sphere. Sight is checked only from caster to placement because no
// current rule propagates cover from the blast origin to individual targets.
// ============================================================================

function toCombatArea(spell: Spell): CombatAreaOfEffect | null {
  if (spell.targeting.type !== 'area') return null;
  const { shape, size } = spell.targeting.areaOfEffect;
  const shapeMap: Partial<Record<typeof shape, CombatAreaOfEffect['shape']>> = {
    Sphere: 'circle',
    Circle: 'circle',
    Cylinder: 'circle',
    Cone: 'cone',
    Cube: 'square',
    Square: 'square',
    Line: 'line',
  };
  const combatShape = shapeMap[shape];
  if (!combatShape || !Number.isFinite(size) || size <= 0) return null;
  return { shape: combatShape, size: size / 5 };
}

function findSaveDamageEffect(spell: Spell): DamageEffect | null {
  const effect = spell.effects.find(isDamageEffect);
  if (
    !effect?.damage.dice
    || effect.condition.type !== 'save'
    || !effect.condition.saveType
  ) return null;
  return effect;
}

function readRequestedSlot(caster: CombatCharacter, level: number): number {
  if (level === 0) return Number.POSITIVE_INFINITY;
  const key = `level_${level}` as keyof NonNullable<CombatCharacter['spellSlots']>;
  return caster.spellSlots?.[key]?.current ?? 0;
}

function hasEligibleSpell(caster: CombatCharacter, spell: Spell): boolean {
  return caster.abilities.some(ability => ability.id === spell.id && ability.spell?.id === spell.id);
}

function placementRejection(
  input: ResolveAreaDamageSpellCastInput,
  caster: CombatCharacter,
): AreaDamageSpellCastRejectionReason | null {
  const placementTile = input.mapData?.tiles.get(`${input.placement.x}-${input.placement.y}`);
  const casterTile = input.mapData?.tiles.get(`${caster.position.x}-${caster.position.y}`);
  if (!placementTile || !casterTile) return 'invalid_placement:off_map';
  if (input.action.spell.targeting.type !== 'area') return 'unsupported_area_shape';

  const rangeFeet = input.action.spell.targeting.range ?? 0;
  if (rangeFeet === 0 && getDistance(caster.position, input.placement) !== 0) {
    return 'invalid_placement:self_origin_required';
  }
  if (getDistance(caster.position, input.placement) * 5 > rangeFeet) {
    return 'invalid_placement:out_of_range';
  }
  if (
    input.action.spell.targeting.lineOfSight === true
    && !hasLineOfSight(casterTile, placementTile, input.mapData)
  ) return 'invalid_placement:line_of_sight_blocked';
  return null;
}

function clippedAffectedTiles(mapData: BattleMapData, geometry: AoEParams): Position[] {
  return calculateAffectedTiles(geometry).filter(position => (
    mapData.tiles.has(`${position.x}-${position.y}`)
  ));
}

function intersectsArea(character: CombatCharacter, affectedKeys: ReadonlySet<string>): boolean {
  return getOccupiedTiles(character).some(position => affectedKeys.has(`${position.x}-${position.y}`));
}

// ============================================================================
// Atomic Area Resolution
// ============================================================================
// All validation and target membership finish before RNG or payment. One shared
// damage roll then feeds one save and one defense/downing transition per unique
// included creature. The successful event id is returned only with that commit.
// ============================================================================

export function resolveAreaDamageSpellCast(
  input: ResolveAreaDamageSpellCastInput,
): AreaDamageSpellCastResolution {
  const caster = input.characters.find(character => character.id === input.casterId);
  const reject = (
    reason: AreaDamageSpellCastRejectionReason,
    geometry?: AoEParams,
    affectedTiles: Position[] = [],
    includedTargetIds: string[] = [],
    excludedTargetIds: string[] = [],
  ): AreaDamageSpellCastResolution => ({
    status: 'rejected',
    reason,
    characters: input.characters,
    casterBefore: caster,
    casterAfter: caster,
    geometry,
    affectedTiles,
    includedTargetIds,
    excludedTargetIds,
    targetResults: [],
    rolledDamage: 0,
    processedEventIds: [...input.processedEventIds],
  });

  const eventId = input.executionEventId.trim();
  if (!eventId) return reject('invalid_event_id');
  if (input.processedEventIds.has(eventId)) return reject('replayed_event');
  if (!caster || !input.mapData) return reject('missing_actor');

  const { requestedSlotLevel, spell, cost } = input.action;
  if (!Number.isInteger(requestedSlotLevel) || requestedSlotLevel < 0 || requestedSlotLevel > 9) {
    return reject('invalid_slot_level');
  }
  if (spell.level === 0 && requestedSlotLevel !== 0) return reject('cantrip_slot_forbidden');
  if (spell.level > 0 && requestedSlotLevel < spell.level) return reject('below_base_slot');
  if (!hasEligibleSpell(caster, spell)) return reject('spell_not_eligible');
  if (input.turnState.currentCharacterId !== caster.id) return reject('off_turn');

  const effect = findSaveDamageEffect(spell);
  if (!effect) return reject('unsupported_damage_spell');
  const combatArea = toCombatArea(spell);
  if (!combatArea) return reject('unsupported_area_shape');
  const invalidPlacement = placementRejection(input, caster);
  if (invalidPlacement) return reject(invalidPlacement);
  if (!canAffordActionCost(caster, { ...cost, spellSlotLevel: 0 })) {
    return reject('action_unavailable');
  }
  if (readRequestedSlot(caster, requestedSlotLevel) <= 0) return reject('slot_unavailable');

  const geometry = resolveAoEParams(combatArea, input.placement, caster);
  if (!geometry) return reject('unsupported_area_shape');
  const affectedTiles = clippedAffectedTiles(input.mapData, geometry);
  const affectedKeys = new Set(affectedTiles.map(position => `${position.x}-${position.y}`));
  const included = input.characters.filter(character => intersectsArea(character, affectedKeys));
  const excluded = input.characters.filter(character => (
    character.id !== caster.id && !intersectsArea(character, affectedKeys)
  ));
  const includedTargetIds = included.map(character => character.id);
  const excludedTargetIds = excluded.map(character => character.id);
  if (included.length === 0) {
    return reject('no_eligible_targets', geometry, affectedTiles, includedTargetIds, excludedTargetIds);
  }

  const scaledFormula = ScalingEngine.scaleEffect(
    effect.damage.dice,
    effect.scaling,
    requestedSlotLevel,
    caster.level,
    spell.level,
  );
  const rolledDamage = rollDamage(scaledFormula, false, 1, input.damageRng);
  const saveDC = calculateSpellDC(caster);
  const resolvedById = new Map<string, CombatCharacter>();
  const targetResults = included.map(target => {
    const save = rollSavingThrow(
      target,
      effect.condition.saveType!,
      saveDC,
      undefined,
      { damageType: effect.damage.type, tags: ['magic', 'area'] },
      undefined,
      { rng: input.saveRng ? () => input.saveRng!(target) : undefined },
    );
    const damageAfterSave = calculateSaveDamage(
      rolledDamage,
      save,
      effect.condition.saveEffect ?? 'half',
    );
    const finalDamage = ResistanceCalculator.applyResistances(
      damageAfterSave,
      effect.damage.type,
      target,
      caster,
      true,
      { spellZones: input.spellZones, characters: input.characters },
    );
    const resolvedTarget = applyDamageAndCheckDowned(target, finalDamage);
    resolvedById.set(target.id, resolvedTarget);
    return {
      targetId: target.id,
      saveTotal: save.total,
      saveDC,
      saveSucceeded: save.success,
      damageAfterSave,
      finalDamage,
      hpBefore: target.currentHP,
      hpAfter: resolvedTarget.currentHP,
      tempHPBefore: target.tempHP ?? 0,
      tempHPAfter: resolvedTarget.tempHP ?? 0,
      downed: resolvedTarget.currentHP === 0,
    };
  });

  const paidCaster = consumeActionCost(caster, cost);
  const characters = input.characters.map(character => {
    const targetResult = resolvedById.get(character.id);
    if (character.id === caster.id) {
      // A caster caught in their own area receives damage and pays from that
      // resolved copy, so neither side of the transaction overwrites the other.
      return consumeActionCost(targetResult ?? character, cost);
    }
    return targetResult ?? character;
  });

  return {
    status: 'resolved',
    reason: 'resolved',
    characters,
    casterBefore: caster,
    casterAfter: characters.find(character => character.id === caster.id) ?? paidCaster,
    geometry,
    affectedTiles,
    includedTargetIds,
    excludedTargetIds,
    targetResults,
    baseFormula: effect.damage.dice,
    scaledFormula,
    rolledDamage,
    processedEventIds: [...input.processedEventIds, eventId],
  };
}
