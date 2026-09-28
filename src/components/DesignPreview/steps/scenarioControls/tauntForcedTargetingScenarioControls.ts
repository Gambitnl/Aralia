// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 10:23:18
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the deterministic Taunt & Forced Targeting controls.
 *
 * The board reads Compelled Duel's live spell record for range, line of sight,
 * Wisdom save, duration, Bonus Action, level-1 slot, disadvantage, and leash
 * facts. A small hostile-only arena gate and an explicit forced-targeting
 * immunity marker exercise generic taunt eligibility without rewriting the
 * spell. Follow-up attacks and cleanup call the production taunt helpers, so
 * the rendered restriction is the same rule used by normal weapon and spell
 * attacks rather than a label maintained only by this preview.
 *
 * Called by: PreviewCombatScenarios and the scenario-control registry.
 * Depends on: canonical Compelled Duel data, production target validation,
 * saving throws, action economy, attack resolution, and taunt lifecycle rules.
 */

import compelledDuelData from '@/data/spells/level-1/compelled-duel.json';
import type { GameState, PlayerCharacter, SpellSlots } from '../../../../types';
import type { CommandContext } from '../../../../commands/base/SpellCommand';
import { MovementCommand } from '../../../../commands/effects/MovementCommand';
import type {
  AbilityCost,
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  CombatState,
  StatusEffect,
  TurnState,
} from '../../../../types/combat';
import type { MovementEffect, Spell, UtilityEffect } from '../../../../types/spells';
import { isUtilityEffect } from '../../../../types/spells';
import { TargetResolver } from '../../../../systems/spells/targeting/TargetResolver';
import {
  clearInvalidTaunts,
  hasTauntAttackDisadvantage,
  validateTauntWillingMove,
} from '../../../../systems/combat/tauntConstraint';
import { createAbilityFromSpell } from '../../../../utils/character/spellAbilityFactory';
import {
  calculateSpellDC,
  rollSavingThrow,
} from '../../../../utils/character/savingThrowUtils';
import {
  canAffordActionCost,
  consumeActionCost,
  resetEconomy,
} from '../../../../utils/combat/actionEconomyUtils';
import {
  getDistance,
  resolveAttack,
  validateCharacterPlacement,
} from '../../../../utils/combat/combatUtils';
import {
  rollD20,
} from '../../../../systems/dice/rollers';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Canonical Rule Source And Stable Board Facts
// ============================================================================
// JSON string literals widen during import, while the spell pipeline validates
// this same record elsewhere. Runtime guards below still reject a missing taunt
// or Wisdom-save payload instead of replacing it with scenario-owned numbers.
// ============================================================================

const COMPELLED_DUEL = compelledDuelData as unknown as Spell;
const COMPELLED_DUEL_TAUNT = COMPELLED_DUEL.effects.find(effect => (
  isUtilityEffect(effect) && effect.taunt?.disadvantageAgainstOthers === true
)) as UtilityEffect | undefined;

export const TAUNT_FORCED_TARGETING_CASTER_ID = 'taunt_forced_targeting-taunter';
export const TAUNT_FORCED_TARGETING_TARGET_ID = 'taunt_forced_targeting-compelled';
export const TAUNT_FORCED_TARGETING_OTHER_ID = 'taunt_forced_targeting-protected-ally';

export const TAUNT_FORCED_TARGETING_CASTER_START = { x: 3, y: 5 } as const;
export const TAUNT_FORCED_TARGETING_TARGET_START = { x: 8, y: 5 } as const;
export const TAUNT_FORCED_TARGETING_TARGET_OUT_OF_RANGE = { x: 10, y: 5 } as const;
export const TAUNT_FORCED_TARGETING_OTHER_START = { x: 8, y: 8 } as const;
export const TAUNT_FORCED_TARGETING_SIGHT_BLOCKER = { x: 5, y: 5 } as const;
export const TAUNT_FORCED_TARGETING_FORCED_DESTINATION = { x: 9, y: 5 } as const;
export const TAUNT_FORCED_TARGETING_TOO_FAR_DESTINATION = { x: 10, y: 5 } as const;
export const TAUNT_FORCED_TARGETING_OFF_BOARD_START = { x: 15, y: 5 } as const;
export const TAUNT_FORCED_TARGETING_OFF_BOARD_DESTINATION = { x: 16, y: 5 } as const;

export const TAUNT_FORCED_TARGETING_ATTACK_BONUS = 5;
export const TAUNT_FORCED_TARGETING_TARGET_AC = 15;
export const TAUNT_FORCED_TARGETING_RANGE_FEET = 'range' in COMPELLED_DUEL.targeting
  ? COMPELLED_DUEL.targeting.range
  : 0;
export const TAUNT_FORCED_TARGETING_SAVE_FAILURE_FACE = 6;
export const TAUNT_FORCED_TARGETING_SAVE_SUCCESS_FACE = 18;
export const TAUNT_FORCED_TARGETING_ATTACK_HIGH_FACE = 16;
export const TAUNT_FORCED_TARGETING_ATTACK_LOW_FACE = 5;

const TARGET_CASE_MARKER_PREFIX = 'taunt-target-case:';
const FOLLOW_UP_MARKER_PREFIX = 'taunt-follow-up:';
const FORCED_TARGETING_IMMUNITY_ID = 'taunt-forced-targeting-immunity';
const TAUNT_STATUS_ID = 'taunt-forced-targeting-compelled-duel';

