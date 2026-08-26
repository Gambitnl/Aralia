// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 15:36:02
 * Dependents: components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the deterministic Area of Effect Tactical Sandbox fixture.
 *
 * Select controls author canonical Fireball or Burning Hands geometry, exact
 * boundary positions, blocker placement, and deterministic target defenses.
 * Action controls submit that live board to the shared atomic area-spell
 * resolver, then expose membership, saves, damage, HP, Action, slot, and event
 * identity through actor names, highlighted cells, and the combat log in 2D/3D.
 *
 * Called by: the Tactical Sandbox scenario-control registry and mounted host.
 * Depends on: canonical spell JSON, the production AoE transaction, action
 * economy reset, and the shared scenario-control contract.
 */

import burningHandsData from '@/data/spells/level-1/burning-hands.json';
import fireballData from '@/data/spells/level-3/fireball.json';
import type { SpellSlots } from '../../../../types';
import type {
  BattleMapData,
  CombatCharacter,
  Position,
  StatusEffect,
} from '../../../../types/combat';
import type { Spell } from '../../../../types/spells';
import {
  createAreaDamageSpellCastAction,
  resolveAreaDamageSpellCast,
  type AreaDamageSpellCastRejectionReason,
  type AreaDamageSpellCastResolution,
} from '../../../../systems/spells/mechanics/areaDamageSpellCastResolution';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import { calculateAffectedTiles } from '../../../../utils/combat/aoeCalculations';
import { resolveAoEParams } from '../../../../utils/spatial/targetingUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlValues,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Canonical Spells, Identities, And Controlled Choices
// ============================================================================
// Stable ids let Reset restore only CS08 actors. The case selector combines
// related placement facts so testers can inspect each complete, named proof
// without coordinating several switches into an invalid intermediate board.
// ============================================================================

const FIREBALL = fireballData as Spell;
const BURNING_HANDS = burningHandsData as Spell;
const CASTER_ID = 'area_effect-tester';
const CENTER_ID = 'area_effect-target';
const BOUNDARY_ID = 'area-effect-boundary-target';
const OUTSIDE_ID = 'area-effect-outside-target';
const FRIENDLY_ID = 'area-effect-friendly-witness';
const EVENT_MARKER_PREFIX = 'area-effect-event:';
const AREA_TILE_EFFECT = 'area_effect';

const CASTER_POSITION: Position = { x: 3, y: 5 };
const FIREBALL_ORIGIN: Position = { x: 8, y: 5 };
const OFF_MAP_ORIGIN: Position = { x: 99, y: 99 };
const FIXED_DAMAGE_FACE = 4;
const SCENARIO_BLOCKER_KEYS = new Set(['6-5', '10-5']);

type AreaCase =
  | 'fireball_boundary'
  | 'fireball_clustered'
  | 'fireball_large_boundary'
  | 'cone_east'
  | 'cone_north'
  | 'placement_blocked'
  | 'internal_blocker'
  | 'invalid_off_map';

type OutcomeCase =
  | 'mixed_saves'
  | 'all_fail'
  | 'all_succeed'
  | 'resistant_boundary'
  | 'immune_boundary'
  | 'temporary_hp'
  | 'lethal_friendly';

interface AuthoredCase {
  spell: Spell;
  placement: Position;
  facing: CombatCharacter['facing'];
  positions: Record<typeof CENTER_ID | typeof BOUNDARY_ID | typeof OUTSIDE_ID | typeof FRIENDLY_ID, Position>;
  blocker?: { position: Position; kind: 'placement' | 'internal' };
  largeBoundary?: boolean;
}

const DEFAULT_VALUES: PreviewCombatScenarioControlValues = {
  'area-case': 'fireball_boundary',
  'outcome-case': 'mixed_saves',
  'resolve-area': false,
  'replay-area-event': false,
  'reset-area-board': false,
};

// ============================================================================
// Exact Shape, Origin, Orientation, And Boundary Fixtures
// ============================================================================
// Fireball's fourth Chebyshev cell is included and the fifth is excluded.
// Burning Hands' third forward cell is included and the fourth is excluded.
// The internal wall deliberately sits beyond Fireball's chosen origin because
// current rules require sight to placement but do not propagate cover outward.
// ============================================================================

