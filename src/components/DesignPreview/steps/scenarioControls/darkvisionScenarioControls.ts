// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 12:23:42
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { VisibilitySystem, type VisibilityTier } from '../../../../systems/visibility/VisibilitySystem';
import type {
  Ability,
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  LightLevel,
  LightSource,
  Position,
} from '../../../../types/combat';
import { getDistance } from '../../../../utils/combat';
import { hasLineOfSight } from '../../../../utils/spatial';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
} from './PreviewCombatScenarioControlTypes';

/**
 * This file owns the deterministic inputs for Darkvision & Senses.
 *
 * The scenario adapter changes only authored actor senses and positions, one
 * line-of-sight blocker, and one ordinary LightSource. Its Fire Bolt action is
 * handed back to the mounted production ability system, which remains the
 * owner of targeting, Action payment, attack rolls, damage, and combat logs.
 * The readout also calls the production visibility and line-of-sight helpers,
 * so the teaching surface never maintains a second answer to the sight rules.
 *
 * Called by: the Tactical Sandbox control registry and mounted scenario host.
 * Depends on: VisibilitySystem, shared grid line of sight, and combat types.
 */

// ============================================================================
// Stable Scenario Facts
// ============================================================================
// Exact identities and cells keep range boundaries attributable to one changed
// fact. One grid cell is five feet throughout the production combat map.
// ============================================================================

export const DARKVISION_WIZARD_ID = 'human-wizard';
export const DARKVISION_TARGET_ID = 'shadow-lurker';
export const DARKVISION_LANTERN_ID = 'darkvision-sandbox-teaching-lantern';

export const DARKVISION_WIZARD_START: Position = { x: 2, y: 5 };
export type DarkvisionSenseMode = 'normal' | 'darkvision_60' | 'blindsight_30';
export type DarkvisionTargetCase =
  | 'blindsight_inside_30'
  | 'blindsight_outside_35'
  | 'darkvision_inside_60'
  | 'darkvision_outside_65'
  | 'blocked_line_of_sight';
export type DarkvisionLanternPosition = 'off' | 'near_observer' | 'on_target';

export const DARKVISION_TARGET_POSITIONS = {
  blindsight_inside_30: { x: 8, y: 5 },
  blindsight_outside_35: { x: 9, y: 5 },
  darkvision_inside_60: { x: 14, y: 5 },
  darkvision_outside_65: { x: 15, y: 5 },
  blocked_line_of_sight: { x: 10, y: 5 },
} as const satisfies Record<DarkvisionTargetCase, Position>;
export const DARKVISION_SIGHT_BLOCKER: Position = { x: 6, y: 5 };

const DARKVISION_RANGE_FEET = 60;
const BLINDSIGHT_RANGE_FEET = 30;
const LANTERN_BRIGHT_RADIUS_FEET = 15;
const LANTERN_DIM_RADIUS_FEET = 15;

const SENSE_MODE_CONTROL_ID = 'observer-sense-mode';
const TARGET_CASE_CONTROL_ID = 'target-case';
const LANTERN_POSITION_CONTROL_ID = 'lantern-position';
const RESOLVE_FIRE_BOLT_CONTROL_ID = 'resolve-fire-bolt';

const SENSE_MODES = new Set<DarkvisionSenseMode>([
  'normal',
  'darkvision_60',
  'blindsight_30',
]);
const TARGET_CASES = new Set<DarkvisionTargetCase>([
  'blindsight_inside_30',
  'blindsight_outside_35',
  'darkvision_inside_60',
  'darkvision_outside_65',
  'blocked_line_of_sight',
]);
const LANTERN_POSITIONS = new Set<DarkvisionLanternPosition>([
  'off',
  'near_observer',
  'on_target',
]);

// A d20 face of 12 plus the authored +6 spell-attack bonus hits the target's
// AC 12. In darkness the production roller consumes the same source twice and
// reports Disadvantage; light or an in-range sense reports a normal roll.
const FIXED_ATTACK_ROLL_RNG = (): number => (12 - 0.5) / 20;
const FIXED_DAMAGE_RNG = (): number => 0.5;

export const DARKVISION_TEST_FIRE_BOLT: Ability = {
  id: 'darkvision-test-fire-bolt',
  name: 'Darkvision Test Fire Bolt',
  description: 'A deterministic spell attack resolved by the production combat transaction.',
  type: 'attack',
  attackType: 'spell',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 24,
  attackBonus: 6,
  effects: [{ type: 'damage', dice: '2d10', damageType: 'fire' }],
  isProficient: true,
  isMagical: true,
};

// ============================================================================
// Deterministic Turn Ownership
// ============================================================================
// The Human Wizard must own the first turn so the action button proves its
// Action ledger. These totals alter only initiative input; scheduling and turn
// starts remain inside the production turn manager.
// ============================================================================