export type TauntTargetCase =
  | 'failed_save'
  | 'successful_save'
  | 'immune'
  | 'out_of_range'
  | 'blocked_line_of_sight'
  | 'non_hostile';

export type TauntFollowUpCase =
  | 'attack_taunter'
  | 'attack_other'
  | 'willing_move_beyond_leash'
  | 'forced_move_legal'
  | 'forced_move_blocked'
  | 'forced_move_off_board'
  | 'forced_move_occupied'
  | 'forced_move_too_far'
  | 'source_missing'
  | 'source_downed'
  | 'source_incapacitated'
  | 'expiry'
  | 'manual_removal';

interface TauntActors {
  caster: CombatCharacter;
  target: CombatCharacter;
  other: CombatCharacter;
}

// ============================================================================
// Repeatable Character And Map Preparation
// ============================================================================
// Reset Board and selector changes rebuild only scenario-owned facts. Unrelated
// actors, map cells, and non-scenario records remain untouched.
// ============================================================================

export function createTauntForcedTargetingSpellSlots(): SpellSlots {
  // SpellSlots is a complete nine-level inventory. Only level 1 is stocked;
  // explicit empty rows prevent preview-only optional-slot assumptions.
  return {
    level_1: { current: 1, max: 1 },
    level_2: { current: 0, max: 0 },
    level_3: { current: 0, max: 0 },
    level_4: { current: 0, max: 0 },
    level_5: { current: 0, max: 0 },
    level_6: { current: 0, max: 0 },
    level_7: { current: 0, max: 0 },
    level_8: { current: 0, max: 0 },
    level_9: { current: 0, max: 0 },
  };
}

function findActors(characters: CombatCharacter[]): TauntActors | null {
  const caster = characters.find(character => character.id === TAUNT_FORCED_TARGETING_CASTER_ID);
  const target = characters.find(character => character.id === TAUNT_FORCED_TARGETING_TARGET_ID);
  const other = characters.find(character => character.id === TAUNT_FORCED_TARGETING_OTHER_ID);
  return caster && target && other ? { caster, target, other } : null;
}

function replaceActors(
  characters: CombatCharacter[],
  actors: TauntActors,
): CombatCharacter[] {
  const replacements = new Map<string, CombatCharacter>([
    [actors.caster.id, actors.caster],
    [actors.target.id, actors.target],
    [actors.other.id, actors.other],
  ]);
  return characters.map(character => replacements.get(character.id) ?? character);
}

function withoutScenarioMarkers(statusEffects: StatusEffect[]): StatusEffect[] {
  return statusEffects.filter(status => (
    !status.id.startsWith(TARGET_CASE_MARKER_PREFIX) &&
    !status.id.startsWith(FOLLOW_UP_MARKER_PREFIX) &&
    status.id !== FORCED_TARGETING_IMMUNITY_ID &&
    status.id !== 'taunt-save-success-input' &&
    status.id !== TAUNT_STATUS_ID
  ));
}

function createScenarioMarker(id: string, label: string): StatusEffect {
  return {
    id,
    name: label,
    type: 'neutral',
    duration: 99,
    source: 'Tactical Sandbox Taunt Controls',
    description: 'Scenario-owned deterministic input consumed by the control resolver.',
    effect: { type: 'condition' },
  };
}

function readLevelOneSlot(caster: CombatCharacter): string {
  const slot = caster.spellSlots?.level_1;
  return slot ? `${slot.current}/${slot.max}` : 'unavailable';
}

function withAuditableNames(actors: TauntActors): TauntActors {
  const tauntStatus = actors.target.statusEffects.find(status => status.id === TAUNT_STATUS_ID);
  const restriction = tauntStatus
    ? `Taunted ${tauntStatus.duration}r`
    : actors.target.statusEffects.some(status => status.id === FORCED_TARGETING_IMMUNITY_ID)
      ? 'Forced-target immune'
      : 'Unrestricted';
  const concentration = actors.caster.concentratingOn?.spellId === COMPELLED_DUEL.id
    ? 'Concentrating'
    : 'No concentration';

  return {
    caster: {
      ...actors.caster,
      name: `Challenge Knight · BA ${actors.caster.actionEconomy.bonusAction.used ? 'spent' : 'ready'} · L1 ${readLevelOneSlot(actors.caster)} · ${concentration}`,
    },
    target: {
      ...actors.target,
      name: `Goaded Raider · WIS +0 · ${restriction}`,
    },
    other: {
      ...actors.other,
      name: 'Protected Ally · AC 15 · alternate target',
    },
  };
}

