/**
 * This file proves Cover Mechanics controls supply real production inputs.
 *
 * The cases are judged by Aralia's cover, line-of-sight, movement, and
 * visibility helpers rather than by control labels. Action requests are kept
 * result-free so the mounted host can prove turn ownership, payment, rolls,
 * damage, repeat rejection, and Reset through normal combat execution.
 *
 * Called by: focused Vitest scenario-control verification.
 * Depends on: coverScenarioControls and production combat-rule helpers.
 */

import { describe, expect, it } from 'vitest';
import { VisibilitySystem } from '../../../../../systems/visibility';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../../../types/combat';
import { calculateCover } from '../../../../../utils/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import { hasLineOfSight } from '../../../../../utils/spatial';
import { createCoverScenarioLightSources } from '../../PreviewCombatScenarioLights';
import {
  createPreviewCombatScenarioControlDefaults,
  type PreviewCombatScenarioControlPatch,
  type PreviewCombatScenarioControlSnapshot,
  type PreviewCombatScenarioControlValue,
} from '../PreviewCombatScenarioControlTypes';
import coverScenarioControlModule, {
  COVER_RANGER_ID,
  COVER_RANGER_START,
  COVER_TARGET_BASE_AC,
  COVER_TARGET_HP,
  COVER_TARGET_ID,
  COVER_TARGET_START,
  COVER_TEST_TILE_ID,
  getCoverInitiativeTotal,
  type CoverProofCase,
} from '../coverScenarioControls';

// ============================================================================
// Complete Scenario Snapshot
// ============================================================================
// The rectangle matches the live 16-by-12 board, so Bresenham cover and sight
// tracing inspect the same intermediate coordinates as rendered play.
// ============================================================================

function createTile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'floor',
    elevation: 0,
    movementCost: 5,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

function createCoverMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();

  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const tile = createTile(x, y);

      // Reproduce the permanent scenery around the controlled firing tile.
      // The two pillars already express the corrected movement/sight split.
      if (x === 7 && y >= 2 && y <= 9) {
        if (y === 5 || y === 6) {
          tile.decoration = 'pillar';
          tile.providesCover = true;
          tile.blocksMovement = true;
          tile.blocksLoS = false;
        } else {
          tile.decoration = 'bush';
          tile.providesCover = true;
          tile.terrain = 'difficult';
          tile.movementCost = 10;
        }
      }

      tiles.set(tile.id, tile);
    }
  }

  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'dungeon',
    seed: 42,
  };
}

function createCoverSnapshot(): PreviewCombatScenarioControlSnapshot {
  const ranger = createMockCombatCharacter({
    id: COVER_RANGER_ID,
    name: 'Player Ranger',
    team: 'player',
    position: { ...COVER_RANGER_START },
  });
  const goblin = createMockCombatCharacter({
    id: COVER_TARGET_ID,
    name: 'Goblin Scuttler',
    team: 'enemy',
    position: { x: 7, y: 3 },
    currentHP: 15,
    maxHP: 15,
  });
  const sniper = createMockCombatCharacter({
    id: 'orc-sniper',
    name: 'Orc Sniper',
    team: 'enemy',
    position: { x: 9, y: 5 },
  });

  return {
    mapData: createCoverMap(),
    characters: [ranger, goblin, sniper],
    activeLightSources: createCoverScenarioLightSources(COVER_RANGER_ID),
    reactiveTriggers: [],
  };
}

// ============================================================================
// Shared Test Helpers
// ============================================================================
// These helpers apply controls exactly as the host does and make missing map or
// actor facts fail loudly instead of turning a malformed fixture into a pass.
// ============================================================================

function applyControl(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
  value: PreviewCombatScenarioControlValue,
): PreviewCombatScenarioControlPatch {
  return coverScenarioControlModule.applyControl({ controlId, value, snapshot });
}