export function getDarkvisionInitiativeTotal(character: CombatCharacter): number {
  if (character.id === DARKVISION_WIZARD_ID) return 20;
  if (character.id === DARKVISION_TARGET_ID) return 15;
  if (character.id === 'elf-cleric') return 10;
  if (character.id === 'blind-dweller') return 5;
  return 0;
}

// ============================================================================
// Pure Actor, Geometry, and Light Preparation
// ============================================================================
// Select controls replace only their owned facts. They preserve current HP and
// Action use, so changing a teaching input cannot refund a spent attack.
// ============================================================================

function updateCharacter(
  characters: CombatCharacter[],
  characterId: string,
  change: (character: CombatCharacter) => CombatCharacter,
): CombatCharacter[] | null {
  if (!characters.some(character => character.id === characterId)) return null;
  return characters.map(character => (
    character.id === characterId ? change(character) : character
  ));
}

function setSenseMode(
  snapshot: PreviewCombatScenarioControlSnapshot,
  senseMode: DarkvisionSenseMode,
): PreviewCombatScenarioControlPatch {
  const characters = updateCharacter(
    snapshot.characters,
    DARKVISION_WIZARD_ID,
    character => ({
      ...character,
      name: 'Human Wizard · +6 Fire Bolt · Action-owned',
      position: { ...DARKVISION_WIZARD_START },
      abilities: [
        {
          ...DARKVISION_TEST_FIRE_BOLT,
          cost: { ...DARKVISION_TEST_FIRE_BOLT.cost },
          effects: DARKVISION_TEST_FIRE_BOLT.effects.map(effect => ({ ...effect })),
        },
        ...character.abilities.filter(ability => (
          ability.id !== DARKVISION_TEST_FIRE_BOLT.id && ability.id !== 'fire_bolt'
        )),
      ],
      stats: {
        ...character.stats,
        senses: {
          darkvision: senseMode === 'darkvision_60' ? DARKVISION_RANGE_FEET : 0,
          blindsight: senseMode === 'blindsight_30' ? BLINDSIGHT_RANGE_FEET : 0,
          tremorsense: character.stats.senses?.tremorsense ?? 0,
          truesight: character.stats.senses?.truesight ?? 0,
        },
      },
    }),
  );

  if (!characters) {
    return { logMessage: 'Sense control skipped because the Human Wizard is not on this map.' };
  }

  const description = senseMode === 'normal'
    ? 'Normal vision: ambient darkness leaves the target unseen and attacks use Disadvantage.'
    : senseMode === 'darkvision_60'
      ? 'Darkvision 60 ft: mundane darkness is dim within exactly 60 ft, not beyond it.'
      : 'Blindsight 30 ft: darkness is visible within exactly 30 ft, but geometry still blocks sight.';
  return { characters, logMessage: description };
}

function copyMapWithSightBlocker(
  mapData: BattleMapData,
  blocked: boolean,
): BattleMapData {
  const blockerId = `${DARKVISION_SIGHT_BLOCKER.x}-${DARKVISION_SIGHT_BLOCKER.y}`;
  const tiles = new Map<string, BattleMapTile>();

  // Every target case first restores the authored floor cell, then optionally
  // raises the one opaque wall used by the blocked-line proof.
  mapData.tiles.forEach((tile, tileId) => {
    tiles.set(tileId, tileId === blockerId
      ? {
          ...tile,
          terrain: blocked ? 'wall' : 'floor',
          movementCost: 5,
          blocksMovement: blocked,
          blocksLoS: blocked,
          decoration: blocked ? 'stalagmite' : null,
        }
      : tile);
  });
  return { ...mapData, tiles };
}

function createTeachingLantern(position: Position): LightSource {
  return {
    id: DARKVISION_LANTERN_ID,
    sourceSpellId: 'sandbox-teaching-lantern',
    casterId: DARKVISION_WIZARD_ID,
    brightRadius: LANTERN_BRIGHT_RADIUS_FEET,
    dimRadius: LANTERN_DIM_RADIUS_FEET,
    attachedTo: 'point',
    position: { ...position },
    color: '#fbbf24',
    createdTurn: 0,
  };
}

function replaceTeachingLantern(
  lightSources: LightSource[],
  position: Position | null,
): LightSource[] {
  const unrelatedLights = lightSources.filter(source => source.id !== DARKVISION_LANTERN_ID);
  return position
    ? [...unrelatedLights, createTeachingLantern(position)]
    : unrelatedLights;
}