function authoredCase(caseId: AreaCase): AuthoredCase {
  const fireballPositions: AuthoredCase['positions'] = {
    [CENTER_ID]: { x: 8, y: 5 },
    [BOUNDARY_ID]: { x: 12, y: 5 },
    [OUTSIDE_ID]: { x: 13, y: 5 },
    [FRIENDLY_ID]: { x: 8, y: 9 },
  };

  if (caseId === 'fireball_clustered') {
    return {
      spell: FIREBALL,
      placement: FIREBALL_ORIGIN,
      facing: 'east',
      positions: {
        [CENTER_ID]: { x: 8, y: 5 },
        [BOUNDARY_ID]: { x: 9, y: 5 },
        [OUTSIDE_ID]: { x: 9, y: 6 },
        [FRIENDLY_ID]: { x: 8, y: 7 },
      },
    };
  }

  if (caseId === 'fireball_large_boundary') {
    return {
      spell: FIREBALL,
      placement: FIREBALL_ORIGIN,
      facing: 'east',
      positions: { ...fireballPositions, [BOUNDARY_ID]: { x: 11, y: 4 } },
      largeBoundary: true,
    };
  }

  if (caseId === 'cone_east' || caseId === 'cone_north') {
    const north = caseId === 'cone_north';
    return {
      spell: BURNING_HANDS,
      placement: CASTER_POSITION,
      facing: north ? 'north' : 'east',
      positions: north
        ? {
            [CENTER_ID]: { x: 3, y: 4 },
            [BOUNDARY_ID]: { x: 3, y: 2 },
            [OUTSIDE_ID]: { x: 3, y: 1 },
            [FRIENDLY_ID]: { x: 3, y: 3 },
          }
        : {
            [CENTER_ID]: { x: 4, y: 5 },
            [BOUNDARY_ID]: { x: 6, y: 5 },
            [OUTSIDE_ID]: { x: 7, y: 5 },
            [FRIENDLY_ID]: { x: 5, y: 5 },
          },
    };
  }

  if (caseId === 'placement_blocked') {
    return {
      spell: FIREBALL,
      placement: FIREBALL_ORIGIN,
      facing: 'east',
      positions: fireballPositions,
      blocker: { position: { x: 6, y: 5 }, kind: 'placement' },
    };
  }

  if (caseId === 'internal_blocker') {
    return {
      spell: FIREBALL,
      placement: FIREBALL_ORIGIN,
      facing: 'east',
      positions: fireballPositions,
      blocker: { position: { x: 10, y: 5 }, kind: 'internal' },
    };
  }

  if (caseId === 'invalid_off_map') {
    return {
      spell: FIREBALL,
      placement: OFF_MAP_ORIGIN,
      facing: 'east',
      positions: fireballPositions,
    };
  }

  return {
    spell: FIREBALL,
    placement: FIREBALL_ORIGIN,
    facing: 'east',
    positions: fireballPositions,
  };
}

function readChoices(values?: PreviewCombatScenarioControlValues): {
  areaCase: AreaCase;
  outcomeCase: OutcomeCase;
} {
  return {
    areaCase: String(values?.['area-case'] ?? DEFAULT_VALUES['area-case']) as AreaCase,
    outcomeCase: String(values?.['outcome-case'] ?? DEFAULT_VALUES['outcome-case']) as OutcomeCase,
  };
}

// ============================================================================
// Authored Actors, Defenses, And Exact Reset
// ============================================================================
// Every selection rebuilds the controlled facts from the generic caster/target
// anchors. Reset uses these same defaults, clears event markers and damage, and
// requests turn reinitialization so Action and slot state cannot leak forward.
// ============================================================================

function cloneTarget(
  source: CombatCharacter,
  id: string,
  team: CombatCharacter['team'],
): CombatCharacter {
  return {
    ...source,
    id,
    name: id,
    team,
    abilities: [],
    actionEconomy: {
      ...source.actionEconomy,
      action: { ...source.actionEconomy.action },
      bonusAction: { ...source.actionEconomy.bonusAction },
      reaction: { ...source.actionEconomy.reaction },
      legendary: { ...source.actionEconomy.legendary },
      movement: { ...source.actionEconomy.movement },
    },
  };
}

function targetLabel(
  label: string,
  target: CombatCharacter,
  membership: 'inside' | 'boundary' | 'outside',
): string {
  const defense = target.immunities.includes('Fire')
    ? 'immune'
    : target.resistances.includes('Fire')
      ? 'resistant'
      : target.tempHP
        ? `${target.tempHP} temp HP`
        : 'no defense';
  return `${label} · ${membership} · ${target.currentHP}/${target.maxHP} HP · ${defense}`;
}

