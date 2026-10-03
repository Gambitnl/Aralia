// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 15:06:33
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns deterministic inputs for the Line of Sight & Targeting sandbox.
 *
 * A tester moves one target and physical blockers through clear, corner,
 * endpoint, and range cases; chooses cover and visibility facts; then asks the
 * mounted production combat system to resolve one stable ranged attack. The
 * adapter never authors payment, rolls, HP, or target-legality outcomes.
 *
 * Called by: the Tactical Sandbox scenario-control registry and host.
 * Depends on: canonical sight, cover, distance, visibility, and combat types.
 */

import { VisibilitySystem, type VisibilityTier } from '../../../../systems/visibility';
import type {
  Ability,
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  LightSource,
} from '../../../../types/combat';
import { calculateCover, getCharacterDistance } from '../../../../utils/combat';
import { bresenhamLine, hasLineOfSight } from '../../../../utils/spatial';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
  PreviewCombatScenarioControlValues,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Auditable Scenario Facts
// ============================================================================
// One attacker, target, event id, and board size make every comparison
// attributable to the selected physical fact instead of a changing combatant.
// ============================================================================

export const LINE_OF_SIGHT_TESTER_ID = 'line_of_sight-tester';
export const LINE_OF_SIGHT_TARGET_ID = 'line_of_sight-target';
export const LINE_OF_SIGHT_TESTER_START = { x: 2, y: 5 } as const;
export const LINE_OF_SIGHT_TARGET_HP = 30;
export const LINE_OF_SIGHT_TARGET_AC = 13;
export const LINE_OF_SIGHT_PROBE_EVENT_ID = 'cs07-sightline-probe-001';

export type LineOfSightPathCase =
  | 'clear_in_range'
  | 'blocked_center'
  | 'corner_clear'
  | 'corner_blocked'
  | 'endpoint_clear'
  | 'endpoint_blocked'
  | 'range_edge'
  | 'out_of_range';

export type LineOfSightCoverCase = 'none' | 'half' | 'three_quarters' | 'total';

export type LineOfSightVisibilityCase =
  | 'bright_normal'
  | 'darkness_normal'
  | 'darkvision_60'
  | 'blindsight_60'
  | 'invisible_target';

const PATH_CASE_CONTROL_ID = 'sightline_case';
const COVER_CASE_CONTROL_ID = 'cover_case';
const VISIBILITY_CASE_CONTROL_ID = 'visibility_case';
const RESOLVE_PROBE_CONTROL_ID = 'resolve_probe';
const REPLAY_PROBE_CONTROL_ID = 'replay_probe';

const MANAGED_EFFECT_PREFIX = 'line-of-sight-';
const LEGACY_SMOKE_EFFECT_ID = 'line-of-sight-smoke-screen';
const TEACHING_LIGHT_ID = 'line-of-sight-target-light';

const CLEAR_TARGET = { x: 10, y: 5 } as const;
const CORNER_TARGET = { x: 5, y: 2 } as const;
const RANGE_EDGE_TARGET = { x: 14, y: 5 } as const;
const OUT_OF_RANGE_TARGET = { x: 15, y: 11 } as const;
const CENTER_BLOCKER = { x: 7, y: 5 } as const;
const CORNER_HORIZONTAL_SIDE = { x: 3, y: 5 } as const;
const CORNER_VERTICAL_SIDE = { x: 2, y: 4 } as const;

const PATH_CASES = new Set<LineOfSightPathCase>([
  'clear_in_range',
  'blocked_center',
  'corner_clear',
  'corner_blocked',
  'endpoint_clear',
  'endpoint_blocked',
  'range_edge',
  'out_of_range',
]);
const COVER_CASES = new Set<LineOfSightCoverCase>([
  'none',
  'half',
  'three_quarters',
  'total',
]);
const VISIBILITY_CASES = new Set<LineOfSightVisibilityCase>([
  'bright_normal',
  'darkness_normal',
  'darkvision_60',
  'blindsight_60',
  'invisible_target',
]);

