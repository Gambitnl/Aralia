// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 11:47:20
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns deterministic inputs for the Cover Mechanics sandbox.
 *
 * A tester chooses one physical state for a single Ranger-to-Goblin firing
 * lane, then asks the mounted combat system to resolve an ordinary Shortbow
 * attack. The adapter changes only map geometry, authored actor facts, and the
 * random inputs for that request. Production targeting, action payment, cover
 * AC, hit or miss, damage, HP, and combat logs remain engine-owned.
 *
 * Called by: the Tactical Sandbox scenario-control registry and host.
 * Depends on: the shared control contract and production combat-state shapes.
 */

import type {
  Ability,
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../../types/combat';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Auditable Cover-Lane Facts
// ============================================================================
// Every case uses the same attacker, target, and intermediate square. Changing
// only that square makes the production result attributable to cover rather
// than range, target AC, actor placement, or a second target's statistics.
// ============================================================================

export const COVER_RANGER_ID = 'player-ranger';
export const COVER_TARGET_ID = 'goblin-scuttler';
export const COVER_SNIPER_ID = 'orc-sniper';

export const COVER_RANGER_START = { x: 2, y: 5 } as const;
export const COVER_TARGET_START = { x: 9, y: 3 } as const;
export const COVER_TEST_TILE_ID = '7-4';
export const COVER_TARGET_BASE_AC = 13;
export const COVER_TARGET_HP = 30;

export type CoverProofCase = 'uncovered' | 'half' | 'three_quarters' | 'total';

const COVER_CASE_CONTROL_ID = 'cover-case';
const RESOLVE_SHOT_CONTROL_ID = 'resolve-cover-shot';
const RANGER_DARKVISION_CONTROL_ID = 'ranger-darkvision';

const COVER_CASES = new Set<CoverProofCase>([
  'uncovered',
  'half',
  'three_quarters',
  'total',
]);

const AUTHORED_HALF_COVER_TILE_IDS = new Set([
  '7-2',
  '7-3',
  '7-4',
  '7-7',
  '7-8',
  '7-9',
]);
const AUTHORED_THREE_QUARTERS_TILE_IDS = new Set(['7-5', '7-6']);

// The prior two-toggle adapter placed a separate Total Cover wall here. Every
// new case clears it so stale hot-reloaded state cannot add a second blocker.
const LEGACY_TOTAL_COVER_TILE_ID = '8-3';

export const COVER_TEST_SHOT: Ability = {
  id: 'cover-test-shortbow',
  name: 'Cover Test Shortbow',
  description: 'A deterministic ranged attack resolved by the production combat transaction.',
  type: 'attack',
  attackType: 'weapon',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 16,
  isProficient: true,
  attackBonus: 5,
  effects: [{ type: 'damage', dice: '1d6+3', damageType: 'piercing' }],
};

// A d20 face of 12 plus the authored +5 attack bonus produces 17. That hits
// AC 13 uncovered and AC 15 behind Half Cover, misses AC 18 behind
// Three-Quarters Cover, and is never rolled through Total Cover.
const FIXED_ATTACK_ROLL_RNG = (): number => (12 - 0.5) / 20;

// A midpoint d6 roll produces 4, so a legal hit deals the stable 7 damage
// described by the Shortbow formula without replacing the production roller.
const FIXED_DAMAGE_RNG = (): number => 0.5;

// ============================================================================
// Deterministic Turn Ownership
// ============================================================================
// The Ranger must own the first turn for an action button to prove payment and
// repeat rejection. These authored totals remove random initiative without
// changing ordinary combat's production initiative policy.
// ============================================================================

export function getCoverInitiativeTotal(character: CombatCharacter): number {
  if (character.id === COVER_RANGER_ID) return 20;
  if (character.id === COVER_TARGET_ID) return 15;
  if (character.id === COVER_SNIPER_ID) return 10;
  return 0;
}

// ============================================================================
// Pure Actor Preparation
// ============================================================================
// Reset and case selection restore authored geometry and target defenses while
// preserving the live action ledger. Only the production turn manager may
// refresh an Action, so selecting a new case cannot erase a spent attack.
// ============================================================================

function prepareCoverActors(characters: CombatCharacter[]): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === COVER_RANGER_ID) {
      return {
        ...character,
        name: 'Player Ranger · +5 Shortbow · Action-owned',
        position: { ...COVER_RANGER_START },
        team: 'player',
        abilities: [
          {
            ...COVER_TEST_SHOT,
            cost: { ...COVER_TEST_SHOT.cost },
            effects: COVER_TEST_SHOT.effects.map(effect => ({ ...effect })),
          },
          ...character.abilities.filter(ability => (
            ability.id !== COVER_TEST_SHOT.id && ability.id !== 'shortbow'
          )),
        ],
      };
    }

    if (character.id === COVER_TARGET_ID) {
      return {
        ...character,
        name: `Goblin Scuttler · AC ${COVER_TARGET_BASE_AC} · ${COVER_TARGET_HP} HP`,
        position: { ...COVER_TARGET_START },
        team: 'enemy',
        currentHP: character.maxHP === COVER_TARGET_HP
          ? character.currentHP
          : COVER_TARGET_HP,
        maxHP: COVER_TARGET_HP,
        armorClass: COVER_TARGET_BASE_AC,
        baseAC: COVER_TARGET_BASE_AC,
      };
    }

    return character;
  });
}

