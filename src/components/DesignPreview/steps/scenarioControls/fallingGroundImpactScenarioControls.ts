// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 07:10:50
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the deterministic Falling & Ground Impact sandbox board.
 *
 * Selectors author one deterministic in-flight event, while the action buttons
 * submit the live roster to the production fall transaction. That shared path
 * owns placement, Feather Fall choice/payment, defenses, temporary HP, HP,
 * death state, landing, Prone, and replay protection. The Tactical Sandbox host
 * only decorates the returned facts for readable 2D and 3D proof.
 *
 * Called by: PreviewCombatScenarios and the scenario-control registry.
 * Depends on: the production falling-ground-impact transaction and shared map.
 */

import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  LightSource,
  Position,
} from '../../../../types/combat';
import type { SpellSlots } from '../../../../types/character';
import {
  resolveFallingGroundImpact,
  type FallingGroundImpactResult,
} from '../../../../systems/combat/fallingGroundImpactResolution';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Authored Board Facts
// ============================================================================
// Elevation values use the battle map's renderer encoding. Thirty units display
// as a rounded thirty-foot cliff and twenty-five units as its safe terrace.
// Every destination is stable so tests and screenshots can name exact tiles.
// ============================================================================

export const FALLING_GROUND_IMPACT_FALLER_ID = 'falling_ground_impact-faller';
export const FALLING_GROUND_IMPACT_BLOCKER_ID = 'falling_ground_impact-blocker';
export const FALLING_GROUND_IMPACT_CASTER_ID = 'falling_ground_impact-feather-caster';

export const FALLING_GROUND_IMPACT_SOURCE = { x: 4, y: 5 } as const;
export const FALLING_GROUND_IMPACT_SAFE_LANDING = { x: 6, y: 5 } as const;
export const FALLING_GROUND_IMPACT_DAMAGE_LANDING = { x: 8, y: 5 } as const;
export const FALLING_GROUND_IMPACT_OCCUPIED_LANDING = { x: 10, y: 5 } as const;
export const FALLING_GROUND_IMPACT_BLOCKED_LANDING = { x: 11, y: 7 } as const;
export const FALLING_GROUND_IMPACT_OFF_BOARD_LANDING = { x: 16, y: 5 } as const;
// The owner stands on the ledge beside the faller. From the valley floor the
// platform's crest correctly blocks sight under the elevation-aware LOS rule.
export const FALLING_GROUND_IMPACT_CASTER_START = { x: 3, y: 5 } as const;

export const FALLING_GROUND_IMPACT_MAX_HP = 40;
export const FALLING_GROUND_IMPACT_SOURCE_FEET = 30;
export const FALLING_GROUND_IMPACT_SAFE_DISTANCE_FEET = 5;
export const FALLING_GROUND_IMPACT_DAMAGE_DISTANCE_FEET = 30;
export const FALLING_GROUND_IMPACT_DAMAGE_TOTAL = 12;
export const FALLING_GROUND_IMPACT_CAP_DISTANCE_FEET = 200;
export const FALLING_GROUND_IMPACT_CAP_DAMAGE_TOTAL = 79;

const SOURCE_ELEVATION = 30;
const SAFE_TERRACE_ELEVATION = 25;
const GROUND_ELEVATION = 0;
const FALL_EVENT_ID = 'falling-ground-impact-event';
const FALL_CASE_CONTROL_ID = 'fall-case';
const FEATHER_FALL_CASE_CONTROL_ID = 'feather-fall-case';
const SOURCE_CUE_ID = 'falling-ground-impact-source-cue';
const LANDING_CUE_ID = 'falling-ground-impact-landing-cue';
const FIXED_DAMAGE_FACES = [3, 4, 5] as const;

type FallCase = 'short' | 'damaging' | 'cap_200' | 'resistance' | 'immunity'
  | 'temporary_hp' | 'downing' | 'occupied' | 'blocked' | 'off_board';