function applyPatch(
  snapshot: PreviewCombatScenarioControlSnapshot,
  patch: PreviewCombatScenarioControlPatch,
): PreviewCombatScenarioControlSnapshot {
  return {
    ...snapshot,
    mapData: patch.mapData ?? snapshot.mapData,
    characters: patch.characters ?? snapshot.characters,
    activeLightSources: patch.activeLightSources ?? snapshot.activeLightSources,
    reactiveTriggers: patch.reactiveTriggers ?? snapshot.reactiveTriggers,
  };
}

function applyCoverCase(
  snapshot: PreviewCombatScenarioControlSnapshot,
  coverCase: CoverProofCase,
): PreviewCombatScenarioControlSnapshot {
  return applyPatch(snapshot, applyControl(snapshot, 'cover-case', coverCase));
}

function requireMap(snapshot: PreviewCombatScenarioControlSnapshot): BattleMapData {
  if (!snapshot.mapData) throw new Error('Expected the Cover Mechanics board.');
  return snapshot.mapData;
}

function findCharacter(
  characters: CombatCharacter[],
  characterId: string,
): CombatCharacter {
  const character = characters.find(candidate => candidate.id === characterId);
  if (!character) throw new Error(`Expected Cover actor ${characterId}.`);
  return character;
}

function findTile(mapData: BattleMapData, tileId: string): BattleMapTile {
  const tile = mapData.tiles.get(tileId);
  if (!tile) throw new Error(`Expected Cover tile ${tileId}.`);
  return tile;
}

function hasRangerSight(snapshot: PreviewCombatScenarioControlSnapshot): boolean {
  const map = requireMap(snapshot);
  return hasLineOfSight(
    findTile(map, `${COVER_RANGER_START.x}-${COVER_RANGER_START.y}`),
    findTile(map, `${COVER_TARGET_START.x}-${COVER_TARGET_START.y}`),
    map,
  );
}

// ============================================================================
// Canonical Cover Contract
// ============================================================================
// One target and one line prove 0/+2/+5 AC plus Total Cover. The partial pillar
// remains a movement blocker but never becomes a sight blocker.
// ============================================================================

