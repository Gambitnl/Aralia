import { describe, expect, it } from 'vitest';
import type { LocalArtifact, RegionArtifact } from '../../artifacts';
import {
  atlasGroundAddressFromDrilldown,
  artifactsForAtlasGroundDrilldown,
  buildAtlasGroundDrilldown,
  groundFocusesForLocal,
  groundStartForFocus,
  normalizeAtlasGroundAddress,
} from '../atlasGroundDrilldown';
import { restoreAtlasGroundDrilldown } from '../atlasGroundRestore';
import {
  getBridgeAtlas,
  getWorldforgeLocalForCell,
} from '../../bridge/legacySubmapBridge';

/**
 * These tests prove that Atlas hands ground 3D an exact, deterministic location receipt.
 * They protect seed lineage, coordinates, destination ownership, and the feet-to-meters
 * boundary that makes the visible map selection correspond to the streamed scene.
 */

const region = {
  seedPath: '42/region:9',
  bounds: { x: 0, y: 0, width: 10_000, height: 10_000 },
} as RegionArtifact;
// The receipt builder reads identity, bounds, features, and optional town data only. This
// deliberately narrow fixture avoids inventing unrelated terrain and simulation content.
const local = {
  seedPath: '42/region:9/local:1200,900',
  bounds: { x: 1000, y: 500, width: 3000, height: 3000 },
  features: [{ id: 7, kind: 'poi', x: 1300, y: 1100, data: { name: 'Ash Shrine' } }],
} as unknown as LocalArtifact;

