/**
 * @file explorationBattlefieldContext.test.ts — pins full-freedom initiation (9C).
 *
 * The claim under test: combat can start from ANY exploration position, and the
 * battlefield it produces matches the context the player was standing in.
 */
import { describe, it, expect } from 'vitest';
import { BATTLE_MAP_BIOMES } from '../../../../types/combat';
import {
  FALLBACK_BATTLEFIELD_THEME,
  SETTLEMENT_BATTLEFIELD_THEME,
  pickBattlefieldTheme,
  planBattlefieldFromExploration,
} from '../explorationBattlefieldContext';

/** Every biome WorldForge can put under the player (FMG biomesData names). */
const WORLDFORGE_BIOME_NAMES = [
  'Marine', 'Hot desert', 'Cold desert', 'Savanna', 'Grassland',
  'Tropical seasonal forest', 'Temperate deciduous forest', 'Tropical rainforest',
  'Temperate rainforest', 'Taiga', 'Tundra', 'Glacier', 'Wetland',
] as const;

describe('pickBattlefieldTheme', () => {
  it('maps every WorldForge biome to a real battle-map theme', () => {
    for (const name of WORLDFORGE_BIOME_NAMES) {
      const theme = pickBattlefieldTheme({ positionM: { x: 0, z: 0 }, terrainId: name });
      expect(BATTLE_MAP_BIOMES).toContain(theme);
    }
  });

  it('matches the exploration context: forest stays a forest fight', () => {
    expect(pickBattlefieldTheme({
      positionM: { x: 0, z: 0 },
      terrainId: 'Temperate deciduous forest',
    })).toBe('forest');
  });

  it('routes a settlement fight to the built-environment theme', () => {
    expect(pickBattlefieldTheme({
      positionM: { x: 0, z: 0 },
      terrainId: 'Grassland',
      inSettlement: true,
    })).toBe(SETTLEMENT_BATTLEFIELD_THEME);
  });

  it('lets underground override even a settlement above it', () => {
    expect(pickBattlefieldTheme({
      positionM: { x: 0, z: 0 },
      terrainId: 'Grassland',
      inSettlement: true,
      underground: true,
    })).toBe('dungeon');
  });

  it('preserves the three branches the previous inline picker had', () => {
    // The old code lowercased the ground slug and matched these substrings.
    expect(pickBattlefieldTheme({ positionM: { x: 0, z: 0 }, terrainId: 'Hot desert' })).toBe('desert');
    expect(pickBattlefieldTheme({ positionM: { x: 0, z: 0 }, terrainId: 'wetland_marsh' })).toBe('swamp');
    expect(pickBattlefieldTheme({ positionM: { x: 0, z: 0 }, terrainId: 'Temperate rainforest' })).toBe('forest');
  });

  it('handles legacy ground slugs as well as FMG names', () => {
    expect(pickBattlefieldTheme({ positionM: { x: 0, z: 0 }, terrainId: 'tundra_permafrost' })).toBe('snow');
    expect(pickBattlefieldTheme({ positionM: { x: 0, z: 0 }, terrainId: 'mountain_glacier' })).toBe('snow');
  });

  it('falls back rather than throwing on an unknown or empty terrain id', () => {
    expect(pickBattlefieldTheme({ positionM: { x: 0, z: 0 } })).toBe(FALLBACK_BATTLEFIELD_THEME);
    expect(pickBattlefieldTheme({ positionM: { x: 0, z: 0 }, terrainId: 'quantum foam' }))
      .toBe(FALLBACK_BATTLEFIELD_THEME);
  });

  it('is deterministic for the same context', () => {
    const context = { positionM: { x: 12.5, z: -3 }, terrainId: 'Taiga' };
    expect(pickBattlefieldTheme(context)).toBe(pickBattlefieldTheme(context));
  });
});

describe('planBattlefieldFromExploration', () => {
  it('accepts position, terrain and nearby entities in one call', () => {
    const plan = planBattlefieldFromExploration({
      positionM: { x: 100, z: 50 },
      terrainId: 'Tropical rainforest',
      nearbyEntities: [
        { id: 'far-wolf', xM: 130, zM: 50, hostile: true },
        { id: 'near-wolf', xM: 104, zM: 50, hostile: true },
        { id: 'farmer', xM: 101, zM: 51, hostile: false },
      ],
    });

    expect(plan.theme).toBe('jungle');
    expect(plan.anchorM).toEqual({ x: 100, z: 50 });
    // Nearest hostile first, so an encounter builder can take the closest N.
    expect(plan.hostiles.map(e => e.id)).toEqual(['near-wolf', 'far-wolf']);
    expect(plan.bystanders.map(e => e.id)).toEqual(['farmer']);
  });

  it('produces a usable plan from position alone (full-freedom initiation)', () => {
    const plan = planBattlefieldFromExploration({ positionM: { x: 7, z: -2 } });
    expect(plan.theme).toBe(FALLBACK_BATTLEFIELD_THEME);
    expect(plan.anchorM).toEqual({ x: 7, z: -2 });
    expect(plan.hostiles).toEqual([]);
    expect(plan.reason).toContain('fallback');
  });

  it('copies the anchor rather than aliasing the caller position', () => {
    const positionM = { x: 1, z: 2 };
    const plan = planBattlefieldFromExploration({ positionM });
    positionM.x = 99;
    expect(plan.anchorM.x).toBe(1);
  });

  it('explains the settlement route in its reason', () => {
    const plan = planBattlefieldFromExploration({
      positionM: { x: 0, z: 0 },
      terrainId: 'Grassland',
      inSettlement: true,
    });
    expect(plan.theme).toBe(SETTLEMENT_BATTLEFIELD_THEME);
    expect(plan.reason).toContain('settlement');
  });
});
