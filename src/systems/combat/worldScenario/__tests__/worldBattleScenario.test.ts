/**
 * This file proves that the battle-map scenario lab uses the real WorldForge
 * pipeline and that the final tactical projection remains deterministic.
 *
 * The test intentionally builds the small boreal wilderness preset instead of
 * mocking GroundWorld. It therefore catches drift at the exact World -> Region
 * -> Local -> Ground -> Tactical boundary the visual harness is meant to audit.
 */
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getWorldforgeLocalForCell } from '../../../worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld } from '../../../worldforge/bridge/groundChunkLoader';
import {
  WORLD_BATTLE_SCENARIO_PRESETS,
  createWorldBattleScenarioFromGround,
} from '../worldBattleScenario';

describe('WorldForge battle scenario projection', () => {
  it('turns a real generated woodland into a deterministic, provenance-bearing referee map', () => {
    const preset = WORLD_BATTLE_SCENARIO_PRESETS.find((candidate) => candidate.id === 'boreal-woodland')!;
    const bridged = getWorldforgeLocalForCell(preset.worldSeed, preset.entryCellId, {
      centerPx: preset.centerPx,
    });
    const ground = makeGroundWorld(bridged.local, preset.worldSeed, bridged.region, {
      hour: 12,
      anchorCellId: preset.entryCellId,
    });

    const first = createWorldBattleScenarioFromGround(preset, ground);
    const second = createWorldBattleScenarioFromGround(preset, ground);

    expect(first.mapData.provenance).toMatchObject({
      kind: 'worldforge',
      worldSeed: 42,
      anchorCellId: 476,
      scenarioId: 'boreal-woodland',
    });
    expect(first.mapData.dimensions).toEqual({ width: 80, height: 60 });
    expect(first.diagnostics.source.naturalFeatures).toBeGreaterThan(0);
    expect(first.diagnostics.tactical.decoratedTiles).toBeGreaterThan(0);
    expect(first.diagnostics.parity.find((check) => check.id === 'natural-features')?.status).toBe('pass');

    // The harness must report missing semantic bridges honestly. Natural props
    // are visible in this slice, but the production extractor does not yet
    // publish explicit TargetableMapObject records for them.
    expect(first.diagnostics.parity.find((check) => check.id === 'object-targeting')?.status).toBe('gap');

    // Re-projecting the same GroundWorld must preserve every referee fact.
    const tileSignature = (scenario: typeof first) => [...scenario.mapData.tiles.values()]
      .map((tile) => [
        tile.id,
        tile.terrain,
        tile.elevation,
        tile.decoration,
        tile.blocksMovement,
        tile.blocksLoS,
        tile.providesCover ?? false,
        tile.surface ?? null,
        tile.crossing ?? null,
      ]);
    expect(tileSignature(second)).toEqual(tileSignature(first));

    // A road-focused recipe anchors on the closest point of an actual source
    // run. The center referee cell then retains that run as a surface fact and
    // the parity report turns green without any painter-authored substitute.
    const center = { x: ground.extentMetersX / 2, z: ground.extentMetersZ / 2 };
    const roadGround = {
      ...ground,
      roads: [{
        points: [
          { x: center.x - 30, z: center.z + 10 },
          { x: center.x + 30, z: center.z + 10 },
        ],
        widthM: 3,
      }],
    };
    const roadScenario = createWorldBattleScenarioFromGround({
      ...preset,
      id: 'road-anchor-proof',
      anchorMode: 'nearest-road',
      dimensions: { width: 9, height: 9 },
    }, roadGround);

    expect(roadScenario.mapData.provenance?.anchorWorldMeters).toEqual({
      x: center.x,
      z: center.z + 10,
    });
    expect(roadScenario.mapData.tiles.get('4-4')?.surface?.kind).toBe('road');
    expect(roadScenario.diagnostics.tactical.roadTiles).toBeGreaterThan(0);
    expect(roadScenario.diagnostics.parity.find((check) => check.id === 'road-semantics')?.status).toBe('pass');
  }, 30_000);

  it('centers the canonical road ambush on a real regional route outside a town', () => {
    const preset = WORLD_BATTLE_SCENARIO_PRESETS.find((candidate) => candidate.id === 'wilderness-road-ambush')!;
    const bridged = getWorldforgeLocalForCell(preset.worldSeed, preset.entryCellId);
    const ground = makeGroundWorld(bridged.local, preset.worldSeed, bridged.region, {
      hour: 12,
      anchorCellId: preset.entryCellId,
    });
    const scenario = createWorldBattleScenarioFromGround(preset, ground);
    const centerTile = scenario.mapData.tiles.get('40-30');

    expect(scenario.diagnostics.source).toMatchObject({
      regionalRoadRuns: 1,
      townStreetRuns: 0,
      towns: 0,
    });
    expect(centerTile?.surface).toMatchObject({
      kind: 'road',
      source: 'worldforge-road',
      sourceRole: 'regional-route',
    });
    expect(scenario.mapData.encounterContext).toMatchObject({
      kind: 'road-ambush',
      source: 'worldforge-road',
      sourceRoadRole: 'regional-route',
      sourceRoadIndex: centerTile?.surface?.sourceIndex,
      anchorTile: { x: 40, y: 30 },
      deployment: {
        player: 'traveling-column',
        enemy: 'concealed-flanks',
      },
    });
    expect(Math.hypot(
      scenario.mapData.encounterContext!.routeDirection.x,
      scenario.mapData.encounterContext!.routeDirection.y,
    )).toBeCloseTo(1, 6);
    // A single route should form a corridor, not consume the board like the
    // dense Legium street network that this canonical fixture replaced.
    expect(scenario.diagnostics.tactical.regionalRoadTiles).toBeGreaterThan(100);
    expect(scenario.diagnostics.tactical.regionalRoadTiles).toBeLessThan(1_000);
    expect(scenario.diagnostics.tactical.townStreetTiles).toBe(0);
    expect(scenario.diagnostics.tactical.encounterContext).toBe('road-ambush');
    expect(scenario.diagnostics.parity.find((check) => check.id === 'road-semantics')?.status).toBe('pass');
    expect(scenario.diagnostics.parity.find((check) => check.id === 'encounter-framing')?.status).toBe('pass');
  }, 30_000);

  it('centers the canonical river scenario on one real Region bridge receipt', () => {
    const preset = WORLD_BATTLE_SCENARIO_PRESETS.find((candidate) => candidate.id === 'river-bridge-crossing')!;
    const bridged = getWorldforgeLocalForCell(preset.worldSeed, preset.entryCellId);
    const ground = makeGroundWorld(bridged.local, preset.worldSeed, bridged.region, {
      hour: 12,
      anchorCellId: preset.entryCellId,
    });
    const scenario = createWorldBattleScenarioFromGround(preset, ground);
    const centerTile = scenario.mapData.tiles.get('40-30');

    // This is intentionally a real seed/cell fixture. It proves the generated
    // Region relationship survives into both views rather than validating a
    // hand-authored combat board that merely resembles a river crossing.
    expect(scenario.diagnostics.source).toMatchObject({
      regionalRoadRuns: 1,
      riverRuns: 1,
      crossings: 1,
      bridges: 1,
      fords: 0,
      towns: 0,
    });
    expect(ground.decks.some((deck) => (
      deck.sourceCrossingId === ground.crossings?.[0]?.id
    ))).toBe(true);
    expect(centerTile).toMatchObject({
      terrain: 'water',
      movementCost: 1,
      blocksMovement: false,
      surface: {
        kind: 'road',
        source: 'worldforge-road',
        sourceRole: 'regional-route',
      },
      crossing: {
        kind: 'bridge',
        source: 'worldforge-crossing',
      },
    });
    expect(scenario.mapData.encounterContext).toMatchObject({
      kind: 'river-crossing',
      source: 'worldforge-crossing',
      sourceCrossingId: centerTile?.crossing?.sourceCrossingId,
      crossingKind: 'bridge',
      anchorTile: { x: 40, y: 30 },
      deployment: {
        player: 'near-bank',
        enemy: 'far-bank',
      },
    });
    expect(scenario.diagnostics.tactical.bridgeTiles).toBeGreaterThan(0);
    expect(scenario.diagnostics.tactical.passableCrossingTiles)
      .toBe(scenario.diagnostics.tactical.crossingTiles);
    expect(scenario.diagnostics.tactical.encounterContext).toBe('river-crossing');
    expect(scenario.diagnostics.parity.find((check) => check.id === 'river-semantics')?.status).toBe('pass');
    expect(scenario.diagnostics.parity.find((check) => check.id === 'crossing-semantics')?.status).toBe('pass');
    expect(scenario.diagnostics.parity.find((check) => check.id === 'encounter-framing')?.status).toBe('pass');
  }, 30_000);
});