type FeatherFallCase = 'accept' | 'decline' | 'unowned' | 'spent_reaction'
  | 'empty_slot' | 'not_selected';

/**
 * Creates the complete spell-slot record required by the combat character
 * contract. Only the first-level vial is charged in this scenario; explicitly
 * empty higher levels keep Reset deterministic and avoid inheriting host data.
 */
function createFeatherFallSpellSlots(levelOneCurrent = 1): SpellSlots {
  return {
    level_1: { current: levelOneCurrent, max: 1 },
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

// ============================================================================
// Board Preparation
// ============================================================================
// Reset always starts with one creature visibly standing on the cliff, a safe
// five-foot terrace, a damaging ground landing, an occupied landing, a wall,
// and a board-edge rejection. These are real map and character facts.
// ============================================================================

function updateTile(
  mapData: BattleMapData,
  position: Position,
  patch: Partial<BattleMapTile>,
): BattleMapData {
  const tileId = `${position.x}-${position.y}`;
  const tile = mapData.tiles.get(tileId);

  // A missing authored tile is left missing. The landing validator will then
  // report the map boundary instead of this visual helper creating new ground.
  if (!tile) return mapData;

  const tiles = new Map(mapData.tiles);
  tiles.set(tileId, { ...tile, ...patch });
  return { ...mapData, tiles };
}

export function prepareFallingGroundImpactMapData(
  mapData: BattleMapData,
): BattleMapData {
  let prepared = mapData;

  // The three-by-three high pad gives the 3D terrain enough neighboring height
  // to read as a platform instead of a single sharp vertex.
  mapData.tiles.forEach(tile => {
    const onHighPlatform = tile.coordinates.x >= 3
      && tile.coordinates.x <= 5
      && tile.coordinates.y >= 4
      && tile.coordinates.y <= 6;
    const onSafeTerrace = tile.coordinates.x === 6
      && tile.coordinates.y >= 4
      && tile.coordinates.y <= 6;

    if (onHighPlatform) {
      prepared = updateTile(prepared, tile.coordinates, {
        terrain: 'rock',
        elevation: SOURCE_ELEVATION,
        movementCost: 5,
        blocksMovement: false,
        blocksLoS: false,
        decoration: null,
        effects: ['fall-source-30-ft'],
      });
    } else if (onSafeTerrace) {
      prepared = updateTile(prepared, tile.coordinates, {
        terrain: 'sand',
        elevation: SAFE_TERRACE_ELEVATION,
        movementCost: 5,
        blocksMovement: false,
        blocksLoS: false,
        decoration: null,
        effects: ['safe-landing-5-ft'],
      });
    }
  });

  // The legal damaging landing is ordinary ground with a persistent impact
  // marker. A result adds a brighter cue without changing its walkability.
  prepared = updateTile(prepared, FALLING_GROUND_IMPACT_DAMAGE_LANDING, {
    terrain: 'floor',
    elevation: GROUND_ELEVATION,
    movementCost: 5,
    blocksMovement: false,
    blocksLoS: false,
    decoration: null,
    effects: ['damage-landing-30-ft'],
  });

  // This wall is a real blocked tile. It is kept away from the occupied actor
  // so each rejection has one unambiguous canonical reason.
  prepared = updateTile(prepared, FALLING_GROUND_IMPACT_BLOCKED_LANDING, {
    terrain: 'wall',
    elevation: GROUND_ELEVATION,
    movementCost: 5,
    blocksMovement: true,
    blocksLoS: true,
    decoration: null,
    effects: ['blocked-landing'],
  });

  // The occupied square stays passable; only the living blocker makes it an
  // illegal destination. That distinction is visible in the rejection log.
  prepared = updateTile(prepared, FALLING_GROUND_IMPACT_OCCUPIED_LANDING, {
    terrain: 'grass',
    elevation: GROUND_ELEVATION,
    movementCost: 5,
    blocksMovement: false,
    blocksLoS: false,
    decoration: null,
    effects: ['occupied-landing'],
  });

  return prepared;
}

function setSourcePlatformElevation(
  mapData: BattleMapData,
  sourceElevationFeet: number,
): BattleMapData {
  let prepared = mapData;

  // The cap demonstration raises the same complete platform instead of one
  // vertex, preserving the readable 3D silhouette and source footprint.
  mapData.tiles.forEach(tile => {
    const onHighPlatform = tile.coordinates.x >= 3
      && tile.coordinates.x <= 5
      && tile.coordinates.y >= 4
      && tile.coordinates.y <= 6;
    if (onHighPlatform) {
      prepared = updateTile(prepared, tile.coordinates, {
        elevation: sourceElevationFeet,
        effects: [`fall-source-${sourceElevationFeet}-ft`],
      });
    }
  });

  return prepared;
}

function removeFallingProne(character: CombatCharacter): CombatCharacter {
  return {
    ...character,
    statusEffects: character.statusEffects.filter(effect => (
      effect.id !== 'falling-ground-impact-prone' && effect.name !== 'Prone'
    )),
    conditions: character.conditions?.filter(condition => condition.name !== 'Prone'),
  };
}

export function prepareFallingGroundImpactCharacters(
  characters: CombatCharacter[],
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === FALLING_GROUND_IMPACT_FALLER_ID) {
      const standing = removeFallingProne(character);
      return {
        ...standing,
        name: 'Cliff Runner | FALLING | source 30 ft | 40/40 HP | Standing',
        position: { ...FALLING_GROUND_IMPACT_SOURCE },
        team: 'player',
        currentHP: FALLING_GROUND_IMPACT_MAX_HP,
        maxHP: FALLING_GROUND_IMPACT_MAX_HP,
        tempHP: 0,
        damagedThisTurn: false,
        fallingState: {
          eventId: FALL_EVENT_ID,
          isFalling: true,
          sourcePosition: { ...FALLING_GROUND_IMPACT_SOURCE },
          sourceElevationFeet: FALLING_GROUND_IMPACT_SOURCE_FEET,
          fallDistanceFeet: FALLING_GROUND_IMPACT_DAMAGE_DISTANCE_FEET,
        },
      };
    }

    if (character.id === FALLING_GROUND_IMPACT_CASTER_ID) {
      return {
        ...character,
        name: 'Aerie Mage | Feather Fall owner | Reaction ready | L1 1/1',
        position: { ...FALLING_GROUND_IMPACT_CASTER_START },
        team: 'player',
        spellbook: {
          knownSpells: ['feather-fall'],
          preparedSpells: [],
          cantrips: [],
        },
        spellSlots: createFeatherFallSpellSlots(),
        actionEconomy: {
          ...character.actionEconomy,
          reaction: { ...character.actionEconomy.reaction, used: false, remaining: 1 },
        },
      };
    }

    if (character.id === FALLING_GROUND_IMPACT_BLOCKER_ID) {
      return {
        ...character,
        name: 'Landing Guard · occupies 10,5 · 40/40 HP',
        position: { ...FALLING_GROUND_IMPACT_OCCUPIED_LANDING },
        team: 'enemy',
        currentHP: FALLING_GROUND_IMPACT_MAX_HP,
        maxHP: FALLING_GROUND_IMPACT_MAX_HP,
        stats: { ...character.stats, size: 'Medium' },
      };
    }

    return character;
  });
}