function prepareCharacters(
  characters: CombatCharacter[],
  areaCase: AreaCase,
  outcomeCase: OutcomeCase,
): CombatCharacter[] | null {
  const incomingCaster = characters.find(character => character.id === CASTER_ID);
  const incomingCenter = characters.find(character => character.id === CENTER_ID);
  if (!incomingCaster || !incomingCenter) return null;

  const spec = authoredCase(areaCase);
  const byId = new Map(characters.map(character => [character.id, character]));
  for (const [id, team] of [
    [BOUNDARY_ID, 'enemy'],
    [OUTSIDE_ID, 'enemy'],
    [FRIENDLY_ID, 'player'],
  ] as const) {
    if (!byId.has(id)) byId.set(id, cloneTarget(incomingCenter, id, team));
  }

  const casterSlots: SpellSlots = {
    level_1: { current: 1, max: 1 },
    level_3: { current: 1, max: 1 },
  };
  const preparedCaster = resetEconomy({
    ...incomingCaster,
    name: `${spec.spell.name} Caster · Action ready · L${spec.spell.level} 1/1 · event open`,
    team: 'player',
    level: 7,
    position: { ...CASTER_POSITION },
    facing: spec.facing,
    spellcastingAbility: 'intelligence',
    stats: { ...incomingCaster.stats, intelligence: 18 },
    spellSlots: casterSlots,
    abilities: [],
    statusEffects: incomingCaster.statusEffects.filter(effect => !effect.id.startsWith(EVENT_MARKER_PREFIX)),
    activeEffects: [],
    conditions: [],
  });
  const action = createAreaDamageSpellCastAction(spec.spell, preparedCaster, spec.spell.level);
  byId.set(CASTER_ID, { ...preparedCaster, abilities: [action.ability] });

  const ids = [CENTER_ID, BOUNDARY_ID, OUTSIDE_ID, FRIENDLY_ID] as const;
  for (const id of ids) {
    const source = byId.get(id)!;
    const isFriendly = id === FRIENDLY_ID;
    const maxHP = 60;
    const lethal = outcomeCase === 'lethal_friendly' && isFriendly;
    const hasTempHP = outcomeCase === 'temporary_hp' && id === BOUNDARY_ID;
    const target: CombatCharacter = {
      ...source,
      team: isFriendly ? 'player' : 'enemy',
      position: { ...spec.positions[id] },
      currentHP: lethal ? 15 : maxHP,
      maxHP,
      tempHP: hasTempHP || lethal ? 10 : 0,
      damagedThisTurn: false,
      deathSaves: undefined,
      stats: {
        ...source.stats,
        dexterity: 8,
        size: id === BOUNDARY_ID && spec.largeBoundary ? 'Large' : 'Medium',
        saveBonuses: undefined,
      },
      savingThrowProficiencies: [],
      resistances: outcomeCase === 'resistant_boundary' && id === BOUNDARY_ID ? ['Fire'] : [],
      immunities: outcomeCase === 'immune_boundary' && id === BOUNDARY_ID ? ['Fire'] : [],
      vulnerabilities: [],
      abilities: [],
      statusEffects: [],
      activeEffects: [],
      conditions: [],
      riders: [],
    };
    const membership = id === OUTSIDE_ID ? 'outside' : id === BOUNDARY_ID ? 'boundary' : 'inside';
    const label = id === CENTER_ID
      ? 'Center Target'
      : id === BOUNDARY_ID
        ? spec.largeBoundary ? 'Large Boundary Target' : 'Boundary Target'
        : id === OUTSIDE_ID
          ? 'Excluded Target'
          : 'Friendly Witness';
    byId.set(id, { ...target, name: targetLabel(label, target, membership) });
  }

  const controlledIds = new Set([CASTER_ID, CENTER_ID, BOUNDARY_ID, OUTSIDE_ID, FRIENDLY_ID]);
  return [
    ...characters.map(character => byId.get(character.id) ?? character),
    ...[BOUNDARY_ID, OUTSIDE_ID, FRIENDLY_ID]
      .filter(id => !characters.some(character => character.id === id))
      .map(id => byId.get(id)!),
  ].filter((character, index, roster) => (
    !controlledIds.has(character.id)
    || roster.findIndex(candidate => candidate.id === character.id) === index
  ));
}