export const SIGHTLINE_PROBE: Ability = {
  id: 'line-of-sight-sightline-probe',
  name: 'Sightline Probe',
  description: 'A stable ranged attack resolved by the production target and combat transactions.',
  type: 'attack',
  attackType: 'spell',
  isMagical: true,
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 12,
  attackBonus: 5,
  effects: [{ type: 'damage', dice: '1d4+2', damageType: 'force' }],
  icon: '◎',
};

// A face 12 plus +5 hits AC 13 and Half Cover AC 15, but misses
// Three-Quarters Cover AC 18. Total Cover and range fail before this source runs.
const FIXED_ATTACK_ROLL_RNG = (): number => (12 - 0.5) / 20;
const FIXED_DAMAGE_RNG = (): number => 0.5;

// ============================================================================
// Deterministic Turn Ownership
// ============================================================================
// Reset must always make the tester the active actor so a legal probe can pay
// its Action and an invalid probe can prove that Action remains untouched.
// ============================================================================

export function getLineOfSightInitiativeTotal(character: CombatCharacter): number {
  if (character.id === LINE_OF_SIGHT_TESTER_ID) return 20;
  if (character.id === LINE_OF_SIGHT_TARGET_ID) return 10;
  return 0;
}

// ============================================================================
// Pure Fixture Preparation
// ============================================================================
// Select controls rebuild every CS07-owned fact from the complete current value
// set. HP and Action state survive case changes; only Reset supplies fresh actors.
// ============================================================================

function cloneProbe(): Ability {
  return {
    ...SIGHTLINE_PROBE,
    cost: { ...SIGHTLINE_PROBE.cost },
    effects: SIGHTLINE_PROBE.effects.map(effect => ({ ...effect })),
  };
}

function getPathTarget(pathCase: LineOfSightPathCase) {
  if (pathCase === 'corner_clear' || pathCase === 'corner_blocked') {
    return CORNER_TARGET;
  }
  if (pathCase === 'range_edge') return RANGE_EDGE_TARGET;
  if (pathCase === 'out_of_range') return OUT_OF_RANGE_TARGET;
  return CLEAR_TARGET;
}

function setManagedWall(tile: BattleMapTile, effectId: string): BattleMapTile {
  return {
    ...tile,
    terrain: 'wall',
    movementCost: 0,
    blocksMovement: true,
    blocksLoS: true,
    decoration: null,
    providesCover: false,
    effects: [...tile.effects.filter(effect => !effect.startsWith(MANAGED_EFFECT_PREFIX)), effectId],
  };
}

function normalizeManagedTile(tile: BattleMapTile): BattleMapTile {
  const isLegacyWallColumn = tile.coordinates.x === 7
    && tile.coordinates.y >= 2
    && tile.coordinates.y <= 9;
  const hasManagedEffect = tile.effects.some(effect => effect.startsWith(MANAGED_EFFECT_PREFIX));
  const environmentalEffects = (tile.environmentalEffects ?? [])
    .filter(effect => effect.id !== LEGACY_SMOKE_EFFECT_ID);

  // Legacy CS07 walls and every tile marked by a previous case return to a
  // plain floor before the next complete controlled fixture is layered on.
  if (!isLegacyWallColumn && !hasManagedEffect && environmentalEffects.length === (tile.environmentalEffects ?? []).length) {
    return tile;
  }

  return {
    ...tile,
    terrain: 'floor',
    movementCost: 5,
    blocksMovement: false,
    blocksLoS: false,
    decoration: null,
    providesCover: false,
    effects: tile.effects.filter(effect => !effect.startsWith(MANAGED_EFFECT_PREFIX)),
    environmentalEffects,
  };
}