// ============================================================================
// Canonical Fall Resolution
// ============================================================================
// Every legal fall measures the rendered source and landing heights, validates
// exact placement, derives dice, rolls fixed faces through shared dice logic,
// and updates the same character record consumed by the combat renderers.
// ============================================================================

function createDamageRandomSource(): () => number {
  let index = 0;

  // The three-face cycle gives 3d6 = 12 and 20d6 = 79. Cycling preserves a
  // visible exact roll at the cap without adding a second damage formula.
  return () => {
    const face = FIXED_DAMAGE_FACES[index % FIXED_DAMAGE_FACES.length];
    index += 1;
    return (face - 0.5) / 6;
  };
}

function scenarioCueLights(
  destination: Position,
  damaging: boolean,
): LightSource[] {
  return [
    {
      id: SOURCE_CUE_ID,
      casterId: FALLING_GROUND_IMPACT_FALLER_ID,
      sourceSpellId: 'falling-ground-impact-source-cue',
      brightRadius: 5,
      dimRadius: 5,
      attachedTo: 'point',
      position: { ...FALLING_GROUND_IMPACT_SOURCE },
      color: '#fbbf24',
      createdTurn: 0,
    },
    {
      id: LANDING_CUE_ID,
      casterId: FALLING_GROUND_IMPACT_FALLER_ID,
      sourceSpellId: 'falling-ground-impact-landing-cue',
      brightRadius: 5,
      dimRadius: 5,
      attachedTo: 'point',
      position: { ...destination },
      color: damaging ? '#fb7185' : '#67e8f9',
      createdTurn: 0,
    },
  ];
}