export function prepareTauntForcedTargetingCharacters(
  characters: CombatCharacter[],
): CombatCharacter[] {
  const found = findActors(characters);
  if (!found) return characters;

  const caster = resetEconomy({
    ...found.caster,
    position: { ...TAUNT_FORCED_TARGETING_CASTER_START },
    team: 'player',
    level: 5,
    stats: {
      ...found.caster.stats,
      charisma: 16,
      intelligence: 16,
    },
    spellSlots: createTauntForcedTargetingSpellSlots(),
    concentratingOn: undefined,
    statusEffects: withoutScenarioMarkers(found.caster.statusEffects ?? []),
    conditions: (found.caster.conditions ?? []).filter(condition => (
      condition.name !== 'Unconscious' && condition.name !== 'Incapacitated'
    )),
    currentHP: Math.max(30, found.caster.maxHP ?? 30),
    maxHP: Math.max(30, found.caster.maxHP ?? 30),
    abilities: [],
  });
  const target = resetEconomy({
    ...found.target,
    position: { ...TAUNT_FORCED_TARGETING_TARGET_START },
    team: 'enemy',
    stats: {
      ...found.target.stats,
      wisdom: 10,
    },
    savingThrowProficiencies: [],
    statusEffects: withoutScenarioMarkers(found.target.statusEffects ?? []),
    abilities: [],
  });
  const other = resetEconomy({
    ...found.other,
    position: { ...TAUNT_FORCED_TARGETING_OTHER_START },
    team: 'player',
    armorClass: TAUNT_FORCED_TARGETING_TARGET_AC,
    baseAC: TAUNT_FORCED_TARGETING_TARGET_AC,
    statusEffects: withoutScenarioMarkers(found.other.statusEffects ?? []),
    abilities: [],
  });

  const withDefaults = withAuditableNames({
    caster: {
      ...caster,
      statusEffects: [
        ...caster.statusEffects,
        createScenarioMarker(`${FOLLOW_UP_MARKER_PREFIX}attack_other`, 'Follow-up: Attack Other'),
      ],
    },
    target: {
      ...target,
      statusEffects: [
        ...target.statusEffects,
        createScenarioMarker(`${TARGET_CASE_MARKER_PREFIX}failed_save`, 'Target Case: Failed Save'),
      ],
    },
    other,
  });

  return replaceActors(characters, withDefaults);
}

function updateTile(
  mapData: BattleMapData,
  position: { x: number; y: number },
  update: (tile: BattleMapTile) => BattleMapTile,
): BattleMapData {
  const id = `${position.x}-${position.y}`;
  const tile = mapData.tiles.get(id);
  if (!tile) return mapData;

  const tiles = new Map(mapData.tiles);
  tiles.set(id, update(tile));
  return { ...mapData, tiles };
}

function prepareForcedMovementFixtureMap(mapData: BattleMapData): BattleMapData {
  // Selector changes may follow one another without Reset. Restore the exact
  // destination to the normal duel-lane floor before applying a new blocker so
  // one rejected case cannot contaminate the next movement transaction.
  return updateTile(mapData, TAUNT_FORCED_TARGETING_FORCED_DESTINATION, tile => ({
    ...tile,
    terrain: 'sand',
    movementCost: 5,
    blocksMovement: false,
    blocksLoS: false,
    effects: ['taunt-compelled-duel-lane', 'taunt-forced-move-destination'],
  }));
}

export function prepareTauntForcedTargetingMapData(mapData: BattleMapData): BattleMapData {
  let nextMap = mapData;

  // Gold cells show Compelled Duel's thirty-foot acquisition lane. The cyan
  // branch points to the alternate attack target whose roll becomes penalized.
  for (let x = 3; x <= 9; x += 1) {
    nextMap = updateTile(nextMap, { x, y: 5 }, tile => ({
      ...tile,
      terrain: 'sand',
      movementCost: 5,
      blocksMovement: false,
      blocksLoS: false,
      effects: ['taunt-compelled-duel-lane'],
    }));
  }
  for (let y = 6; y <= 8; y += 1) {
    nextMap = updateTile(nextMap, { x: 8, y }, tile => ({
      ...tile,
      terrain: 'rock',
      movementCost: 5,
      blocksMovement: false,
      blocksLoS: false,
      effects: ['taunt-alternate-target-lane'],
    }));
  }

  return prepareForcedMovementFixtureMap(nextMap);
}

// ============================================================================
// Target-Case Configuration
// ============================================================================
// The selector writes real position, team, wall, and immunity facts. The action
// later reads those facts through production validation before any payment.
// ============================================================================

function setTargetCase(
  application: PreviewCombatScenarioControlApplication,
  value: TauntTargetCase,
): PreviewCombatScenarioControlPatch {
  const mapData = application.snapshot.mapData;
  const found = findActors(application.snapshot.characters);
  if (!mapData || !found) {
    return { logMessage: 'TAUNT TARGET CASE REJECTED: scenario actors or map are missing.' };
  }

  const baselineCharacters = prepareTauntForcedTargetingCharacters(application.snapshot.characters);
  const baseline = findActors(baselineCharacters);
  if (!baseline) {
    return { logMessage: 'TAUNT TARGET CASE REJECTED: reset actors are missing.' };
  }

  let nextMap = prepareTauntForcedTargetingMapData(mapData);
  let target: CombatCharacter = {
    ...baseline.target,
    statusEffects: [
      ...withoutScenarioMarkers(baseline.target.statusEffects),
      createScenarioMarker(`${TARGET_CASE_MARKER_PREFIX}${value}`, `Target Case: ${value}`),
    ],
  };

  if (value === 'successful_save') {
    target = {
      ...target,
      statusEffects: [
        ...target.statusEffects,
        createScenarioMarker('taunt-save-success-input', 'Authored Wisdom Save Success'),
      ],
    };
  }
  if (value === 'immune') {
    target = {
      ...target,
      statusEffects: [
        ...target.statusEffects,
        createScenarioMarker(FORCED_TARGETING_IMMUNITY_ID, 'Forced Targeting Immunity'),
      ],
    };
  }
  if (value === 'out_of_range') {
    target = { ...target, position: { ...TAUNT_FORCED_TARGETING_TARGET_OUT_OF_RANGE } };
  }
  if (value === 'non_hostile') {
    target = { ...target, team: baseline.caster.team };
  }
  if (value === 'blocked_line_of_sight') {
    nextMap = updateTile(nextMap, TAUNT_FORCED_TARGETING_SIGHT_BLOCKER, tile => ({
      ...tile,
      terrain: 'wall',
      movementCost: Infinity,
      blocksMovement: true,
      blocksLoS: true,
      effects: ['taunt-total-cover-wall'],
    }));
  }

  const named = withAuditableNames({ ...baseline, target });
  return {
    mapData: nextMap,
    characters: replaceActors(baselineCharacters, named),
    logMessage: `TARGET CASE: ${value}; no Bonus Action, slot, save, or taunt has resolved yet.`,
  };
}