// ============================================================================
// Visible Map Template And Blocker Facts
// ============================================================================
// Highlight cells come from the same production geometry translator/calculator
// as resolution. The marker is presentation only; membership is recalculated by
// the transaction. Existing unrelated tile effects are preserved exactly.
// ============================================================================

function prepareMap(
  mapData: BattleMapData | null,
  caster: CombatCharacter,
  areaCase: AreaCase,
): BattleMapData | undefined {
  if (!mapData) return undefined;
  const spec = authoredCase(areaCase);
  const ability = createAreaDamageSpellCastAction(spec.spell, caster, spec.spell.level).ability;
  const geometry = ability.areaOfEffect
    ? resolveAoEParams(ability.areaOfEffect, spec.placement, caster, ability.name)
    : null;
  const affectedKeys = new Set(
    geometry && spec.placement !== OFF_MAP_ORIGIN
      ? calculateAffectedTiles(geometry).map(position => `${position.x}-${position.y}`)
      : [],
  );
  const blockerKey = spec.blocker
    ? `${spec.blocker.position.x}-${spec.blocker.position.y}`
    : null;
  const tiles = new Map(mapData.tiles);

  for (const [key, tile] of tiles) {
    const effects = tile.effects.filter(effect => effect !== AREA_TILE_EFFECT);
    if (affectedKeys.has(key)) effects.push(AREA_TILE_EFFECT);
    tiles.set(key, {
      ...tile,
      effects,
      // Both controlled blocker cells are authored open in the CS08 board.
      // Clear the previous selection before applying the current one so Reset
      // cannot retain a wall introduced by an earlier proof case.
      blocksLoS: key === blockerKey ? true : SCENARIO_BLOCKER_KEYS.has(key) ? false : tile.blocksLoS,
      blocksMovement: key === blockerKey ? true : SCENARIO_BLOCKER_KEYS.has(key) ? false : tile.blocksMovement,
    });
  }
  return { ...mapData, tiles };
}

function prepareBoard(
  application: PreviewCombatScenarioControlApplication,
  values: PreviewCombatScenarioControlValues,
): PreviewCombatScenarioControlPatch {
  const { areaCase, outcomeCase } = readChoices(values);
  const characters = prepareCharacters(application.snapshot.characters, areaCase, outcomeCase);
  if (!characters) {
    return { logMessage: 'Area of Effect fixture is unavailable because its caster or center target is missing.' };
  }
  const caster = characters.find(character => character.id === CASTER_ID)!;
  const mapData = prepareMap(application.snapshot.mapData, caster, areaCase);
  const spec = authoredCase(areaCase);
  return {
    characters,
    ...(mapData ? { mapData } : {}),
    reinitializeCombat: true,
    logMessage: `CS08 prepared ${spec.spell.name}: ${areaCase}; ${outcomeCase}. Origin ${spec.placement.x},${spec.placement.y}; facing ${spec.facing}. Action and L${spec.spell.level} slot reset; event open.`,
  };
}

// ============================================================================
// Deterministic Save Outcomes And Event Receipts
// ============================================================================
// Dice still flow through production parsers. Fixed faces only make the proof
// repeatable: mixed mode gives the boundary a successful save and all other
// included creatures a failed save; alternate modes force one clear branch.
// ============================================================================

function fixedDie(face: number, sides: number): number {
  return (face - 0.5) / sides;
}

function saveFace(outcomeCase: OutcomeCase, target: CombatCharacter): number {
  if (outcomeCase === 'all_succeed') return 18;
  if (outcomeCase === 'all_fail') return 5;
  return target.id === BOUNDARY_ID ? 18 : 5;
}

function eventId(areaCase: AreaCase, outcomeCase: OutcomeCase): string {
  return `cs08:${areaCase}:${outcomeCase}`;
}

function readProcessedEvents(caster: CombatCharacter): Set<string> {
  return new Set(caster.statusEffects
    .filter(effect => effect.id.startsWith(EVENT_MARKER_PREFIX))
    .map(effect => effect.id.slice(EVENT_MARKER_PREFIX.length)));
}

function eventMarker(id: string): StatusEffect {
  return {
    id: `${EVENT_MARKER_PREFIX}${id}`,
    name: 'AoE event claimed',
    type: 'neutral',
    duration: 999,
    effect: { type: 'stat_modifier', value: 0 },
  };
}