function addResolvedImpactCue(
  mapData: BattleMapData,
  destination: Position,
  cue: string,
): BattleMapData {
  const tile = mapData.tiles.get(`${destination.x}-${destination.y}`);
  return updateTile(mapData, destination, {
    effects: [...(tile?.effects ?? []), cue],
  });
}


function findCharacter(
  characters: CombatCharacter[],
  id: string,
): CombatCharacter | undefined {
  return characters.find(character => character.id === id);
}

function replaceCharacter(
  characters: CombatCharacter[],
  replacement: CombatCharacter,
): CombatCharacter[] {
  return characters.map(character => (
    character.id === replacement.id ? replacement : character
  ));
}

function prepareFallCase(
  characters: CombatCharacter[],
  choice: FallCase,
): CombatCharacter[] {
  const faller = findCharacter(characters, FALLING_GROUND_IMPACT_FALLER_ID);

  // A completed event is never rebuilt by an action replay. Reset Board is the
  // one supported way to author a fresh fall receipt between demonstrations.
  if (!faller?.fallingState?.isFalling) return characters;

  const isCap = choice === 'cap_200';
  const distanceFeet = choice === 'short'
    ? FALLING_GROUND_IMPACT_SAFE_DISTANCE_FEET
    : isCap
      ? FALLING_GROUND_IMPACT_CAP_DISTANCE_FEET
      : FALLING_GROUND_IMPACT_DAMAGE_DISTANCE_FEET;
  const sourceElevationFeet = isCap
    ? FALLING_GROUND_IMPACT_CAP_DISTANCE_FEET
    : FALLING_GROUND_IMPACT_SOURCE_FEET;
  const currentHP = choice === 'downing'
    ? 10
    : isCap
      ? 200
      : FALLING_GROUND_IMPACT_MAX_HP;
  const maxHP = isCap ? 200 : FALLING_GROUND_IMPACT_MAX_HP;
  const preparedFaller: CombatCharacter = {
    ...removeFallingProne(faller),
    position: { ...FALLING_GROUND_IMPACT_SOURCE },
    currentHP,
    maxHP,
    tempHP: choice === 'temporary_hp' ? 5 : 0,
    damagedThisTurn: false,
    deathSaves: undefined,
    resistances: choice === 'resistance' ? ['Bludgeoning'] : [],
    immunities: choice === 'immunity' ? ['Bludgeoning'] : [],
    fallingState: {
      eventId: FALL_EVENT_ID,
      isFalling: true,
      sourcePosition: { ...FALLING_GROUND_IMPACT_SOURCE },
      sourceElevationFeet,
      fallDistanceFeet: distanceFeet,
    },
  };

  return replaceCharacter(characters, preparedFaller);
}