// ============================================================================
// Canonical Taunt Application
// ============================================================================
// Invalid target and immunity gates run before payment. A legal cast pays first,
// then rolls the canonical Wisdom save: success keeps the cost but applies no
// effect, while failure creates the source-linked production taunt marker.
// ============================================================================

function createCombatState(
  characters: CombatCharacter[],
  mapData: BattleMapData,
  turnState: TurnState = {} as TurnState,
): CombatState {
  return {
    characters,
    isActive: true,
    turnState,
    selectedCharacterId: null,
    selectedAbilityId: null,
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    mapData,
    combatLog: [],
    reactiveTriggers: [],
    activeLightSources: [],
  };
}

function createCompelledDuelCost(caster: CombatCharacter): AbilityCost {
  return createAbilityFromSpell(
    COMPELLED_DUEL,
    caster as unknown as PlayerCharacter,
  ).cost;
}

function d20Source(face: number): () => number {
  const boundedFace = Math.min(20, Math.max(1, face));
  return () => (boundedFace - 0.5) / 20;
}

function applyTaunt(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const mapData = application.snapshot.mapData;
  const found = findActors(application.snapshot.characters);
  if (!mapData || !found || !COMPELLED_DUEL_TAUNT?.taunt) {
    return { logMessage: 'TAUNT APPLICATION REJECTED: canonical Compelled Duel payload or board state is missing.' };
  }

  // Casting is a Bonus Action owned by the source. Reject an off-turn click
  // before target validation, payment, or the Wisdom d20 is requested.
  if (application.snapshot.turnState?.currentCharacterId !== found.caster.id) {
    return {
      characters: application.snapshot.characters,
      logMessage: `TAUNT REJECTED (not_turn_owner): live turn owner=${application.snapshot.turnState?.currentCharacterId ?? 'none'}; required=${found.caster.id}; BA and L1 unchanged; ROLL: not made.`,
    };
  }

  // This arena demonstrates hostile challenge selection. Compelled Duel's JSON
  // itself says "one creature"; the relation gate is deliberately identified
  // separately so the scenario does not claim the spell has an enemy-only tag.
  if (found.target.team === found.caster.team) {
    return {
      characters: application.snapshot.characters,
      logMessage: 'TAUNT REJECTED (non_hostile): arena challenge requires a hostile creature; BA ready; L1 unchanged; no effect.',
    };
  }

  if (found.target.statusEffects.some(status => status.id === FORCED_TARGETING_IMMUNITY_ID)) {
    return {
      characters: application.snapshot.characters,
      logMessage: 'TAUNT REJECTED (forced_targeting_immune): explicit immunity fact checked before payment; BA ready; L1 unchanged; no effect.',
    };
  }

  const targetRejection = TargetResolver.getTargetRejectionReason(
    COMPELLED_DUEL.targeting,
    found.caster,
    found.target,
    createCombatState(application.snapshot.characters, mapData),
  );
  if (targetRejection) {
    return {
      characters: application.snapshot.characters,
      logMessage: `TAUNT REJECTED (${targetRejection.code}): ${targetRejection.message} BA ready; L1 unchanged; no effect.`,
    };
  }

  const cost = createCompelledDuelCost(found.caster);
  if (!canAffordActionCost(found.caster, cost)) {
    return {
      characters: application.snapshot.characters,
      logMessage: 'TAUNT REJECTED (cost_unavailable): Bonus Action or level-1 slot unavailable; no effect.',
    };
  }

  const paidCaster = consumeActionCost(found.caster, cost);
  const saveFace = found.target.statusEffects.some(status => status.id === 'taunt-save-success-input')
    ? TAUNT_FORCED_TARGETING_SAVE_SUCCESS_FACE
    : TAUNT_FORCED_TARGETING_SAVE_FAILURE_FACE;
  const saveDc = calculateSpellDC(found.caster);
  const save = rollSavingThrow(
    found.target,
    'Wisdom',
    saveDc,
    undefined,
    { tags: ['enchantment', 'taunt'] },
    undefined,
    { rng: d20Source(saveFace) },
  );

  if (save.success) {
    const named = withAuditableNames({ ...found, caster: paidCaster });
    return {
      characters: replaceActors(application.snapshot.characters, named),
      logMessage: `TAUNT SAVED: WIS ${save.roll ?? saveFace} + ${save.total - (save.roll ?? saveFace)} = ${save.total} vs DC ${saveDc}; valid cast spends Bonus Action + L1, but applies no condition or targeting penalty.`,
    };
  }

  const durationRounds = COMPELLED_DUEL.duration.unit === 'minute'
    ? (COMPELLED_DUEL.duration.value ?? 1) * 10
    : COMPELLED_DUEL.duration.value ?? 10;
  const tauntStatus: StatusEffect = {
    id: TAUNT_STATUS_ID,
    name: 'Taunted',
    type: 'debuff',
    duration: durationRounds,
    source: COMPELLED_DUEL.name,
    sourceSpellId: COMPELLED_DUEL.id,
    sourceCasterId: found.caster.id,
    taunt: COMPELLED_DUEL_TAUNT.taunt,
    description: COMPELLED_DUEL_TAUNT.description,
    effect: { type: 'condition' },
  };
  const caster = {
    ...paidCaster,
    concentratingOn: {
      spellId: COMPELLED_DUEL.id,
      spellName: COMPELLED_DUEL.name,
      spellLevel: COMPELLED_DUEL.level,
      startedTurn: 1,
      effectIds: [TAUNT_STATUS_ID],
      canDropAsFreeAction: true,
    },
  };
  const target = {
    ...found.target,
    statusEffects: [
      ...found.target.statusEffects.filter(status => status.id !== TAUNT_STATUS_ID),
      tauntStatus,
    ],
  };
  const named = withAuditableNames({ ...found, caster, target });

  return {
    characters: replaceActors(application.snapshot.characters, named),
    logMessage: `TAUNT APPLIED: WIS ${save.roll ?? saveFace} + ${save.total - (save.roll ?? saveFace)} = ${save.total} vs DC ${saveDc}; BA + L1 spent; ${durationRounds} rounds; disadvantage vs others; legal taunter target remains normal.`,
  };
}