function setRangerDarkvision(
  characters: CombatCharacter[],
  darkvisionEnabled: boolean,
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id !== COVER_RANGER_ID) return character;

    // Only darkvision changes. Blindsight and future senses remain exactly as
    // authored so this switch cannot counterfeit another visibility mechanic.
    return {
      ...character,
      stats: {
        ...character.stats,
        senses: {
          ...character.stats.senses,
          darkvision: darkvisionEnabled ? 60 : 0,
          blindsight: character.stats.senses?.blindsight ?? 0,
          tremorsense: character.stats.senses?.tremorsense ?? 0,
          truesight: character.stats.senses?.truesight ?? 0,
        },
      },
    };
  });
}

// ============================================================================
// Pure Geometry Preparation
// ============================================================================
// The authored scenery is normalized first, including the corrected partial-
// cover pillars that block movement but not sight. The selected case then
// replaces exactly one intermediate tile on the Ranger-to-Goblin line.
// ============================================================================

function copyMapWithTileUpdates(
  mapData: BattleMapData,
  updateTile: (tile: BattleMapTile) => BattleMapTile,
): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();

  // Preserve complete dimensions and iteration order while replacing only
  // scenario-owned tiles with fresh records.
  mapData.tiles.forEach((tile, tileId) => {
    tiles.set(tileId, updateTile(tile));
  });

  return { ...mapData, tiles };
}

function normalizeAuthoredCoverTile(tile: BattleMapTile): BattleMapTile {
  if (AUTHORED_HALF_COVER_TILE_IDS.has(tile.id)) {
    return {
      ...tile,
      terrain: 'difficult',
      movementCost: 10,
      decoration: 'bush',
      providesCover: true,
      blocksMovement: false,
      blocksLoS: false,
    };
  }

  if (AUTHORED_THREE_QUARTERS_TILE_IDS.has(tile.id)) {
    // A partial-cover pillar remains solid for pathfinding. It deliberately
    // leaves sight open so +5 AC can resolve instead of becoming Total Cover.
    return {
      ...tile,
      terrain: 'floor',
      movementCost: 5,
      decoration: 'pillar',
      providesCover: true,
      blocksMovement: true,
      blocksLoS: false,
    };
  }

  if (tile.id === LEGACY_TOTAL_COVER_TILE_ID) {
    return {
      ...tile,
      terrain: 'floor',
      movementCost: 5,
      decoration: null,
      providesCover: false,
      blocksMovement: false,
      blocksLoS: false,
    };
  }

  return tile;
}

function setCoverProofCase(
  mapData: BattleMapData,
  coverCase: CoverProofCase,
): BattleMapData {
  return copyMapWithTileUpdates(mapData, originalTile => {
    const tile = normalizeAuthoredCoverTile(originalTile);
    if (tile.id !== COVER_TEST_TILE_ID) return tile;

    if (coverCase === 'uncovered') {
      return {
        ...tile,
        terrain: 'floor',
        movementCost: 5,
        decoration: null,
        providesCover: false,
        blocksMovement: false,
        blocksLoS: false,
      };
    }

    if (coverCase === 'half') {
      return tile;
    }

    if (coverCase === 'three_quarters') {
      return {
        ...tile,
        terrain: 'floor',
        movementCost: 5,
        decoration: 'pillar',
        providesCover: true,
        blocksMovement: true,
        blocksLoS: false,
      };
    }

    // Total Cover is the only case that blocks sight. The same tile remains a
    // movement blocker, making the distinction from the partial pillar explicit.
    return {
      ...tile,
      terrain: 'wall',
      movementCost: 5,
      decoration: null,
      providesCover: false,
      blocksMovement: true,
      blocksLoS: true,
    };
  });
}