function updateTiles(
  mapData: BattleMapData,
  updateTile: (tile: BattleMapTile) => BattleMapTile,
): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();

  // Preserve dimensions, targetable objects, and iteration order while only
  // replacing tiles whose controlled facts actually change.
  mapData.tiles.forEach((tile, tileId) => {
    tiles.set(tileId, updateTile(tile));
  });
  return { ...mapData, tiles };
}

function updateTileAt(
  mapData: BattleMapData,
  position: { x: number; y: number },
  updateTile: (tile: BattleMapTile) => BattleMapTile,
): BattleMapData {
  return updateTiles(mapData, tile => (
    tile.coordinates.x === position.x && tile.coordinates.y === position.y
      ? updateTile(tile)
      : tile
  ));
}

function applyPathGeometry(
  mapData: BattleMapData,
  pathCase: LineOfSightPathCase,
  targetPosition: { x: number; y: number },
): BattleMapData {
  let nextMap = updateTiles(mapData, normalizeManagedTile);

  if (pathCase === 'blocked_center') {
    nextMap = updateTileAt(nextMap, CENTER_BLOCKER, tile => (
      setManagedWall(tile, 'line-of-sight-center-blocker')
    ));
  }

  if (pathCase === 'corner_clear' || pathCase === 'corner_blocked') {
    nextMap = updateTileAt(nextMap, CORNER_HORIZONTAL_SIDE, tile => (
      setManagedWall(tile, 'line-of-sight-corner-side-a')
    ));
    if (pathCase === 'corner_blocked') {
      nextMap = updateTileAt(nextMap, CORNER_VERTICAL_SIDE, tile => (
        setManagedWall(tile, 'line-of-sight-corner-side-b')
      ));
    }
  }

  if (pathCase === 'endpoint_clear' || pathCase === 'endpoint_blocked') {
    nextMap = updateTileAt(nextMap, targetPosition, tile => (
      pathCase === 'endpoint_blocked'
        ? setManagedWall(tile, 'line-of-sight-endpoint-blocker')
        : {
            ...tile,
            effects: [...tile.effects, 'line-of-sight-endpoint-clear'],
          }
    ));
  }

  return nextMap;
}

function applyCoverGeometry(
  mapData: BattleMapData,
  targetPosition: { x: number; y: number },
  coverCase: LineOfSightCoverCase,
): BattleMapData {
  if (coverCase === 'none') return mapData;

  const line = bresenhamLine(
    LINE_OF_SIGHT_TESTER_START.x,
    LINE_OF_SIGHT_TESTER_START.y,
    targetPosition.x,
    targetPosition.y,
  );
  const intermediate = line.slice(1, -1);
  const coverPosition = intermediate[Math.floor(intermediate.length / 2)];
  if (!coverPosition) return mapData;

  return updateTileAt(mapData, coverPosition, tile => {
    if (coverCase === 'total') {
      return setManagedWall(tile, 'line-of-sight-total-cover');
    }

    // Partial cover remains an open sight line. Its production decoration and
    // providesCover facts add +2 or +5 AC during the ordinary attack command.
    return {
      ...tile,
      terrain: 'floor',
      movementCost: 5,
      blocksMovement: coverCase === 'three_quarters',
      blocksLoS: false,
      decoration: coverCase === 'half' ? 'bush' : 'pillar',
      providesCover: true,
      effects: [
        ...tile.effects.filter(effect => !effect.startsWith(MANAGED_EFFECT_PREFIX)),
        `line-of-sight-cover-${coverCase}`,
      ],
    };
  });
}