// ============================================================================
// Follow-Up Attack And Cleanup Resolution
// ============================================================================
// The selector stores one neutral scenario marker on the caster. The action
// reads it, then calls production attack or cleanup helpers against live state.
// ============================================================================

function setFollowUp(
  application: PreviewCombatScenarioControlApplication,
  value: TauntFollowUpCase,
): PreviewCombatScenarioControlPatch {
  const found = findActors(application.snapshot.characters);
  if (!found || !application.snapshot.mapData) {
    return { logMessage: 'TAUNT FOLLOW-UP REJECTED: scenario actors are missing.' };
  }

  // Every selection starts from the same physical lane while preserving the
  // live taunt, paid resources, and action ledger. Only the chosen obstacle or
  // source-loss fact is layered on top for the later atomic transaction.
  let mapData = prepareForcedMovementFixtureMap(application.snapshot.mapData);
  const caster = {
    ...found.caster,
    statusEffects: [
      ...found.caster.statusEffects.filter(status => !status.id.startsWith(FOLLOW_UP_MARKER_PREFIX)),
      createScenarioMarker(`${FOLLOW_UP_MARKER_PREFIX}${value}`, `Follow-up: ${value}`),
    ],
  };
  let target: CombatCharacter = {
    ...found.target,
    position: { ...TAUNT_FORCED_TARGETING_TARGET_START },
  };
  let other: CombatCharacter = {
    ...found.other,
    position: { ...TAUNT_FORCED_TARGETING_OTHER_START },
  };

  if (value === 'forced_move_blocked') {
    mapData = updateTile(mapData, TAUNT_FORCED_TARGETING_FORCED_DESTINATION, tile => ({
      ...tile,
      terrain: 'wall',
      movementCost: Infinity,
      blocksMovement: true,
      blocksLoS: true,
      effects: ['taunt-forced-move-blocker'],
    }));
  }
  if (value === 'forced_move_occupied') {
    other = { ...other, position: { ...TAUNT_FORCED_TARGETING_FORCED_DESTINATION } };
  }
  if (value === 'forced_move_off_board') {
    target = { ...target, position: { ...TAUNT_FORCED_TARGETING_OFF_BOARD_START } };
  }

  return {
    mapData,
    characters: replaceActors(application.snapshot.characters, { caster, target, other }),
    logMessage: `FOLLOW-UP SELECTED: ${value}; position=${target.position.x},${target.position.y}; Action=${target.actionEconomy.action.used ? 'spent' : 'ready'}; no roll, movement, or cleanup has resolved.`,
  };
}

function createAttackRandomSource(): () => number {
  const faces = [TAUNT_FORCED_TARGETING_ATTACK_HIGH_FACE, TAUNT_FORCED_TARGETING_ATTACK_LOW_FACE];
  let index = 0;
  return () => {
    const face = faces[Math.min(index, faces.length - 1)];
    index += 1;
    return (face - 0.5) / 20;
  };
}

