/**
 * Production travel ambushes must use the destination cell's actual WorldForge
 * road. These tests build the canonical real road fixture and then remove that
 * source fact to prove the adapter fails closed instead of choosing map center.
 */
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getWorldforgeLocalForCell } from '@/systems/worldforge/bridge/legacySubmapBridge';
import { makeGroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import {
  createTravelAmbushBattlefield,
  travelRouteSourceId,
} from '../travelAmbushBattlefield';

const WORLD_SEED = 42;
const DESTINATION_CELL = 373;
const ROUTE_CELLS = [112, 201, DESTINATION_CELL] as const;

function buildCanonicalRoadGround() {
  const bridged = getWorldforgeLocalForCell(WORLD_SEED, DESTINATION_CELL);
  return makeGroundWorld(bridged.local, WORLD_SEED, bridged.region, {
    hour: 12,
    anchorCellId: DESTINATION_CELL,
  });
}

describe('travel ambush WorldForge battlefield', () => {
  it('projects the committed destination onto a deterministic real road frame', () => {
    const ground = buildCanonicalRoadGround();
    const input = {
      worldSeed: WORLD_SEED,
      destinationCellId: DESTINATION_CELL,
      routeCells: ROUTE_CELLS,
      hour: 12,
    };

    const first = createTravelAmbushBattlefield(ground, input);
    const second = createTravelAmbushBattlefield(ground, input);

    expect(first.status).toBe('ready');
    expect(second.status).toBe('ready');
    if (first.status !== 'ready' || second.status !== 'ready') return;

    expect(first.sourceRouteId).toBe('atlas-route:112:373:cells-3');
    expect(first.mapData.provenance).toMatchObject({
      kind: 'worldforge',
      worldSeed: WORLD_SEED,
      anchorCellId: DESTINATION_CELL,
      scenarioId: `production-travel-ambush:${travelRouteSourceId(ROUTE_CELLS)}`,
    });
    expect(first.mapData.provenance?.generationPath).toContain(
      'Travel event atlas-route:112:373:cells-3',
    );
    expect(first.mapData.encounterContext).toMatchObject({
      kind: 'road-ambush',
      source: 'worldforge-road',
      deployment: {
        player: 'traveling-column',
        enemy: 'concealed-flanks',
      },
    });
    expect(first.diagnostics.parity.find((check) => check.id === 'encounter-framing')?.status)
      .toBe('pass');

    const tileSignature = (result: typeof first) => (
      result.status === 'ready'
        ? [...result.mapData.tiles.values()].map((tile) => [tile.id, tile.terrain, tile.surface ?? null])
        : []
    );
    expect(tileSignature(second)).toEqual(tileSignature(first));
  }, 30_000);

  it('withholds travel combat when the destination publishes no source road', () => {
    const ground = { ...buildCanonicalRoadGround(), roads: [] };
    const result = createTravelAmbushBattlefield(ground, {
      worldSeed: WORLD_SEED,
      destinationCellId: DESTINATION_CELL,
      routeCells: ROUTE_CELLS,
      hour: 12,
    });

    expect(result).toMatchObject({
      status: 'source-gap',
      sourceRouteId: 'atlas-route:112:373:cells-3',
    });
    if (result.status === 'source-gap') {
      expect(result.detail).toContain('published no traversable source road');
    }
  }, 30_000);
});