describe('Atlas ground drilldown', () => {
  it('preserves exact seed lineage, cell identity, coordinates, and selected site', () => {
    const focus = groundFocusesForLocal(local)[0];
    const receipt = buildAtlasGroundDrilldown({ worldSeed: 42, atlasCellId: 9, region, local, focus });

    // Receipt metadata remains deterministic and readable without weakening the
    // stronger object-identity promise checked immediately below.
    expect(receipt).toMatchObject({
      worldSeed: 42,
      atlasCellId: 9,
      regionSeedPath: '42/region:9',
      localSeedPath: '42/region:9/local:1200,900',
      localBounds: { x: 1000, y: 500, width: 3000, height: 3000 },
      focus: { kind: 'site', id: 7, label: 'Ash Shrine', xFt: 1300, yFt: 1100 },
      returnTarget: {
        tier: 'local',
        atlasCellId: 9,
        regionSeedPath: '42/region:9',
        localSeedPath: '42/region:9/local:1200,900',
      },
    });
    const retained = artifactsForAtlasGroundDrilldown(receipt);
    expect(retained.region).toBe(region);
    expect(retained.local).toBe(local);
    expect(groundStartForFocus(local, focus)).toEqual([91.44, 182.88]);
  });

  it('fails closed when artifact references and receipt provenance disagree', () => {
    const focus = groundFocusesForLocal(local)[0];
    const receipt = buildAtlasGroundDrilldown({ worldSeed: 42, atlasCellId: 9, region, local, focus });

    // Simulate a future load/migration bug attaching a foreign Local object to
    // otherwise valid metadata. PLAYING must never render that mixed receipt.
    const foreignLocal = { ...local, seedPath: '42/region:9/local:foreign' } as LocalArtifact;
    expect(() => artifactsForAtlasGroundDrilldown({ ...receipt, local: foreignLocal })).toThrow(
      /no longer matches/,
    );
  });

  it('rejects a focus from a different local artifact instead of approximating it', () => {
    expect(() => buildAtlasGroundDrilldown({
      worldSeed: 42,
      atlasCellId: 9,
      region,
      local,
      focus: { kind: 'site', id: 99, label: 'Foreign site', xFt: 0, yFt: 0 },
    })).toThrow(/does not belong/);
  });

  it('offers a deterministic wilderness center when a local has no town or site', () => {
    const empty = { ...local, features: [] } as LocalArtifact;
    expect(groundFocusesForLocal(empty)).toEqual([{
      kind: 'local',
      id: empty.seedPath,
      label: 'Local wilderness',
      xFt: 2500,
      yFt: 2000,
    }]);
  });

  it('derives a town entry from the exact authored building footprint', () => {
    // Two deliberately uneven plots prove the focus uses the artifact geometry rather
    // than a generic Local center or a separately generated burg approximation.
    const townLocal = {
      ...local,
      features: [],
      townPlan: {
        burgId: 12,
        identity: {
          kind: 'town',
          sourceKind: 'atlas-burg',
          sourceId: 12,
          name: 'Alderwatch',
          settlementType: 'town',
          biomeId: 6,
          hasRoadAccess: true,
          hasRiverAccess: false,
          isCoastal: false,
        },
        plots: [
          { footprint: [[1100, 700], [1300, 700]] },
          { footprint: [[1500, 900]] },
        ],
      },
    } as unknown as LocalArtifact;

    expect(groundFocusesForLocal(townLocal)).toEqual([{
      kind: 'town',
      id: 12,
      label: 'Alderwatch',
      xFt: 1300,
      yFt: 2300 / 3,
    }]);
  });

  it('replays one canonical burg name and source identity through Region, Local, and Ground focus', () => {
    const atlas = getBridgeAtlas(42);
    const burg = atlas.pack.burgs?.find((candidate) => candidate?.i && !candidate.removed);
    expect(burg?.i).toBeTypeOf('number');
    if (!burg?.i) return;

    const generated = getWorldforgeLocalForCell(42, burg.cell, {
      centerPx: [burg.x, burg.y],
    });
    const site = generated.region.townSites.find((candidate) => candidate.burgId === burg.i);
    expect(site?.identity).toMatchObject({
      sourceKind: 'atlas-burg',
      sourceId: burg.i,
      name: burg.name,
    });
    expect(generated.local.townPlan?.identity).toEqual(site?.identity);
    expect(groundFocusesForLocal(generated.local)[0]).toMatchObject({
      kind: 'town',
      id: burg.i,
      label: burg.name,
    });
  }, 30_000);

  it('strips artifact graphs into a versioned JSON address and rejects malformed versions', () => {
    const receipt = buildAtlasGroundDrilldown({
      worldSeed: 42,
      atlasCellId: 9,
      region,
      local,
      focus: groundFocusesForLocal(local)[0],
    });
    const address = atlasGroundAddressFromDrilldown(receipt);
    const serialized = JSON.stringify(address);
    const roundTripped = normalizeAtlasGroundAddress(JSON.parse(serialized));

    expect(roundTripped).toEqual(address);
    expect(serialized).not.toContain('heightfield');
    expect(serialized).not.toContain('terrain');
    expect(serialized).not.toContain('features');
    expect(normalizeAtlasGroundAddress(undefined)).toBeNull();
    expect(normalizeAtlasGroundAddress({ ...address, schemaVersion: 99 })).toBeNull();
    expect(normalizeAtlasGroundAddress({ ...address, focus: { ...address.focus, xFt: null } })).toBeNull();
  });

  it('reconstructs the exact canonical hierarchy after JSON reload', () => {
    const atlas = getBridgeAtlas(42);
    const atlasCellId = Array.from(atlas.pack.cells.h).findIndex((height) => height >= 20);
    const original = getWorldforgeLocalForCell(42, atlasCellId);
    const originalReceipt = buildAtlasGroundDrilldown({
      worldSeed: 42,
      atlasCellId,
      region: original.region,
      local: original.local,
      focus: groundFocusesForLocal(original.local)[0],
    });
    const savedAddress = JSON.parse(
      JSON.stringify(atlasGroundAddressFromDrilldown(originalReceipt)),
    );

    const restored = restoreAtlasGroundDrilldown(savedAddress, 42);

    expect(restored.status).toBe('ready');
    if (restored.status !== 'ready') return;
    expect(restored.drilldown.region).not.toBe(original.region);
    expect(restored.drilldown.local).not.toBe(original.local);
    expect(restored.drilldown.regionSeedPath).toBe(originalReceipt.regionSeedPath);
    expect(restored.drilldown.localSeedPath).toBe(originalReceipt.localSeedPath);
    expect(restored.drilldown.localBounds).toEqual(originalReceipt.localBounds);
    expect(restored.drilldown.focus).toEqual(originalReceipt.focus);
    expect(Array.from(restored.drilldown.region.heightfield.samples)).toEqual(
      Array.from(original.region.heightfield.samples),
    );
    expect(Array.from(restored.drilldown.local.terrain.materialIndex)).toEqual(
      Array.from(original.local.terrain.materialIndex),
    );
  }, 30_000);

  it('rejects stale cell, seed path, bounds, and focus addresses instead of approximating', () => {
    const atlas = getBridgeAtlas(42);
    const atlasCellId = Array.from(atlas.pack.cells.h).findIndex((height) => height >= 20);
    const generated = getWorldforgeLocalForCell(42, atlasCellId);
    const receipt = buildAtlasGroundDrilldown({
      worldSeed: 42,
      atlasCellId,
      region: generated.region,
      local: generated.local,
      focus: groundFocusesForLocal(generated.local)[0],
    });
    const address = atlasGroundAddressFromDrilldown(receipt);

    expect(
      restoreAtlasGroundDrilldown({ ...address, atlasCellId: Number.MAX_SAFE_INTEGER }, 42).status,
    ).toBe('rejected');
    expect(
      restoreAtlasGroundDrilldown({ ...address, regionSeedPath: `${address.regionSeedPath}/stale` }, 42).status,
    ).toBe('rejected');
    expect(
      restoreAtlasGroundDrilldown({
        ...address,
        localBounds: { ...address.localBounds, x: address.localBounds.x + 1 },
      }, 42).status,
    ).toBe('rejected');
    expect(
      restoreAtlasGroundDrilldown({
        ...address,
        focus: { ...address.focus, xFt: address.focus.xFt + 1 },
      }, 42).status,
    ).toBe('rejected');
  }, 30_000);
});