function resolveAttackFollowUp(
  application: PreviewCombatScenarioControlApplication,
  found: TauntActors,
  followUp: Extract<TauntFollowUpCase, 'attack_taunter' | 'attack_other'>,
): PreviewCombatScenarioControlPatch {
  const turnOwner = application.snapshot.turnState?.currentCharacterId;

  // The compelled creature owns this attack. Turn and Action validation both
  // precede RNG construction, resource payment, or any actor replacement.
  if (turnOwner !== found.target.id) {
    return {
      characters: application.snapshot.characters,
      logMessage: `ATTACK REJECTED (not_turn_owner): live turn owner=${turnOwner ?? 'none'}; required=${found.target.id}; position=${found.target.position.x},${found.target.position.y}; Action=${found.target.actionEconomy.action.used ? 'spent' : 'ready'}; ROLL: not made; state unchanged.`,
    };
  }
  if (
    found.target.actionEconomy.action.remaining <= 0
    || !canAffordActionCost(found.target, { type: 'action' })
  ) {
    return {
      characters: application.snapshot.characters,
      logMessage: `ATTACK REJECTED (action_unavailable): live turn owner=${turnOwner}; Action=spent; remaining=${found.target.actionEconomy.action.remaining}; position=${found.target.position.x},${found.target.position.y}; ROLL: not made; state unchanged.`,
    };
  }

  const attackTarget = followUp === 'attack_taunter' ? found.caster : found.other;
  const disadvantage = hasTauntAttackDisadvantage(
    found.target,
    attackTarget.id,
    application.snapshot.characters,
  );
  const paidTarget = consumeActionCost(found.target, { type: 'action' });
  const d20 = rollD20({ disadvantage, rng: createAttackRandomSource() });
  const attack = resolveAttack(
    d20,
    TAUNT_FORCED_TARGETING_ATTACK_BONUS,
    attackTarget.armorClass || TAUNT_FORCED_TARGETING_TARGET_AC,
  );
  const named = withAuditableNames({ ...found, target: paidTarget });
  const dice = disadvantage
    ? `${TAUNT_FORCED_TARGETING_ATTACK_HIGH_FACE}/${TAUNT_FORCED_TARGETING_ATTACK_LOW_FACE} keep ${d20}`
    : `${d20}`;

  return {
    characters: replaceActors(application.snapshot.characters, named),
    logMessage: `ATTACK ${attackTarget.name}: live turn owner=${turnOwner}; ${disadvantage ? 'DISADVANTAGE' : 'NORMAL'} ROLL: d20 ${dice} + ${TAUNT_FORCED_TARGETING_ATTACK_BONUS} = ${d20 + TAUNT_FORCED_TARGETING_ATTACK_BONUS} vs AC ${attackTarget.armorClass || TAUNT_FORCED_TARGETING_TARGET_AC}; ${attack.isHit ? 'HIT' : 'MISS'}; target Action spent; position=${paidTarget.position.x},${paidTarget.position.y}.`,
  };
}

function createForcedMovementEffect(): MovementEffect {
  // This is a source-owned instantaneous effect, not willing movement by the
  // target. MovementCommand therefore changes position without touching the
  // compelled creature's movement pool or provoking an opportunity attack.
  return {
    type: 'MOVEMENT',
    movementType: 'push',
    distance: 5,
    duration: { type: 'instantaneous' },
    forcedMovement: {
      direction: 'away_from_caster',
      maxDistance: '5 ft',
      usesReaction: false,
    },
    trigger: { type: 'immediate', movementType: 'forced' },
    condition: { type: 'always' },
  };
}

function resolveForcedMovementFollowUp(
  application: PreviewCombatScenarioControlApplication,
  found: TauntActors,
  followUp: Extract<
    TauntFollowUpCase,
    | 'forced_move_legal'
    | 'forced_move_blocked'
    | 'forced_move_off_board'
    | 'forced_move_occupied'
    | 'forced_move_too_far'
  >,
): PreviewCombatScenarioControlPatch {
  const mapData = application.snapshot.mapData;
  const turnOwner = application.snapshot.turnState?.currentCharacterId;
  if (!mapData) {
    return { logMessage: 'FORCED MOVE REJECTED (map_missing): ROLL: not applicable; state unchanged.' };
  }

  // The source effect resolves on its owner's live turn. It does not borrow the
  // compelled target's Action or movement, and an off-turn request is atomic.
  if (turnOwner !== found.caster.id) {
    return {
      characters: application.snapshot.characters,
      logMessage: `FORCED MOVE REJECTED (not_turn_owner): live turn owner=${turnOwner ?? 'none'}; required source=${found.caster.id}; target movement=${found.target.actionEconomy.movement.used}/${found.target.actionEconomy.movement.total}; ROLL: not applicable; state unchanged.`,
    };
  }

  const destination = followUp === 'forced_move_off_board'
    ? TAUNT_FORCED_TARGETING_OFF_BOARD_DESTINATION
    : followUp === 'forced_move_too_far'
      ? TAUNT_FORCED_TARGETING_TOO_FAR_DESTINATION
      : TAUNT_FORCED_TARGETING_FORCED_DESTINATION;
  const requestedDistanceFeet = getDistance(found.target.position, destination) * 5;
  if (requestedDistanceFeet > 5) {
    return {
      characters: application.snapshot.characters,
      logMessage: `FORCED MOVE REJECTED (distance_exceeded): requested=${requestedDistanceFeet} ft; source effect maximum=5 ft; position=${found.target.position.x},${found.target.position.y}; target movement unchanged=${found.target.actionEconomy.movement.used}/${found.target.actionEconomy.movement.total}; ROLL: not applicable.`,
    };
  }

  const placement = validateCharacterPlacement(
    found.target,
    destination,
    mapData,
    application.snapshot.characters,
  );
  if (!placement.allowed) {
    return {
      characters: application.snapshot.characters,
      logMessage: `FORCED MOVE REJECTED (invalid_destination): ${placement.reason} position=${found.target.position.x},${found.target.position.y}; target movement unchanged=${found.target.actionEconomy.movement.used}/${found.target.actionEconomy.movement.total}; ROLL: not applicable; state unchanged.`,
    };
  }

  const combatState = createCombatState(
    application.snapshot.characters,
    mapData,
    application.snapshot.turnState,
  );
  const context: CommandContext = {
    spellId: 'taunt-forced-targeting-source-effect',
    spellName: 'Source Forced Movement Effect',
    castAtLevel: 0,
    caster: found.caster,
    targets: [found.target],
    gameState: combatState as unknown as GameState,
  };
  const movedState = new MovementCommand(createForcedMovementEffect(), context).execute(combatState);
  const movedTarget = movedState.characters.find(character => character.id === found.target.id) ?? found.target;
  const namedActors = findActors(movedState.characters);
  const finalCharacters = namedActors
    ? replaceActors(movedState.characters, withAuditableNames(namedActors))
    : movedState.characters;

  return {
    characters: finalCharacters,
    logMessage: `FORCED MOVE RESOLVED: source=${found.caster.id}; target=${found.target.id}; ${found.target.position.x},${found.target.position.y} -> ${movedTarget.position.x},${movedTarget.position.y}; requested=${requestedDistanceFeet} ft; target movement unchanged=${found.target.actionEconomy.movement.used}/${found.target.actionEconomy.movement.total} -> ${movedTarget.actionEconomy.movement.used}/${movedTarget.actionEconomy.movement.total}; target Action=${movedTarget.actionEconomy.action.used ? 'spent' : 'ready'}; ROLL: not applicable.`,
  };
}

