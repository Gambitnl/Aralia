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

    // Every represented natural feature now keeps a source-addressable object
    // record. A warning remains acceptable only when this crop also contains a
    // catalog prop whose mobility/weight facts have not yet been authored.
    expect(first.diagnostics.source.naturalFeaturesInCrop).toBeGreaterThan(0);
    expect(first.diagnostics.tactical.targetableFeatures).toBeGreaterThan(0);
    expect(first.diagnostics.parity.find((check) => check.id === 'object-targeting')?.status)
      .not.toBe('gap');
    expect(first.mapData.targetableObjects?.every((object) => object.source?.worldMeters)).toBe(true);

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
    expect(second.mapData.targetableObjects).toEqual(first.mapData.targetableObjects);

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

  it('publishes real Legium props while exposing the catalog facts still missing for movement spells', () => {
    const preset = WORLD_BATTLE_SCENARIO_PRESETS.find((candidate) => candidate.id === 'legium-town-skirmish')!;
    const bridged = getWorldforgeLocalForCell(preset.worldSeed, preset.entryCellId, {
      centerPx: preset.centerPx,
    });
    const ground = makeGroundWorld(bridged.local, preset.worldSeed, bridged.region, {
      hour: 12,
      anchorCellId: preset.entryCellId,
    });
    const scenario = createWorldBattleScenarioFromGround(preset, ground);
    const propTargets = scenario.mapData.targetableObjects?.filter((object) => (
      object.source?.kind === 'worldforge-prop'
    )) ?? [];

    expect(scenario.diagnostics.source.placedPropsInCrop).toBeGreaterThan(0);
    expect(propTargets.length).toBeGreaterThan(0);
    expect(scenario.diagnostics.source.placedPropsInCrop).toBe(propTargets.length);
    expect(scenario.diagnostics.tactical.targetableProps).toBe(propTargets.length);
    expect(propTargets.every((object) => object.source?.sourceKind)).toBe(true);
    expect(propTargets.every((object) => object.isFixedToSurface == null)).toBe(true);
    expect(scenario.diagnostics.tactical.incompleteTargetFacts).toBeGreaterThan(0);
    expect(scenario.diagnostics.parity.find((check) => check.id === 'object-targeting')?.status)
      .toBe('warning');
  }, 30_000);

  it('frames a deterministic Legium gate encounter from real structures and live resident schedules', () => {
    const preset = WORLD_BATTLE_SCENARIO_PRESETS.find((candidate) => candidate.id === 'legium-settlement-edge')!;
    const bridged = getWorldforgeLocalForCell(preset.worldSeed, preset.entryCellId, {
      centerPx: preset.centerPx,
    });
    const ground = makeGroundWorld(bridged.local, preset.worldSeed, bridged.region, {
      hour: preset.hour ?? 12,
      anchorCellId: preset.entryCellId,
    });
    const first = createWorldBattleScenarioFromGround(preset, ground, {
      useVisualHostilityFixture: true,
    });
    const second = createWorldBattleScenarioFromGround(preset, ground, {
      useVisualHostilityFixture: true,
    });
    const occupants = first.mapData.worldOccupants ?? [];

    // The recipe is anchored to a source gatehouse, not a visually convenient
    // arbitrary crop. Buildings and scheduled people must both survive it.
    expect(first.diagnostics.source.gatehousesInCrop).toBeGreaterThan(0);
    expect(first.diagnostics.source.buildingsInCrop).toBeGreaterThan(0);
    expect(first.diagnostics.source.occupantsInCrop).toBeGreaterThan(0);
    expect(occupants).toHaveLength(first.diagnostics.source.occupantsInCrop);
    expect(new Set(occupants.map((occupant) => occupant.id)).size).toBe(occupants.length);
    expect(first.diagnostics.tactical.movingOccupants)
      .toBe(first.diagnostics.source.movingOccupantsInCrop);
    expect(second.mapData.worldOccupants).toEqual(first.mapData.worldOccupants);

    expect(first.mapData.encounterContext).toMatchObject({
      kind: 'settlement-edge',
      source: 'worldforge-settlement',
      sourceBurgId: 14,
      anchorTile: { x: 40, y: 30 },
      deployment: {
        player: 'outside-approach',
        enemy: 'inside-gate',
      },
    });
    if (first.mapData.encounterContext?.kind !== 'settlement-edge') {
      throw new Error('Expected settlement-edge encounter context');
    }
    expect(Math.hypot(
      first.mapData.encounterContext.routeDirection.x,
      first.mapData.encounterContext.routeDirection.y,
    )).toBeCloseTo(1, 6);
    expect(first.mapData.encounterContext.defendingForce).toMatchObject({
      source: {
        stateName: 'Turino',
        stateFullName: 'Grand Duchy of Turino',
        regimentName: '1st (Legium) Regiment',
        regimentTroops: 4565,
        stateAlert: 4.25,
      },
      projection: {
        kind: 'gate-patrol-alert-sample-v1',
        tacticalActorBudget: 4,
        tacticalActors: 4,
        units: [
          expect.objectContaining({ sourceUnitType: 'archers', tacticalActors: 2 }),
          expect.objectContaining({ sourceUnitType: 'infantry', tacticalActors: 2 }),
        ],
        hostility: {
          verdict: 'hostile',
          trigger: {
            kind: 'watch-confrontation',
            source: 'visual-harness',
            locationId: 'cell_829',
          },
          relation: {
            kind: 'wanted-in-location',
            locationId: 'cell_829',
          },
        },
      },
    });
    expect(second.mapData.encounterContext).toEqual(first.mapData.encounterContext);
    expect(first.diagnostics.defense).toMatchObject({
      stateName: 'Turino',
      stationedRegiments: 2,
      stationedTroops: 4580,
      selectedRegiment: '1st (Legium) Regiment',
      selectedRegimentTroops: 4565,
      tacticalActors: 4,
      tacticalUnits: ['2 archers', '2 infantry'],
      excludedUnits: ['61 artillery', '323 cavalry'],
      hostility: {
        verdict: 'hostile',
        rule: 'explicit-trigger-plus-matching-relation-v1',
        triggerKind: 'watch-confrontation',
        triggerSource: 'visual-harness',
        relationKind: 'wanted-in-location',
        relationSummary: '1 witnessed crime in cell_829',
        inputKind: 'visual-harness-fixture',
      },
    });
    expect(first.diagnostics.parity.find((check) => check.id === 'occupant-projection')?.status)
      .toBe('pass');
    expect(first.diagnostics.tactical.occupantsOnBlockedTiles).toBe(0);
    expect(first.diagnostics.parity.find((check) => check.id === 'occupant-combat-semantics')?.status)
      .toBe('warning');
    expect(first.diagnostics.parity.find((check) => check.id === 'encounter-framing')?.status)
      .toBe('pass');
    expect(first.diagnostics.parity.find((check) => check.id === 'settlement-defender-source')?.status)
      .toBe('pass');
    expect(first.diagnostics.parity.find((check) => check.id === 'settlement-defender-unit-bridges')?.status)
      .toBe('warning');
    expect(first.diagnostics.parity.find((check) => check.id === 'faction-hostility')?.status)
      .toBe('pass');
    expect(first.diagnostics.parity.find((check) => check.id === 'faction-hostility-live-input')?.status)
      .toBe('gap');

    // The same WorldForge location without an explicit harness/player-state
    // input still exposes its regiment, but cannot authorize enemy actors.
    const contextualOnly = createWorldBattleScenarioFromGround(preset, ground);
    if (contextualOnly.mapData.encounterContext?.kind !== 'settlement-edge') {
      throw new Error('Expected settlement-edge context without hostility fixture');
    }
    expect(contextualOnly.mapData.encounterContext.defendingForce?.projection.hostility)
      .toMatchObject({ verdict: 'withhold-combat', trigger: { kind: 'none' } });
    expect(contextualOnly.diagnostics.defense.hostility.inputKind).toBe('none');
  }, 30_000);

  it('runs the production watch-interception frame with an explicitly labeled visual fixture', () => {
    const preset = WORLD_BATTLE_SCENARIO_PRESETS.find((candidate) => (
      candidate.id === 'legium-watch-interception'
    ))!;
    const bridged = getWorldforgeLocalForCell(preset.worldSeed, preset.entryCellId, {
      centerPx: preset.centerPx,
    });
    const ground = makeGroundWorld(bridged.local, preset.worldSeed, bridged.region, {
      hour: preset.hour ?? 12,
      anchorCellId: preset.entryCellId,
    });
    const scenario = createWorldBattleScenarioFromGround(preset, ground, {
      useVisualHostilityFixture: true,
    });

    const encounterContext = scenario.mapData.encounterContext;
    expect(encounterContext).toMatchObject({
      kind: 'settlement-watch',
      source: 'worldforge-settlement',
      sourceBurgId: 14,
      sourceConfrontationId: 'visual-harness:legium-watch-interception',
      deployment: {
        player: 'current-position',
        enemy: 'watch-interception',
      },
      defendingForce: {
        projection: {
          hostility: {
            verdict: 'hostile',
            trigger: { source: 'visual-harness' },
          },
        },
      },
    });
    if (scenario.mapData.encounterContext?.kind !== 'settlement-watch') {
      throw new Error('Expected settlement-watch encounter context');
    }
    const watchAnchor = scenario.mapData.encounterContext.anchorTile;
    expect(Math.hypot(watchAnchor.x - 40, watchAnchor.y - 30)).toBeLessThanOrEqual(1);
    expect(scenario.mapData.tiles.get(`${watchAnchor.x}-${watchAnchor.y}`)?.blocksMovement)
      .toBe(false);
    expect(scenario.diagnostics.tactical.encounterContext).toBe('settlement-watch');
    expect(scenario.diagnostics.defense.hostility).toMatchObject({
      verdict: 'hostile',
      inputKind: 'visual-harness-fixture',
    });
    expect(scenario.diagnostics.parity.find((check) => check.id === 'encounter-framing')?.status)
      .toBe('pass');
    expect(scenario.diagnostics.parity.find((check) => check.id === 'faction-hostility-live-input')?.status)
      .toBe('gap');
  }, 30_000);

  it('runs the production opening projector while exposing unauthored enemy spatial facts', () => {
    const preset = WORLD_BATTLE_SCENARIO_PRESETS.find((candidate) => (
      candidate.id === 'legium-hostile-opening'
    ))!;
    const bridged = getWorldforgeLocalForCell(preset.worldSeed, preset.entryCellId, {
      centerPx: preset.centerPx,
    });
    const ground = makeGroundWorld(bridged.local, preset.worldSeed, bridged.region, {
      hour: preset.hour ?? 12,
      anchorCellId: preset.entryCellId,
    });

    const scenario = createWorldBattleScenarioFromGround(preset, ground);
    const context = scenario.mapData.encounterContext;

    expect(context).toMatchObject({
      kind: 'opening-standoff',
      source: 'worldforge-opening',
      sourceReceiptId: 'opening:42:cell:829',
      sourceWorldCellId: 829,
      deployment: {
        player: 'current-position',
        enemy: 'terrain-fit-standoff-constellation',
      },
      omittedFacts: {
        enemyWorldPositions: 'not-authored',
        approachDirection: 'not-authored',
      },
    });
    expect(scenario.mapData.provenance?.generationPath)
      .toContain('Opening threat opening:42:cell:829');
    expect(scenario.diagnostics.parity.find((check) => (
      check.id === 'opening-threat-spatial-authority'
    ))).toMatchObject({ status: 'warning' });
  }, 30_000);

  it('runs the production state-patrol frame with an explicitly labeled hostile-standing fixture', () => {
    const preset = WORLD_BATTLE_SCENARIO_PRESETS.find((candidate) => (
      candidate.id === 'legium-state-patrol'
    ))!;
    const bridged = getWorldforgeLocalForCell(preset.worldSeed, preset.entryCellId, {
      centerPx: preset.centerPx,
    });
    const ground = makeGroundWorld(bridged.local, preset.worldSeed, bridged.region, {
      hour: preset.hour ?? 12,
      anchorCellId: preset.entryCellId,
    });
    const scenario = createWorldBattleScenarioFromGround(preset, ground, {
      useVisualHostilityFixture: true,
    });

    const statePatrolContext = scenario.mapData.encounterContext;
    expect(statePatrolContext).toMatchObject({
      kind: 'settlement-state-patrol',
      source: 'worldforge-settlement',
      sourceBurgId: 14,
      sourceFactionId: 'worldforge-state:14',
      sourceConfrontationId: 'visual-harness:legium-state-patrol',
      deployment: {
        player: 'current-position',
        enemy: 'state-patrol-interception',
      },
      defendingForce: {
        projection: {
          hostility: {
            verdict: 'hostile',
            trigger: {
              kind: 'state-confrontation',
              source: 'visual-harness',
            },
            relation: {
              kind: 'state-standing',
              publicStanding: -55,
              qualifiesAsHostile: true,
            },
          },
        },
      },
    });
    expect(scenario.diagnostics.tactical.encounterContext).toBe('settlement-state-patrol');
    expect(scenario.diagnostics.defense.hostility).toMatchObject({
      verdict: 'hostile',
      inputKind: 'visual-harness-fixture',
      relationKind: 'state-standing',
    });
    expect(scenario.diagnostics.parity.find((check) => check.id === 'encounter-framing')?.status)
      .toBe('pass');
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
    const roadEncounterContext = scenario.mapData.encounterContext;
    expect(roadEncounterContext).toMatchObject({
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
    // Only route-framed encounters author a direction. Opening standoffs now
    // preserve the honest absence of that fact, so narrow to the road receipt
    // before proving this fixture's normalized source heading.
    expect(roadEncounterContext?.kind).toBe('road-ambush');
    if (roadEncounterContext?.kind !== 'road-ambush') return;
    expect(Math.hypot(
      roadEncounterContext.routeDirection.x,
      roadEncounterContext.routeDirection.y,
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