function rejectionExplanation(reason: AreaDamageSpellCastRejectionReason): string {
  const explanations: Record<AreaDamageSpellCastRejectionReason, string> = {
    invalid_event_id: 'the stable execution id is blank',
    replayed_event: 'the stable execution id was already claimed',
    missing_actor: 'the caster or map is unavailable',
    invalid_slot_level: 'the slot level is not an integer from 0 to 9',
    below_base_slot: 'the selected slot is below the spell level',
    cantrip_slot_forbidden: 'a cantrip cannot spend a numbered slot',
    spell_not_eligible: 'the live caster does not own the canonical spell ability',
    off_turn: 'the live turn belongs to another actor',
    unsupported_damage_spell: 'the spell lacks one immediate save-damage effect',
    unsupported_area_shape: 'the canonical area shape is unsupported',
    action_unavailable: 'the caster Action is already spent',
    slot_unavailable: 'the exact spell slot is empty',
    no_eligible_targets: 'no creature footprint intersects the area',
    'invalid_placement:off_map': 'the chosen origin is not a map cell',
    'invalid_placement:out_of_range': 'the chosen origin is beyond canonical range',
    'invalid_placement:line_of_sight_blocked': 'a wall blocks sight to the chosen origin',
    'invalid_placement:self_origin_required': 'the self-origin spell must begin on the caster',
  };
  return explanations[reason];
}

function decorateResolvedCharacters(
  result: AreaDamageSpellCastResolution,
  spell: Spell,
  event: string,
): CombatCharacter[] {
  const membership = new Set(result.includedTargetIds);
  const targetById = new Map(result.targetResults.map(target => [target.targetId, target]));
  return result.characters.map(character => {
    if (character.id === CASTER_ID) {
      const key = `level_${spell.level}` as keyof SpellSlots;
      const slots = character.spellSlots?.[key];
      return {
        ...character,
        name: `${spell.name} Caster · Action spent · L${spell.level} ${slots?.current ?? 0}/${slots?.max ?? 0} · event claimed`,
        statusEffects: [...character.statusEffects, eventMarker(event)],
      };
    }
    const target = targetById.get(character.id);
    const zone = membership.has(character.id) ? 'INCLUDED' : 'EXCLUDED';
    const outcome = target
      ? `${target.saveSucceeded ? 'save' : 'fail'} · ${target.finalDamage} damage`
      : 'no resolution';
    return {
      ...character,
      name: `${character.name.split(' · ')[0]} · ${zone} · ${outcome} · ${character.currentHP}/${character.maxHP} HP`,
    };
  });
}

function formatResolution(result: AreaDamageSpellCastResolution, spell: Spell): string {
  const targetFacts = result.targetResults.map(target => (
    `${target.targetId} ${target.saveSucceeded ? 'SAVE' : 'FAIL'} ${target.saveTotal}/${target.saveDC}, ${target.finalDamage} damage, HP ${target.hpBefore}→${target.hpAfter}, temp ${target.tempHPBefore}→${target.tempHPAfter}${target.downed ? ', DOWNED/Unconscious' : ''}`
  )).join('; ');
  return `${spell.name} RESOLVED ${result.geometry?.shape} origin ${result.geometry?.origin.x},${result.geometry?.origin.y} direction ${result.geometry?.direction ?? 0} size ${result.geometry?.size}ft. ${result.affectedTiles.length} cells; included [${result.includedTargetIds.join(', ')}]; excluded [${result.excludedTargetIds.join(', ')}]. ${result.baseFormula}=${result.rolledDamage} Fire. ${targetFacts}. Action spent; L${spell.level} slot spent once; event claimed.`;
}

function resolveBoard(
  application: PreviewCombatScenarioControlApplication,
  requirePriorEvent: boolean,
): PreviewCombatScenarioControlPatch {
  const { areaCase, outcomeCase } = readChoices(application.snapshot.controlValues);
  const spec = authoredCase(areaCase);
  const caster = application.snapshot.characters.find(character => character.id === CASTER_ID);
  if (!caster || !application.snapshot.turnState) {
    return { logMessage: 'REJECTED (missing_actor): caster or turn state unavailable. No roll, damage, Action, or slot spent.' };
  }
  const stableEvent = eventId(areaCase, outcomeCase);
  const processedEventIds = readProcessedEvents(caster);
  if (requirePriorEvent && !processedEventIds.has(stableEvent)) {
    return { logMessage: 'REJECTED (no_prior_event): resolve this exact controlled case before replay. No roll, damage, Action, or slot spent.' };
  }
  const result = resolveAreaDamageSpellCast({
    characters: application.snapshot.characters,
    mapData: application.snapshot.mapData,
    turnState: application.snapshot.turnState,
    casterId: CASTER_ID,
    placement: spec.placement,
    action: createAreaDamageSpellCastAction(spec.spell, caster, spec.spell.level),
    executionEventId: stableEvent,
    processedEventIds,
    spellZones: application.snapshot.spellZones,
    damageRng: () => fixedDie(FIXED_DAMAGE_FACE, 6),
    saveRng: target => fixedDie(saveFace(outcomeCase, target), 20),
  });

  if (result.status === 'rejected') {
    return {
      logMessage: `REJECTED (${result.reason}): ${rejectionExplanation(result.reason)}. No roll, damage, condition, Action, slot, or event claim changed.`,
    };
  }
  return {
    characters: decorateResolvedCharacters(result, spec.spell, stableEvent),
    logMessage: formatResolution(result, spec.spell),
  };
}