function landingForFallCase(choice: FallCase): Position {
  if (choice === 'short') return FALLING_GROUND_IMPACT_SAFE_LANDING;
  if (choice === 'occupied') return FALLING_GROUND_IMPACT_OCCUPIED_LANDING;
  if (choice === 'blocked') return FALLING_GROUND_IMPACT_BLOCKED_LANDING;
  if (choice === 'off_board') return FALLING_GROUND_IMPACT_OFF_BOARD_LANDING;
  return FALLING_GROUND_IMPACT_DAMAGE_LANDING;
}

function decorateResolvedCharacters(
  result: FallingGroundImpactResult,
): CombatCharacter[] {
  let characters = result.characters;
  if (result.faller) {
    const posture = result.proneApplied ? 'PRONE' : 'Standing';
    const defense = result.rawDamage !== result.defendedDamage
      ? ` | defended ${result.rawDamage} -> ${result.defendedDamage}`
      : '';
    const mitigation = result.featherFallOutcome === 'accepted'
      ? ' | Feather Fall protected'
      : '';
    characters = replaceCharacter(characters, {
      ...result.faller,
      name: `Cliff Runner | fall ${result.fallDistanceFeet} ft | ${result.damageDice}d6=${result.rawDamage}${defense} | ${result.faller.currentHP}/${result.faller.maxHP} HP | temp ${result.faller.tempHP ?? 0} | ${posture}${mitigation} | landing ${result.landingPosition?.x},${result.landingPosition?.y}`,
    });
  }

  if (result.featherFallCaster) {
    const reaction = result.featherFallCaster.actionEconomy.reaction.used ? 'Reaction spent' : 'Reaction ready';
    const slot = result.featherFallCaster.spellSlots?.level_1.current ?? 0;
    characters = replaceCharacter(characters, {
      ...result.featherFallCaster,
      name: `Aerie Mage | Feather Fall owner | ${reaction} | L1 ${slot}/1`,
    });
  }

  return characters;
}

function describeResolution(result: FallingGroundImpactResult): string {
  if (result.status !== 'resolved') {
    return `FALL ${result.status.toUpperCase()} ATOMIC NO-OP: ${result.reason} No movement, damage, Prone, Reaction, slot, temp-HP, HP, or death-state change.`;
  }

  const faller = result.faller;
  const deathState = faller?.currentHP === 0
    ? ` DOWNED: 0 HP, death saves ${faller.deathSaves?.successes ?? 0}S/${faller.deathSaves?.failures ?? 0}F, Unconscious.`
    : '';
  const reaction = result.featherFallOutcome === 'not_requested'
    ? ''
    : ` Feather Fall ${result.featherFallOutcome}: ${result.featherFallReason}`;

  return `FALL RESOLVED: source ${faller?.fallingState?.sourceElevationFeet ?? 0} ft -> landing ${result.landingPosition?.x},${result.landingPosition?.y}; distance ${result.fallDistanceFeet} ft; canonical ${result.damageDice}d6 raw ${result.rawDamage}, defended ${result.defendedDamage}; temp HP spent ${result.temporaryHitPointsSpent}; HP damage ${result.hpDamage}; ${result.proneApplied ? 'Prone applied' : 'no Prone'}.${reaction}${deathState}`;
}

function patchForResult(
  mapData: BattleMapData,
  result: FallingGroundImpactResult,
): PreviewCombatScenarioControlPatch {
  if (result.status !== 'resolved' || !result.landingPosition) {
    return {
      mapData,
      characters: result.characters,
      activeLightSources: [],
      logMessage: describeResolution(result),
    };
  }

  const resultMap = addResolvedImpactCue(
    mapData,
    result.landingPosition,
    result.proneApplied ? 'ground-impact-resolved' : 'safe-landing-resolved',
  );
  return {
    mapData: resultMap,
    characters: decorateResolvedCharacters(result),
    activeLightSources: scenarioCueLights(result.landingPosition, result.proneApplied),
    logMessage: describeResolution(result),
  };
}