function resolveWillingMovementFollowUp(
  application: PreviewCombatScenarioControlApplication,
  found: TauntActors,
): PreviewCombatScenarioControlPatch {
  const turnOwner = application.snapshot.turnState?.currentCharacterId;
  if (turnOwner !== found.target.id) {
    return {
      characters: application.snapshot.characters,
      logMessage: `WILLING MOVE REJECTED (not_turn_owner): live turn owner=${turnOwner ?? 'none'}; required=${found.target.id}; position=${found.target.position.x},${found.target.position.y}; movement=${found.target.actionEconomy.movement.used}/${found.target.actionEconomy.movement.total}; ROLL: not applicable; state unchanged.`,
    };
  }

  const validation = validateTauntWillingMove(
    found.target,
    TAUNT_FORCED_TARGETING_TOO_FAR_DESTINATION,
    application.snapshot.characters,
  );
  if (!validation.allowed) {
    return {
      characters: application.snapshot.characters,
      logMessage: `WILLING MOVE REJECTED (taunt_leash): destination=${TAUNT_FORCED_TARGETING_TOO_FAR_DESTINATION.x},${TAUNT_FORCED_TARGETING_TOO_FAR_DESTINATION.y} is beyond 30 ft from source=${validation.caster?.id ?? 'missing'}; position=${found.target.position.x},${found.target.position.y}; movement unchanged=${found.target.actionEconomy.movement.used}/${found.target.actionEconomy.movement.total}; ROLL: not applicable.`,
    };
  }

  return {
    characters: application.snapshot.characters,
    logMessage: 'WILLING MOVE REJECTED (unexpected_legal_result): the authored beyond-leash destination did not exercise the taunt restriction; state unchanged.',
  };
}