describe('coverScenarioControlModule', () => {
  it('describes one case selector, one production attack, and one visibility toggle', () => {
    expect(coverScenarioControlModule.scenarioId).toBe('cover');
    expect(coverScenarioControlModule.controls).toEqual([
      expect.objectContaining({
        id: 'cover-case',
        kind: 'select',
        defaultValue: 'half',
        options: [
          expect.objectContaining({ value: 'uncovered' }),
          expect.objectContaining({ value: 'half' }),
          expect.objectContaining({ value: 'three_quarters' }),
          expect.objectContaining({ value: 'total' }),
        ],
      }),
      expect.objectContaining({
        id: 'resolve-cover-shot',
        kind: 'action',
        defaultValue: false,
      }),
      expect.objectContaining({
        id: 'ranger-darkvision',
        kind: 'toggle',
        defaultValue: false,
      }),
    ]);
  });

  it.each([
    {
      coverCase: 'uncovered',
      expectedBonus: 0,
      expectedSight: true,
      expectedTile: {
        decoration: null,
        providesCover: false,
        blocksMovement: false,
        blocksLoS: false,
      },
    },
    {
      coverCase: 'half',
      expectedBonus: 2,
      expectedSight: true,
      expectedTile: {
        decoration: 'bush',
        providesCover: true,
        blocksMovement: false,
        blocksLoS: false,
      },
    },
    {
      coverCase: 'three_quarters',
      expectedBonus: 5,
      expectedSight: true,
      expectedTile: {
        decoration: 'pillar',
        providesCover: true,
        blocksMovement: true,
        blocksLoS: false,
      },
    },
    {
      coverCase: 'total',
      expectedBonus: 0,
      expectedSight: false,
      expectedTile: {
        decoration: null,
        providesCover: false,
        blocksMovement: true,
        blocksLoS: true,
      },
    },
  ] as const)('prepares the $coverCase production geometry', ({
    coverCase,
    expectedBonus,
    expectedSight,
    expectedTile,
  }) => {
    const prepared = applyCoverCase(createCoverSnapshot(), coverCase);
    const map = requireMap(prepared);
    const ranger = findCharacter(prepared.characters, COVER_RANGER_ID);
    const target = findCharacter(prepared.characters, COVER_TARGET_ID);

    expect(ranger.position).toEqual(COVER_RANGER_START);
    expect(target).toMatchObject({
      position: COVER_TARGET_START,
      armorClass: COVER_TARGET_BASE_AC,
      baseAC: COVER_TARGET_BASE_AC,
      currentHP: COVER_TARGET_HP,
      maxHP: COVER_TARGET_HP,
    });
    expect(findTile(map, COVER_TEST_TILE_ID)).toMatchObject(expectedTile);
    expect(calculateCover(ranger.position, target.position, map)).toBe(expectedBonus);
    expect(hasRangerSight(prepared)).toBe(expectedSight);
  });

  // ========================================================================
  // Production Attack Request And Resource Preservation
  // ========================================================================
  // The adapter pins inputs but never spends or restores the Ranger's Action.
  // Mounted coverage below proves the real turn manager owns both operations.
  // ========================================================================

  it('requests the same deterministic production shot without authoring a result', () => {
    const prepared = applyCoverCase(createCoverSnapshot(), 'half');
    const patch = applyControl(prepared, 'resolve-cover-shot', true);

    expect(patch.characters).toBeUndefined();
    expect(patch.mapData).toBeUndefined();
    expect(patch.logMessage).toBe('');
    expect(patch.abilityExecution).toMatchObject({
      casterId: COVER_RANGER_ID,
      targetId: COVER_TARGET_ID,
      ability: expect.objectContaining({
        id: 'cover-test-shortbow',
        attackBonus: 5,
        cost: { type: 'action' },
      }),
    });
    expect(patch.abilityExecution?.attackRollRng?.()).toBeCloseTo(0.575);
    expect(patch.abilityExecution?.damageRng?.()).toBe(0.5);
  });

  it('keeps spent resources and damage stable across repeat case selection', () => {
    const prepared = applyCoverCase(createCoverSnapshot(), 'half');
    const ranger = findCharacter(prepared.characters, COVER_RANGER_ID);
    const target = findCharacter(prepared.characters, COVER_TARGET_ID);
    const afterCombat: PreviewCombatScenarioControlSnapshot = {
      ...prepared,
      characters: prepared.characters.map(character => {
        if (character.id === COVER_RANGER_ID) {
          return {
            ...ranger,
            actionEconomy: {
              ...ranger.actionEconomy,
              action: { used: true, remaining: 0 },
            },
          };
        }
        return character.id === COVER_TARGET_ID
          ? { ...target, currentHP: COVER_TARGET_HP - 7 }
          : character;
      }),
    };

    const once = applyCoverCase(afterCombat, 'three_quarters');
    const twice = applyCoverCase(once, 'three_quarters');
    const repeatedRanger = findCharacter(twice.characters, COVER_RANGER_ID);
    const repeatedTarget = findCharacter(twice.characters, COVER_TARGET_ID);

    expect(repeatedRanger.actionEconomy.action).toEqual({ used: true, remaining: 0 });
    expect(repeatedTarget.currentHP).toBe(COVER_TARGET_HP - 7);
    expect(requireMap(twice)).toEqual(requireMap(once));
  });

  it('orders the Ranger first on every authored initiative evaluation', () => {
    const snapshot = applyCoverCase(createCoverSnapshot(), 'half');
    const orderedIds = [...snapshot.characters]
      .sort((left, right) => getCoverInitiativeTotal(right) - getCoverInitiativeTotal(left))
      .map(character => character.id);

    expect(orderedIds).toEqual([COVER_RANGER_ID, COVER_TARGET_ID, 'orc-sniper']);
  });

  // ========================================================================
  // Visibility And Reset Defaults
  // ========================================================================
  // Darkvision changes one sense while the torch remains a separate real light
  // source. Reapplying defaults reconstructs the same Half Cover baseline.
  // ========================================================================

  it('switches only Ranger darkvision while preserving the movable torch', () => {
    const snapshot = applyCoverCase(createCoverSnapshot(), 'half');
    const enabled = applyPatch(
      snapshot,
      applyControl(snapshot, 'ranger-darkvision', true),
    );
    const ranger = findCharacter(enabled.characters, COVER_RANGER_ID);
    const mapData = requireMap(enabled);
    const lightLevels = VisibilitySystem.calculateLightLevels(
      mapData,
      enabled.activeLightSources ?? [],
    );

    expect(ranger.stats.senses?.darkvision).toBe(60);
    expect(enabled.activeLightSources).toEqual(snapshot.activeLightSources);
    expect(VisibilitySystem.calculateVisibility(ranger, mapData, lightLevels).get('13-5')).toBe('dim');

    const disabled = applyPatch(
      enabled,
      applyControl(enabled, 'ranger-darkvision', false),
    );
    const rangerWithoutDarkvision = findCharacter(disabled.characters, COVER_RANGER_ID);
    expect(rangerWithoutDarkvision.stats.senses?.darkvision).toBe(0);
    expect(VisibilitySystem.calculateVisibility(
      rangerWithoutDarkvision,
      requireMap(disabled),
      lightLevels,
    ).get('13-5')).toBe('hidden');
    expect(disabled.activeLightSources).toEqual(snapshot.activeLightSources);
  });

  it('reapplies defaults deterministically for Reset Board', () => {
    const defaults = createPreviewCombatScenarioControlDefaults(coverScenarioControlModule);
    const applyDefaults = (initial: PreviewCombatScenarioControlSnapshot) => (
      coverScenarioControlModule.controls.reduce((snapshot, control) => applyPatch(
        snapshot,
        applyControl(snapshot, control.id, defaults[control.id]),
      ), initial)
    );

    const firstReset = applyDefaults(createCoverSnapshot());
    const secondReset = applyDefaults(createCoverSnapshot());

    expect(defaults).toEqual({
      'cover-case': 'half',
      'resolve-cover-shot': false,
      'ranger-darkvision': false,
    });
    expect(requireMap(firstReset)).toEqual(requireMap(secondReset));
    expect(firstReset.characters).toEqual(secondReset.characters);
    expect(calculateCover(COVER_RANGER_START, COVER_TARGET_START, requireMap(firstReset))).toBe(2);
  });

  // ========================================================================
  // Defensive No-Op Boundaries
  // ========================================================================
  // Malformed or stale controls remain visible no-ops and never invent a map,
  // actor, or combat result.
  // ========================================================================

  it('rejects invalid cases, action values, and stale control ids without state patches', () => {
    const snapshot = createCoverSnapshot();
    const invalidCase = applyControl(snapshot, 'cover-case', 'five_eighths');
    const invalidAction = applyControl(snapshot, 'resolve-cover-shot', 'go');
    const stale = applyControl(snapshot, 'old-cover-toggle', true);

    for (const patch of [invalidCase, invalidAction, stale]) {
      expect(patch.mapData).toBeUndefined();
      expect(patch.characters).toBeUndefined();
      expect(patch.abilityExecution).toBeUndefined();
      expect(patch.logMessage).toMatch(/invalid|requires|ignored/i);
    }
  });

  it('does not invent a board when a valid case reaches a mapless snapshot', () => {
    const snapshot = { ...createCoverSnapshot(), mapData: null };
    const patch = applyControl(snapshot, 'cover-case', 'total');

    expect(patch.mapData).toBeUndefined();
    expect(patch.characters).toBeDefined();
    expect(patch.logMessage).toContain('Total Cover');
  });
});
