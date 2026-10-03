/**
 * These tests prove that World3D box batching preserves building authorship.
 *
 * The renderer may draw many boxes through one GPU object, but each result must
 * retain its original dimensions, generated colour, rotation, position and source
 * identity. The tests exercise detailed buildings, legacy shells, marker cubes and
 * the tactical-only exclusion used by the production renderer.
 */

import { describe, expect, it } from 'vitest';
import type { LoadedChunk } from '../types';
import { buildSiteBoxBatches, buildSiteRoofBatches } from '../siteBoxBatches';

type StreamedSite = LoadedChunk['bundle']['sites'][number];

/** Supply only the required site fields so each test highlights one contract. */
function site(overrides: Partial<StreamedSite>): StreamedSite {
  return {
    id: 'site',
    kind: 'ruin',
    localX: 0,
    localZ: 0,
    radius: 2,
    surfaceY: 0,
    walled: false,
    ...overrides,
  };
}

describe('buildSiteBoxBatches', () => {
  it('shares a colour bucket while preserving unique part transforms and dimensions', () => {
    const batches = buildSiteBoxBatches([
      site({
        id: 'crooked-tavern',
        localX: 10,
        localZ: 20,
        surfaceY: 3,
        rotationY: Math.PI / 2,
        doorZSign: -1,
        boxWidth: 8,
        boxDepth: 6,
        boxHeight: 5,
        parts: [
          { x: 2, z: 1, w: 4, d: 0.3, h: 3, colorHex: '#AABBCC' },
          { x: -1, z: 0, w: 0.8, d: 0.8, h: 2, baseY: 1, colorHex: '#aabbcc' },
        ],
      }),
    ]);

    // Case-only colour differences share one draw bucket, while the records keep
    // the first exact generated colour and both independently authored boxes.
    expect(batches).toHaveLength(1);
    expect(batches[0].colorHex).toBe('#AABBCC');
    expect(batches[0].instances).toEqual([
      {
        sourceId: 'crooked-tavern:part:0',
        x: 11,
        y: 4.5,
        z: 18,
        rotationY: Math.PI / 2,
        width: 4,
        height: 3,
        depth: 0.3,
      },
      {
        sourceId: 'crooked-tavern:part:1',
        x: 10,
        y: 5,
        z: 21,
        rotationY: Math.PI / 2,
        width: 0.8,
        height: 2,
        depth: 0.8,
      },
    ]);
  });

  it('omits tactical-only shared walls without losing original part indices', () => {
    const batches = buildSiteBoxBatches([
      site({
        id: 'row-house',
        boxWidth: 5,
        boxDepth: 5,
        boxHeight: 4,
        parts: [
          { x: 0, z: 0, w: 1, d: 1, h: 1, colorHex: '#111111', renderRole: 'tactical-only' },
          { x: 1, z: 0, w: 1, d: 1, h: 1, colorHex: '#222222' },
        ],
      }),
    ]);

    expect(batches.flatMap((batch) => batch.instances).map((instance) => instance.sourceId))
      .toEqual(['row-house:part:1']);
  });

  it('preserves legacy shells and non-building marker cubes', () => {
    const batches = buildSiteBoxBatches([
      site({
        id: 'unique-cottage',
        kind: 'town',
        localX: 4,
        localZ: 7,
        surfaceY: 2,
        rotationY: 0.4,
        boxWidth: 9,
        boxDepth: 5,
        boxHeight: 6,
        colorHex: '#765432',
      }),
      site({
        id: 'old-dungeon',
        kind: 'dungeon',
        localX: -3,
        localZ: 8,
        surfaceY: 1,
        radius: 4,
      }),
      site({
        id: 'label-only-town',
        kind: 'town',
        markerOnly: true,
      }),
    ]);

    expect(batches.flatMap((batch) => batch.instances)).toEqual([
      {
        sourceId: 'unique-cottage:shell',
        x: 4,
        y: 5,
        z: 7,
        rotationY: 0.4,
        width: 9,
        height: 6,
        depth: 5,
      },
      {
        sourceId: 'old-dungeon:marker',
        x: -3,
        y: 3,
        z: 8,
        rotationY: 0,
        width: 4,
        height: 4,
        depth: 4,
      },
    ]);
  });

  it('uses an authored building shell outside the full-detail LOD ring', () => {
    const batches = buildSiteBoxBatches([
      site({
        id: 'distant-tavern',
        kind: 'town',
        localX: 12,
        localZ: -8,
        surfaceY: 2,
        rotationY: 0.7,
        boxWidth: 11,
        boxDepth: 7,
        boxHeight: 6,
        colorHex: '#73553a',
        parts: [
          { x: 1, z: 2, w: 0.4, d: 3, h: 2, colorHex: '#abcdef' },
          { x: -2, z: 0, w: 1, d: 1, h: 1, colorHex: '#fedcba' },
        ],
      }),
    ], 'shell');

    expect(batches.flatMap((batch) => batch.instances)).toEqual([
      {
        sourceId: 'distant-tavern:lod-shell',
        x: 12,
        y: 5,
        z: -8,
        rotationY: 0.7,
        width: 11,
        height: 6,
        depth: 7,
      },
    ]);
  });

  it('batches scale-invariant roofs without normalizing their authored differences', () => {
    const batches = buildSiteRoofBatches([
      site({
        id: 'gable-inn',
        localX: 5,
        localZ: 8,
        surfaceY: 2,
        rotationY: 0.3,
        boxWidth: 10,
        boxDepth: 6,
        boxHeight: 5,
        roofForm: 'gable',
        roofColorHex: '#994422',
      }),
      site({
        id: 'hip-house',
        localX: -4,
        localZ: 3,
        surfaceY: 1,
        boxWidth: 7,
        boxDepth: 9,
        boxHeight: 4,
        roofForm: 'hip',
      }),
      site({
        id: 'flat-shop',
        boxWidth: 8,
        boxDepth: 8,
        boxHeight: 4,
        roofForm: 'flat',
      }),
    ]);

    expect(batches.map((batch) => batch.form)).toEqual(['gable', 'hip']);
    expect(batches[0].instances[0]).toEqual({
      sourceId: 'gable-inn:roof',
      x: 5,
      y: 7,
      z: 8,
      rotationY: 0.3,
      width: 10.8,
      rise: 3,
      depth: 6.48,
      colorHex: '#994422',
    });
    expect(batches.flatMap((batch) => batch.instances).map((roof) => roof.sourceId))
      .not.toContain('flat-shop:roof');
  });
});