function prepareCharacters(
  characters: CombatCharacter[],
  targetPosition: { x: number; y: number },
  visibilityCase: LineOfSightVisibilityCase,
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === LINE_OF_SIGHT_TESTER_ID) {
      const darkvision = visibilityCase === 'darkvision_60' ? 60 : 0;
      const blindsight = visibilityCase === 'blindsight_60' ? 60 : 0;
      return {
        ...character,
        name: 'Sightline Tester · +5 Probe · Action-owned',
        position: { ...LINE_OF_SIGHT_TESTER_START },
        team: 'player',
        stats: {
          ...character.stats,
          senses: {
            ...character.stats.senses,
            darkvision,
            blindsight,
            tremorsense: character.stats.senses?.tremorsense ?? 0,
            truesight: character.stats.senses?.truesight ?? 0,
          },
        },
        abilities: [
          cloneProbe(),
          ...character.abilities.filter(ability => ability.id !== SIGHTLINE_PROBE.id),
        ],
      };
    }

    if (character.id === LINE_OF_SIGHT_TARGET_ID) {
      const conditions = (character.conditions ?? [])
        .filter(condition => condition.source !== 'CS07 visibility case');
      if (visibilityCase === 'invisible_target') {
        conditions.push({
          name: 'Invisible',
          source: 'CS07 visibility case',
          duration: { type: 'permanent' },
          appliedTurn: 0,
        });
      }

      return {
        ...character,
        name: `Sightline Target · AC ${LINE_OF_SIGHT_TARGET_AC} · ${LINE_OF_SIGHT_TARGET_HP} HP`,
        position: { ...targetPosition },
        team: 'enemy',
        currentHP: character.maxHP === LINE_OF_SIGHT_TARGET_HP
          ? character.currentHP
          : LINE_OF_SIGHT_TARGET_HP,
        maxHP: LINE_OF_SIGHT_TARGET_HP,
        armorClass: LINE_OF_SIGHT_TARGET_AC,
        baseAC: LINE_OF_SIGHT_TARGET_AC,
        conditions,
      };
    }

    return character;
  });
}

function prepareLightSources(
  lightSources: LightSource[],
  targetPosition: { x: number; y: number },
  visibilityCase: LineOfSightVisibilityCase,
): LightSource[] {
  const preserved = lightSources.filter(source => source.id !== TEACHING_LIGHT_ID);
  const needsTargetLight = visibilityCase === 'bright_normal'
    || visibilityCase === 'invisible_target';
  if (!needsTargetLight) return preserved;

  // The point light illuminates the target without becoming a scenario-only
  // visibility result. VisibilitySystem still computes the tile tier and rays.
  return [
    ...preserved,
    {
      id: TEACHING_LIGHT_ID,
      sourceSpellId: 'light',
      casterId: LINE_OF_SIGHT_TESTER_ID,
      attachedTo: 'point',
      position: { ...targetPosition },
      brightRadius: 5,
      dimRadius: 0,
      createdTurn: 0,
    },
  ];
}

function getControlledValues(values?: PreviewCombatScenarioControlValues): {
  pathCase: LineOfSightPathCase;
  coverCase: LineOfSightCoverCase;
  visibilityCase: LineOfSightVisibilityCase;
} {
  const pathValue = String(values?.[PATH_CASE_CONTROL_ID] ?? 'blocked_center') as LineOfSightPathCase;
  const coverValue = String(values?.[COVER_CASE_CONTROL_ID] ?? 'none') as LineOfSightCoverCase;
  const visibilityValue = String(values?.[VISIBILITY_CASE_CONTROL_ID] ?? 'bright_normal') as LineOfSightVisibilityCase;

  return {
    pathCase: PATH_CASES.has(pathValue) ? pathValue : 'blocked_center',
    coverCase: COVER_CASES.has(coverValue) ? coverValue : 'none',
    visibilityCase: VISIBILITY_CASES.has(visibilityValue) ? visibilityValue : 'bright_normal',
  };
}

export function prepareLineOfSightScenarioSnapshot(
  snapshot: PreviewCombatScenarioControlSnapshot,
): PreviewCombatScenarioControlPatch {
  const { pathCase, coverCase, visibilityCase } = getControlledValues(snapshot.controlValues);
  const targetPosition = getPathTarget(pathCase);
  const characters = prepareCharacters(snapshot.characters, targetPosition, visibilityCase);
  const pathMap = snapshot.mapData
    ? applyPathGeometry(snapshot.mapData, pathCase, targetPosition)
    : undefined;
  const mapData = pathMap
    ? applyCoverGeometry(pathMap, targetPosition, coverCase)
    : undefined;

  return {
    ...(mapData ? { mapData } : {}),
    characters,
    activeLightSources: prepareLightSources(
      snapshot.activeLightSources,
      targetPosition,
      visibilityCase,
    ),
    logMessage: '',
  };
}