// ============================================================================
// Shared Control Routing And Registration
// ============================================================================
// Changing a select authors that complete fixture. Resolve commits once, Replay
// redelivers the identical event id, and Reset restores the exact two defaults.
// False action values are host initialization, not gameplay attempts.
// ============================================================================

function applyAreaEffectControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.controlId === 'area-case' || application.controlId === 'outcome-case') {
    if (typeof application.value !== 'string') {
      return { logMessage: `Area of Effect control ${application.controlId} requires a listed choice.` };
    }
    return prepareBoard(application, {
      ...application.snapshot.controlValues,
      [application.controlId]: application.value,
    });
  }
  if (application.value === false) return { logMessage: '' };
  if (application.value !== true) {
    return { logMessage: `Area of Effect control ${application.controlId} requires an action trigger.` };
  }
  if (application.controlId === 'resolve-area') return resolveBoard(application, false);
  if (application.controlId === 'replay-area-event') return resolveBoard(application, true);
  if (application.controlId === 'reset-area-board') {
    return prepareBoard(application, DEFAULT_VALUES);
  }
  return { logMessage: `Area of Effect ignored unknown control ${application.controlId}.` };
}

const areaEffectScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'area_effect',
  controls: [
    {
      id: 'area-case',
      label: 'Shape, aim, and targets',
      description: 'Choose canonical sphere/cone geometry, exact boundary layouts, blockers, or invalid placement.',
      kind: 'select',
      defaultValue: DEFAULT_VALUES['area-case'],
      options: [
        { value: 'fireball_boundary', label: 'Fireball boundary in/out' },
        { value: 'fireball_clustered', label: 'Fireball clustered targets' },
        { value: 'fireball_large_boundary', label: 'Large boundary target once' },
        { value: 'cone_east', label: 'Burning Hands east' },
        { value: 'cone_north', label: 'Burning Hands north' },
        { value: 'placement_blocked', label: 'Fireball origin blocked' },
        { value: 'internal_blocker', label: 'Internal wall (no propagation)' },
        { value: 'invalid_off_map', label: 'Invalid off-map origin' },
      ],
    },
    {
      id: 'outcome-case',
      label: 'Saves and defenses',
      description: 'Choose deterministic success/failure, Fire defenses, temporary HP, or downing.',
      kind: 'select',
      defaultValue: DEFAULT_VALUES['outcome-case'],
      options: [
        { value: 'mixed_saves', label: 'Mixed saves (boundary succeeds)' },
        { value: 'all_fail', label: 'All saves fail' },
        { value: 'all_succeed', label: 'All saves succeed' },
        { value: 'resistant_boundary', label: 'Boundary has Fire resistance' },
        { value: 'immune_boundary', label: 'Boundary has Fire immunity' },
        { value: 'temporary_hp', label: 'Boundary has 10 temp HP' },
        { value: 'lethal_friendly', label: 'Friendly witness downing' },
      ],
    },
    {
      id: 'resolve-area',
      label: 'Resolve canonical area',
      description: 'Validate placement and commit one shared damage roll, one save per included creature, and one payment.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'replay-area-event',
      label: 'Replay same event ID',
      description: 'Redeliver the claimed event to prove an atomic no-op.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'reset-area-board',
      label: 'Reset exact CS08 board',
      description: 'Restore default sphere boundary facts, HP, defenses, Action, slot, template, and event epoch.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyAreaEffectControl,
};

// The registry consumes one pure default export. Scenario state always enters
// through the shared snapshot and leaves through an explicit patch.
export default areaEffectScenarioControls;