function resolveFallCase(
  application: PreviewCombatScenarioControlApplication,
  choice: FallCase,
): PreviewCombatScenarioControlPatch {
  if (!application.snapshot.mapData) {
    return { logMessage: 'Fall skipped because no battle map is loaded.' };
  }

  const characters = prepareFallCase(application.snapshot.characters, choice);
  const faller = findCharacter(characters, FALLING_GROUND_IMPACT_FALLER_ID);
  const sourceElevationFeet = faller?.fallingState?.sourceElevationFeet
    ?? FALLING_GROUND_IMPACT_SOURCE_FEET;
  const mapData = setSourcePlatformElevation(
    prepareFallingGroundImpactMapData(application.snapshot.mapData),
    sourceElevationFeet,
  );
  const result = resolveFallingGroundImpact({
    eventId: FALL_EVENT_ID,
    fallerId: FALLING_GROUND_IMPACT_FALLER_ID,
    landingPosition: landingForFallCase(choice),
    mapData,
    characters,
    damageRng: createDamageRandomSource(),
  });

  return patchForResult(mapData, result);
}

// ============================================================================
// Feather Fall Choice And Payment Cases
// ============================================================================
// The selector authors one eligibility or choice fact. The action passes that
// fact to the same production transaction, which either pays once and protects
// the landing or rejects/declines without payment while gravity still resolves.
// ============================================================================

function prepareFeatherFallCase(
  characters: CombatCharacter[],
  choice: FeatherFallCase,
): CombatCharacter[] {
  const faller = findCharacter(characters, FALLING_GROUND_IMPACT_FALLER_ID);
  const caster = findCharacter(characters, FALLING_GROUND_IMPACT_CASTER_ID);
  if (!faller?.fallingState?.isFalling || !caster) return characters;

  let preparedCaster: CombatCharacter = {
    ...caster,
    spellbook: {
      knownSpells: ['feather-fall'],
      preparedSpells: [],
      cantrips: [],
    },
    spellSlots: createFeatherFallSpellSlots(choice === 'empty_slot' ? 0 : 1),
    actionEconomy: {
      ...caster.actionEconomy,
      reaction: {
        ...caster.actionEconomy.reaction,
        used: choice === 'spent_reaction',
        remaining: choice === 'spent_reaction' ? 0 : 1,
      },
    },
  };

  if (choice === 'unowned') {
    preparedCaster = {
      ...preparedCaster,
      spellbook: { knownSpells: [], preparedSpells: [], cantrips: [] },
    };
  }

  return replaceCharacter(characters, preparedCaster);
}

function resolveFeatherFallCase(
  application: PreviewCombatScenarioControlApplication,
  choice: FeatherFallCase,
): PreviewCombatScenarioControlPatch {
  if (!application.snapshot.mapData) {
    return { logMessage: 'Feather Fall skipped because no battle map is loaded.' };
  }

  const characters = prepareFeatherFallCase(
    prepareFallCase(application.snapshot.characters, 'damaging'),
    choice,
  );
  const mapData = setSourcePlatformElevation(
    prepareFallingGroundImpactMapData(application.snapshot.mapData),
    FALLING_GROUND_IMPACT_SOURCE_FEET,
  );
  const result = resolveFallingGroundImpact({
    eventId: FALL_EVENT_ID,
    fallerId: FALLING_GROUND_IMPACT_FALLER_ID,
    landingPosition: FALLING_GROUND_IMPACT_DAMAGE_LANDING,
    mapData,
    characters,
    damageRng: createDamageRandomSource(),
    featherFall: {
      casterId: FALLING_GROUND_IMPACT_CASTER_ID,
      selectedTargetIds: choice === 'not_selected'
        ? []
        : [FALLING_GROUND_IMPACT_FALLER_ID],
      choice: choice === 'decline' ? 'decline' : 'accept',
    },
  });

  return patchForResult(mapData, result);
}

// ============================================================================
// Control Dispatch And Registration
// ============================================================================
// Two selectors describe the deterministic case and two actions execute it.
// Selectors themselves are inert, so changing a choice never pays or lands.
// ============================================================================

function applyControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (
    application.controlId === FALL_CASE_CONTROL_ID
    || application.controlId === FEATHER_FALL_CASE_CONTROL_ID
  ) {
    return { logMessage: '' };
  }

  // Action defaults are inert during reset. The scenario-owned character and
  // map initializers establish the visible baseline without auto-running a fall.
  if (application.value === false) return { logMessage: '' };
  if (application.value !== true) {
    return { logMessage: `Falling control ${application.controlId} requires an action trigger.` };
  }

  if (application.controlId === 'resolve-fall') {
    const choice = String(application.snapshot.controlValues?.[FALL_CASE_CONTROL_ID] ?? 'short') as FallCase;
    const allowed: FallCase[] = [
      'short', 'damaging', 'cap_200', 'resistance', 'immunity',
      'temporary_hp', 'downing', 'occupied', 'blocked', 'off_board',
    ];
    return allowed.includes(choice)
      ? resolveFallCase(application, choice)
      : { logMessage: `Unknown fall case: ${choice}.` };
  }
  if (application.controlId === 'resolve-feather-fall') {
    const choice = String(
      application.snapshot.controlValues?.[FEATHER_FALL_CASE_CONTROL_ID] ?? 'accept',
    ) as FeatherFallCase;
    const allowed: FeatherFallCase[] = [
      'accept', 'decline', 'unowned', 'spent_reaction', 'empty_slot', 'not_selected',
    ];
    return allowed.includes(choice)
      ? resolveFeatherFallCase(application, choice)
      : { logMessage: `Unknown Feather Fall case: ${choice}.` };
  }

  return { logMessage: `Unknown Falling & Ground Impact control: ${application.controlId}.` };
}

const fallingGroundImpactScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'falling_ground_impact',
  controls: [
    {
      id: FALL_CASE_CONTROL_ID,
      label: 'Fall case',
      description: 'Choose threshold, cap, defense, temp-HP, downing, or endpoint legality before resolving.',
      kind: 'select',
      defaultValue: 'short',
      options: [
        { value: 'short', label: '5 ft · below threshold' },
        { value: 'damaging', label: '30 ft · normal 3d6' },
        { value: 'cap_200', label: '200 ft · capped 20d6' },
        { value: 'resistance', label: '30 ft · Bludgeoning resistance' },
        { value: 'immunity', label: '30 ft · Bludgeoning immunity' },
        { value: 'temporary_hp', label: '30 ft · 5 temporary HP' },
        { value: 'downing', label: '30 ft · 10 HP downing' },
        { value: 'occupied', label: 'Occupied landing · reject' },
        { value: 'blocked', label: 'Blocked landing · reject' },
        { value: 'off_board', label: 'Off-board landing · reject' },
      ],
    },
    {
      id: 'resolve-fall',
      label: 'Resolve selected fall',
      description: 'Submit the selected live fall event to canonical placement, damage, HP, death-state, and Prone rules.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: FEATHER_FALL_CASE_CONTROL_ID,
      label: 'Feather Fall choice',
      description: 'Choose acceptance, decline, or one eligibility/resource rejection before resolving the same 30-foot fall.',
      kind: 'select',
      defaultValue: 'accept',
      options: [
        { value: 'accept', label: 'Accept · eligible owner' },
        { value: 'decline', label: 'Decline · fall proceeds' },
        { value: 'unowned', label: 'Reject · spell not owned' },
        { value: 'spent_reaction', label: 'Reject · Reaction spent' },
        { value: 'empty_slot', label: 'Reject · L1 slot empty' },
        { value: 'not_selected', label: 'Reject · faller not selected' },
      ],
    },
    {
      id: 'resolve-feather-fall',
      label: 'Resolve fall + Feather Fall',
      description: 'Offer the selected real reaction, pay at most once, then land with protection or canonical impact.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl,
};

export default fallingGroundImpactScenarioControls;