// ============================================================================
// Production-backed Readout
// ============================================================================
// The visible receipt and tests read the same geometry, cover, range, light,
// and sense helpers used by targeting and attack resolution.
// ============================================================================

export interface LineOfSightScenarioReadout {
  distanceFeet: number;
  rangeFeet: number;
  lineOfSight: boolean;
  coverLabel: 'none' | 'half' | 'three-quarters' | 'total';
  coverBonus: number;
  visibilityTier: VisibilityTier;
  invisibleTarget: boolean;
  targetEligible: boolean;
  attackRollMode: 'normal' | 'disadvantage' | 'blocked';
  actionState: 'ready' | 'spent';
  targetHP: number;
}

export function getLineOfSightScenarioReadout(
  snapshot: PreviewCombatScenarioControlSnapshot,
): LineOfSightScenarioReadout | null {
  const mapData = snapshot.mapData;
  const tester = snapshot.characters.find(character => character.id === LINE_OF_SIGHT_TESTER_ID);
  const target = snapshot.characters.find(character => character.id === LINE_OF_SIGHT_TARGET_ID);
  if (!mapData || !tester || !target) return null;

  const sourceTile = mapData.tiles.get(`${tester.position.x}-${tester.position.y}`);
  const targetTile = mapData.tiles.get(`${target.position.x}-${target.position.y}`);
  const lineOfSight = Boolean(
    sourceTile && targetTile && hasLineOfSight(sourceTile, targetTile, mapData),
  );
  const distanceTiles = getCharacterDistance(tester, target);
  const lightLevels = VisibilitySystem.calculateLightLevels(mapData, snapshot.activeLightSources);
  const visibilityTier = VisibilitySystem.calculateVisibility(tester, mapData, lightLevels)
    .get(`${target.position.x}-${target.position.y}`) ?? 'hidden';
  const invisibleTarget = (target.conditions ?? []).some(condition => condition.name === 'Invisible');
  const blocked = distanceTiles > SIGHTLINE_PROBE.range || !lineOfSight;
  // The selector owns the human-readable cover category while calculateCover
  // remains authoritative for the modifier. Total cover is a legality fact,
  // not a larger AC bonus, so it cannot be reconstructed from that number.
  const coverLabel = getControlledValues(snapshot.controlValues).coverCase
    .replace('_', '-') as LineOfSightScenarioReadout['coverLabel'];

  return {
    distanceFeet: distanceTiles * 5,
    rangeFeet: SIGHTLINE_PROBE.range * 5,
    lineOfSight,
    coverLabel,
    coverBonus: calculateCover(tester.position, target.position, mapData),
    visibilityTier,
    invisibleTarget,
    targetEligible: !blocked,
    attackRollMode: blocked
      ? 'blocked'
      : visibilityTier === 'hidden' || invisibleTarget
        ? 'disadvantage'
        : 'normal',
    actionState: tester.actionEconomy.action.used ? 'spent' : 'ready',
    targetHP: target.currentHP,
  };
}

// ============================================================================
// Control Application
// ============================================================================
// Selectors prepare facts only. Both action buttons request the same stable
// production event so the second delivery proves the replay no-op boundary.
// ============================================================================

function requestProbe(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.value !== true) return { logMessage: '' };

  return {
    abilityExecution: {
      ability: cloneProbe(),
      casterId: LINE_OF_SIGHT_TESTER_ID,
      targetId: LINE_OF_SIGHT_TARGET_ID,
      attackRollRng: FIXED_ATTACK_ROLL_RNG,
      damageRng: FIXED_DAMAGE_RNG,
      executionEventId: LINE_OF_SIGHT_PROBE_EVENT_ID,
    },
    logMessage: '',
  };
}

function applyLineOfSightControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (
    application.controlId === PATH_CASE_CONTROL_ID
    || application.controlId === COVER_CASE_CONTROL_ID
    || application.controlId === VISIBILITY_CASE_CONTROL_ID
  ) {
    return prepareLineOfSightScenarioSnapshot({
      ...application.snapshot,
      controlValues: {
        ...application.snapshot.controlValues,
        [application.controlId]: application.value,
      },
    });
  }

  if (
    application.controlId === RESOLVE_PROBE_CONTROL_ID
    || application.controlId === REPLAY_PROBE_CONTROL_ID
  ) {
    return requestProbe(application);
  }

  // Stale hot-reloaded controls are explicit no-ops. They never install a
  // fixture, spend a resource, or fabricate a combat result.
  return {
    logMessage: `Line-of-sight control "${application.controlId}" was ignored because it is not registered.`,
  };
}

// ============================================================================
// Registry Export
// ============================================================================
// Reset Board reapplies these defaults after creating fresh actors and clearing
// the stable event ledger, reproducing one exact blocked, lit baseline.
// ============================================================================

export const lineOfSightScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'line_of_sight',
  controls: [
    {
      id: PATH_CASE_CONTROL_ID,
      label: 'Sightline Geometry',
      description: 'Move the target and blocker through clear, corner, endpoint, range-edge, and out-of-range facts.',
      kind: 'select',
      defaultValue: 'blocked_center',
      options: [
        { value: 'clear_in_range', label: 'Clear lane · 40 ft' },
        { value: 'blocked_center', label: 'Center blocker · 40 ft' },
        { value: 'corner_clear', label: 'Corner open on one side' },
        { value: 'corner_blocked', label: 'Corner sealed on both sides' },
        { value: 'endpoint_clear', label: 'Clear target endpoint' },
        { value: 'endpoint_blocked', label: 'Opaque target endpoint' },
        { value: 'range_edge', label: 'Exactly 60 ft' },
        { value: 'out_of_range', label: '65 ft · out of range' },
      ],
    },
    {
      id: COVER_CASE_CONTROL_ID,
      label: 'Cover Between Actors',
      description: 'Compare no cover, +2 Half Cover, +5 Three-Quarters Cover, and target-blocking Total Cover.',
      kind: 'select',
      defaultValue: 'none',
      options: [
        { value: 'none', label: 'No cover' },
        { value: 'half', label: 'Half Cover · +2 AC' },
        { value: 'three_quarters', label: 'Three-Quarters · +5 AC' },
        { value: 'total', label: 'Total Cover · blocked' },
      ],
    },
    {
      id: VISIBILITY_CASE_CONTROL_ID,
      label: 'Light & Sense',
      description: 'Use the production visibility system for bright light, darkness, Darkvision, Blindsight, or Invisible.',
      kind: 'select',
      defaultValue: 'bright_normal',
      options: [
        { value: 'bright_normal', label: 'Target lit · normal vision' },
        { value: 'darkness_normal', label: 'Darkness · normal vision' },
        { value: 'darkvision_60', label: 'Darkness · Darkvision 60 ft' },
        { value: 'blindsight_60', label: 'Darkness · Blindsight 60 ft' },
        { value: 'invisible_target', label: 'Lit but Invisible target' },
      ],
    },
    {
      id: RESOLVE_PROBE_CONTROL_ID,
      label: 'Resolve Sightline Probe',
      description: 'Validate the target, then let production own Action payment, cover AC, roll, damage, HP, and log.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: REPLAY_PROBE_CONTROL_ID,
      label: 'Replay Stable Probe',
      description: 'Redeliver the same event id; no target check, roll, Action, damage, or HP effect may repeat.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyLineOfSightControl,
};

export default lineOfSightScenarioControls;