function readCoverCase(value: unknown): CoverProofCase | null {
  return typeof value === 'string' && COVER_CASES.has(value as CoverProofCase)
    ? value as CoverProofCase
    : null;
}

function coverCaseLabel(coverCase: CoverProofCase): string {
  if (coverCase === 'uncovered') return 'Uncovered';
  if (coverCase === 'half') return 'Half Cover (+2 AC / Dex saves)';
  if (coverCase === 'three_quarters') return 'Three-Quarters Cover (+5 AC / Dex saves)';
  return 'Total Cover (targeting blocked)';
}

// ============================================================================
// Production Transaction Requests
// ============================================================================
// Selectors prepare canonical inputs. The action branch returns an ordinary
// ability request and no authored outcome; useAbilitySystem and useTurnManager
// decide legality, payment, roll, cover AC, HP, and repeat behavior.
// ============================================================================

function applyCoverControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const { controlId, value, snapshot } = application;

  if (controlId === COVER_CASE_CONTROL_ID) {
    const coverCase = readCoverCase(value);
    if (!coverCase) {
      return { logMessage: `Cover case ignored invalid value ${String(value)}.` };
    }

    return {
      mapData: snapshot.mapData
        ? setCoverProofCase(snapshot.mapData, coverCase)
        : undefined,
      characters: prepareCoverActors(snapshot.characters),
      logMessage: `Cover lane prepared: ${coverCaseLabel(coverCase)}. Action resources were preserved.`,
    };
  }

  if (controlId === RESOLVE_SHOT_CONTROL_ID) {
    if (value === false) return { logMessage: '' };
    if (value !== true) {
      return { logMessage: 'Cover shot requires an action trigger.' };
    }

    const rangerExists = snapshot.characters.some(character => character.id === COVER_RANGER_ID);
    const targetExists = snapshot.characters.some(character => character.id === COVER_TARGET_ID);
    if (!rangerExists || !targetExists) {
      return { logMessage: 'Cover shot rejected because the authored Ranger or Goblin is unavailable.' };
    }

    return {
      abilityExecution: {
        ability: COVER_TEST_SHOT,
        casterId: COVER_RANGER_ID,
        targetId: COVER_TARGET_ID,
        attackRollRng: FIXED_ATTACK_ROLL_RNG,
        damageRng: FIXED_DAMAGE_RNG,
      },
      logMessage: '',
    };
  }

  if (controlId === RANGER_DARKVISION_CONTROL_ID) {
    if (typeof value !== 'boolean') {
      return { logMessage: `Ranger darkvision ignored invalid value ${String(value)}.` };
    }

    return {
      characters: setRangerDarkvision(snapshot.characters, value),
      logMessage: value
        ? 'Visibility fact: Player Ranger has 60-foot darkvision; move the torch to compare.'
        : 'Visibility fact: Player Ranger relies on the movable torch in darkness.',
    };
  }

  // Hot reload can briefly retain an older control id. Keep that request an
  // observable no-op instead of guessing which combat fact it once controlled.
  return { logMessage: `Cover sandbox ignored unknown control ${controlId}.` };
}

// ============================================================================
// Cover Mechanics Control Module
// ============================================================================
// Reset returns the lane to Half Cover, restores Ranger-first initiative and
// Action through the host's production initialization, disables darkvision,
// and leaves the loose torch as the alternate source of visibility.
// ============================================================================

const coverScenarioControlModule: PreviewCombatScenarioControlModule = {
  scenarioId: 'cover',
  controls: [
    {
      id: COVER_CASE_CONTROL_ID,
      label: 'Cover case',
      description: 'Change one firing lane among uncovered, +2, +5, and Total Cover without changing the target.',
      kind: 'select',
      defaultValue: 'half',
      options: [
        { value: 'uncovered', label: 'Uncovered (AC 13)' },
        { value: 'half', label: 'Half Cover (+2 → AC 15)' },
        { value: 'three_quarters', label: 'Three-Quarters (+5 → AC 18)' },
        { value: 'total', label: 'Total Cover (blocked)' },
      ],
    },
    {
      id: RESOLVE_SHOT_CONTROL_ID,
      label: 'Resolve d20 12 + 5 shot',
      description: 'Use the live Ranger Action. Repeat proves no second roll; a board reset restores the Action.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: RANGER_DARKVISION_CONTROL_ID,
      label: 'Ranger darkvision (60 ft)',
      description: 'Compare innate sight with the loose torch by moving that real map object away.',
      kind: 'toggle',
      defaultValue: false,
    },
  ],
  applyControl: applyCoverControl,
};

export default coverScenarioControlModule;