function setTargetCase(
  snapshot: PreviewCombatScenarioControlSnapshot,
  targetCase: DarkvisionTargetCase,
): PreviewCombatScenarioControlPatch {
  if (!snapshot.mapData) {
    return { logMessage: 'Target case skipped because the cave map is not loaded.' };
  }

  const targetPosition = DARKVISION_TARGET_POSITIONS[targetCase];
  const characters = updateCharacter(
    snapshot.characters,
    DARKVISION_TARGET_ID,
    character => ({
      ...character,
      name: `Shadow Lurker · AC 12 · ${character.maxHP === 40 ? character.currentHP : 40}/40 HP`,
      position: { ...targetPosition },
      currentHP: character.maxHP === 40 ? character.currentHP : 40,
      maxHP: 40,
      armorClass: 12,
      baseAC: 12,
    }),
  );
  if (!characters) {
    return { logMessage: 'Target case skipped because the Shadow Lurker is not on this map.' };
  }

  const mapData = copyMapWithSightBlocker(
    snapshot.mapData,
    targetCase === 'blocked_line_of_sight',
  );
  const distanceFeet = getDistance(DARKVISION_WIZARD_START, targetPosition) * 5;
  const lanternPosition = snapshot.controlValues?.[LANTERN_POSITION_CONTROL_ID];
  const activeLightSources = lanternPosition === 'on_target'
    ? replaceTeachingLantern(snapshot.activeLightSources, targetPosition)
    : snapshot.activeLightSources;

  return {
    mapData,
    characters,
    activeLightSources,
    logMessage: targetCase === 'blocked_line_of_sight'
      ? `Shadow Lurker is ${distanceFeet} ft away behind Total Cover; target validation must reject before Action payment or a roll.`
      : `Shadow Lurker is ${distanceFeet} ft away in ambient darkness with a clear sight line.`,
  };
}

function setLanternPosition(
  snapshot: PreviewCombatScenarioControlSnapshot,
  lanternPosition: DarkvisionLanternPosition,
): PreviewCombatScenarioControlPatch {
  const target = snapshot.characters.find(character => character.id === DARKVISION_TARGET_ID);
  if (!target) {
    return { logMessage: 'Lantern control skipped because the Shadow Lurker is not on this map.' };
  }

  const position = lanternPosition === 'off'
    ? null
    : lanternPosition === 'near_observer'
      ? { x: DARKVISION_WIZARD_START.x + 1, y: DARKVISION_WIZARD_START.y }
      : target.position;
  const activeLightSources = replaceTeachingLantern(snapshot.activeLightSources, position);

  return {
    activeLightSources,
    logMessage: lanternPosition === 'off'
      ? 'Teaching Lantern is off; the cave uses ambient darkness.'
      : lanternPosition === 'near_observer'
        ? 'Teaching Lantern is near the observer: 15 ft bright plus another 15 ft dim.'
        : 'Teaching Lantern is on the target: production light makes that target tile bright.',
  };
}

// ============================================================================
// Production-backed Readout
// ============================================================================
// The mounted strip and tests consume this same receipt. Visibility and light
// tiers come directly from VisibilitySystem, while geometry uses the shared
// line-of-sight helper also used by target validation.
// ============================================================================

export interface DarkvisionScenarioReadout {
  distanceFeet: number;
  lightLevel: LightLevel;
  visibilityTier: VisibilityTier;
  lineOfSight: boolean;
  attackRollMode: 'normal' | 'disadvantage' | 'blocked';
  observerSense: string;
  actionState: 'ready' | 'spent';
}

export function getDarkvisionScenarioReadout(
  snapshot: PreviewCombatScenarioControlSnapshot,
): DarkvisionScenarioReadout | null {
  const mapData = snapshot.mapData;
  const observer = snapshot.characters.find(character => character.id === DARKVISION_WIZARD_ID);
  const target = snapshot.characters.find(character => character.id === DARKVISION_TARGET_ID);
  if (!mapData || !observer || !target) return null;

  const lightLevels = VisibilitySystem.calculateLightLevels(mapData, snapshot.activeLightSources);
  const visibility = VisibilitySystem.calculateVisibility(observer, mapData, lightLevels);
  const targetTileId = `${target.position.x}-${target.position.y}`;
  const observerTile = mapData.tiles.get(`${observer.position.x}-${observer.position.y}`);
  const targetTile = mapData.tiles.get(targetTileId);
  const lineOfSight = Boolean(
    observerTile && targetTile && hasLineOfSight(observerTile, targetTile, mapData),
  );
  const visibilityTier = visibility.get(targetTileId) ?? 'hidden';
  const observerSense = (observer.stats.senses?.blindsight ?? 0) > 0
    ? `Blindsight ${observer.stats.senses?.blindsight} ft`
    : (observer.stats.senses?.darkvision ?? 0) > 0
      ? `Darkvision ${observer.stats.senses?.darkvision} ft`
      : 'Normal vision';

  return {
    distanceFeet: getDistance(observer.position, target.position) * 5,
    lightLevel: lightLevels.get(targetTileId) ?? 'darkness',
    visibilityTier,
    lineOfSight,
    attackRollMode: !lineOfSight
      ? 'blocked'
      : visibilityTier === 'hidden'
        ? 'disadvantage'
        : 'normal',
    observerSense,
    actionState: observer.actionEconomy.action.used ? 'spent' : 'ready',
  };
}