function resolveFollowUp(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const found = findActors(application.snapshot.characters);
  const casterMarker = application.snapshot.characters
    .find(character => character.id === TAUNT_FORCED_TARGETING_CASTER_ID)
    ?.statusEffects.find(status => status.id.startsWith(FOLLOW_UP_MARKER_PREFIX));
  const followUp = (casterMarker?.id.slice(FOLLOW_UP_MARKER_PREFIX.length) ?? 'attack_other') as TauntFollowUpCase;

  // Missing-source cleanup must work after the caster has deliberately left the
  // roster, so it is handled before the ordinary three-actor requirement.
  if (followUp === 'source_missing') {
    const withoutSource = application.snapshot.characters.filter(character => (
      character.id !== TAUNT_FORCED_TARGETING_CASTER_ID
    ));
    const cleanup = clearInvalidTaunts(withoutSource);
    return {
      characters: cleanup.characters,
      logMessage: `TAUNT CLEANUP: ${cleanup.cleanups[0]?.reason ?? 'none'}; missing source removed no target Action or movement; ROLL: not made; attack-other disadvantage=false.`,
    };
  }

  if (!found) {
    return { logMessage: 'TAUNT FOLLOW-UP REJECTED: scenario actors are missing.' };
  }

  if (followUp === 'attack_taunter' || followUp === 'attack_other') {
    return resolveAttackFollowUp(application, found, followUp);
  }
  if (followUp === 'willing_move_beyond_leash') {
    return resolveWillingMovementFollowUp(application, found);
  }
  if (followUp.startsWith('forced_move_')) {
    return resolveForcedMovementFollowUp(
      application,
      found,
      followUp as Extract<TauntFollowUpCase, `forced_move_${string}`>,
    );
  }

  if (followUp === 'manual_removal') {
    const caster = { ...found.caster, concentratingOn: undefined };
    const target = {
      ...found.target,
      statusEffects: found.target.statusEffects.filter(status => status.id !== TAUNT_STATUS_ID),
    };
    const named = withAuditableNames({ ...found, caster, target });
    const restrictionRemains = hasTauntAttackDisadvantage(
      target,
      found.other.id,
      replaceActors(application.snapshot.characters, named),
    );
    return {
      characters: replaceActors(application.snapshot.characters, named),
      logMessage: `TAUNT REMOVED: exact source marker and concentration link cleared; attack-other disadvantage=${restrictionRemains}; unrelated actor state preserved.`,
    };
  }

  let invalidCharacters = application.snapshot.characters;
  if (followUp === 'source_downed' || followUp === 'source_incapacitated') {
    invalidCharacters = invalidCharacters.map(character => (
      character.id === found.caster.id
        ? {
            ...character,
            currentHP: followUp === 'source_downed' ? 0 : character.currentHP,
            conditions: [
              ...(character.conditions ?? []).filter(condition => (
                condition.name !== 'Unconscious' && condition.name !== 'Incapacitated'
              )),
              {
                name: followUp === 'source_downed' ? 'Unconscious' as const : 'Incapacitated' as const,
                duration: { type: 'rounds' as const, value: 10 },
                appliedTurn: 1,
                source: `Tactical Sandbox ${followUp}`,
              },
            ],
          }
        : character
    ));
  } else {
    invalidCharacters = invalidCharacters.map(character => (
      character.id === found.target.id
        ? {
            ...character,
            statusEffects: character.statusEffects.map(status => (
              status.id === TAUNT_STATUS_ID ? { ...status, duration: 0 } : status
            )),
          }
        : character
    ));
  }

  const cleanup = clearInvalidTaunts(invalidCharacters);
  const cleanedActors = findActors(cleanup.characters);
  if (!cleanedActors) {
    return { characters: cleanup.characters, logMessage: 'TAUNT CLEANUP completed, but an authored actor is missing.' };
  }
  const named = withAuditableNames(cleanedActors);
  const finalCharacters = replaceActors(cleanup.characters, named);
  const restrictionRemains = hasTauntAttackDisadvantage(
    named.target,
    named.other.id,
    finalCharacters,
  );

  return {
    characters: finalCharacters,
    logMessage: `TAUNT CLEANUP: ${cleanup.cleanups[0]?.reason ?? 'none'}; source/concentration/status reconciled; attack-other disadvantage=${restrictionRemains}.`,
  };
}

// ============================================================================
// Visible Control Contract
// ============================================================================
// Four controls cover target eligibility, application, attacks, willing and
// forced movement, plus lifecycle cleanup. Reset remains the recovery path.
// ============================================================================

const tauntForcedTargetingScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'taunt_forced_targeting',
  controls: [
    {
      id: 'target_case',
      label: 'Taunt Target Case',
      description: 'Choose save, immunity, range, sight, or hostility facts before attempting the taunt.',
      kind: 'select',
      defaultValue: 'failed_save',
      options: [
        { value: 'failed_save', label: 'Hostile · failed save' },
        { value: 'successful_save', label: 'Hostile · successful save' },
        { value: 'immune', label: 'Forced-target immune' },
        { value: 'out_of_range', label: 'Beyond 30 ft' },
        { value: 'blocked_line_of_sight', label: 'Total Cover' },
        { value: 'non_hostile', label: 'Non-hostile ally' },
      ],
    },
    {
      id: 'attempt_taunt',
      label: 'Attempt Compelled Taunt',
      description: 'Validate, pay the canonical Bonus Action and level-1 slot, roll the Wisdom save, and apply the source-linked restriction on failure.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'follow_up_case',
      label: 'Attack / Movement / Cleanup Case',
      description: 'Choose a turn-gated attack, willing move, source-owned forced move, or source-linked cleanup.',
      kind: 'select',
      defaultValue: 'attack_other',
      options: [
        { value: 'attack_taunter', label: 'Attack taunter' },
        { value: 'attack_other', label: 'Attack other' },
        { value: 'willing_move_beyond_leash', label: 'Willing move beyond leash' },
        { value: 'forced_move_legal', label: 'Forced move · legal' },
        { value: 'forced_move_blocked', label: 'Forced move · blocked' },
        { value: 'forced_move_off_board', label: 'Forced move · off board' },
        { value: 'forced_move_occupied', label: 'Forced move · occupied' },
        { value: 'forced_move_too_far', label: 'Forced move · too far' },
        { value: 'source_missing', label: 'Source missing' },
        { value: 'source_downed', label: 'Source downed' },
        { value: 'source_incapacitated', label: 'Source Incapacitated' },
        { value: 'expiry', label: 'Duration expires' },
        { value: 'manual_removal', label: 'Remove effect' },
      ],
    },
    {
      id: 'resolve_follow_up',
      label: 'Resolve Follow-up',
      description: 'Validate the live turn and resources before attacks/movement, or reconcile source and duration cleanup.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: application => {
    if (application.controlId === 'target_case') {
      return setTargetCase(application, String(application.value) as TauntTargetCase);
    }
    if (application.controlId === 'attempt_taunt' && application.value === true) {
      return applyTaunt(application);
    }
    if (application.controlId === 'follow_up_case') {
      return setFollowUp(application, String(application.value) as TauntFollowUpCase);
    }
    if (application.controlId === 'resolve_follow_up' && application.value === true) {
      return resolveFollowUp(application);
    }

    return { logMessage: '' };
  },
};

export default tauntForcedTargetingScenarioControls;