// ============================================================================
// Control Application
// ============================================================================
// Selectors change inputs only. Resolve Fire Bolt requests one production
// transaction; a false/default action is a setup no-op, so Reset cannot attack.
// ============================================================================

function applyDarkvisionControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const { controlId, snapshot, value } = application;

  if (controlId === SENSE_MODE_CONTROL_ID) {
    if (typeof value !== 'string' || !SENSE_MODES.has(value as DarkvisionSenseMode)) {
      return { logMessage: `Darkvision sense mode "${String(value)}" is not supported.` };
    }
    return setSenseMode(snapshot, value as DarkvisionSenseMode);
  }

  if (controlId === TARGET_CASE_CONTROL_ID) {
    if (typeof value !== 'string' || !TARGET_CASES.has(value as DarkvisionTargetCase)) {
      return { logMessage: `Darkvision target case "${String(value)}" is not supported.` };
    }
    return setTargetCase(snapshot, value as DarkvisionTargetCase);
  }

  if (controlId === LANTERN_POSITION_CONTROL_ID) {
    if (typeof value !== 'string' || !LANTERN_POSITIONS.has(value as DarkvisionLanternPosition)) {
      return { logMessage: `Darkvision lantern position "${String(value)}" is not supported.` };
    }
    return setLanternPosition(snapshot, value as DarkvisionLanternPosition);
  }

  if (controlId === RESOLVE_FIRE_BOLT_CONTROL_ID) {
    if (value !== true) {
      return { logMessage: 'Darkvision Test Fire Bolt is ready; no attack was requested.' };
    }
    return {
      abilityExecution: {
        ability: {
          ...DARKVISION_TEST_FIRE_BOLT,
          cost: { ...DARKVISION_TEST_FIRE_BOLT.cost },
          effects: DARKVISION_TEST_FIRE_BOLT.effects.map(effect => ({ ...effect })),
        },
        casterId: DARKVISION_WIZARD_ID,
        targetId: DARKVISION_TARGET_ID,
        attackRollRng: FIXED_ATTACK_ROLL_RNG,
        damageRng: FIXED_DAMAGE_RNG,
      },
      logMessage: 'Fire Bolt requested through production targeting, Action payment, attack, damage, and log ownership.',
    };
  }

  return { logMessage: `Unknown Darkvision control: ${controlId}.` };
}

// ============================================================================
// Shared Scenario-Control Module
// ============================================================================
// Reset replays these defaults: normal vision, a clear target exactly 60 feet
// away, no lantern, and no automatic attack. The wizard's Action is refreshed
// only by the production combat initializer.
// ============================================================================

const darkvisionScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'darkvision',
  controls: [
    {
      id: SENSE_MODE_CONTROL_ID,
      label: 'Observer Sense',
      description: 'Choose normal vision, exact 60 ft Darkvision, or exact 30 ft Blindsight.',
      kind: 'select',
      defaultValue: 'normal',
      options: [
        { value: 'normal', label: 'Normal vision' },
        { value: 'darkvision_60', label: 'Darkvision — 60 ft' },
        { value: 'blindsight_30', label: 'Blindsight — 30 ft' },
      ],
    },
    {
      id: TARGET_CASE_CONTROL_ID,
      label: 'Target Boundary',
      description: 'Place the target at a sense boundary or behind one real sight-blocking wall.',
      kind: 'select',
      defaultValue: 'darkvision_inside_60',
      options: [
        { value: 'blindsight_inside_30', label: '30 ft — Blindsight edge' },
        { value: 'blindsight_outside_35', label: '35 ft — beyond Blindsight' },
        { value: 'darkvision_inside_60', label: '60 ft — Darkvision edge' },
        { value: 'darkvision_outside_65', label: '65 ft — beyond Darkvision' },
        { value: 'blocked_line_of_sight', label: '40 ft — Total Cover' },
      ],
    },
    {
      id: LANTERN_POSITION_CONTROL_ID,
      label: 'Teaching Lantern',
      description: 'Turn the production light off, move it near the observer, or place it on the target.',
      kind: 'select',
      defaultValue: 'off',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'near_observer', label: 'Near observer' },
        { value: 'on_target', label: 'On target' },
      ],
    },
    {
      id: RESOLVE_FIRE_BOLT_CONTROL_ID,
      label: 'Resolve Fire Bolt',
      description: 'Use the real target validator, Action, attack-roll visibility modifier, damage, and logs.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyDarkvisionControl,
};

export default darkvisionScenarioControls;
