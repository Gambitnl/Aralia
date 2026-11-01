// @vitest-environment node
/** Exercise the production boundary: old worlds keep their original props;
 * explicit new worlds retain their first measured yard before later re-entry. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as baseline from '../groundProps';
import { computeGroundProps, type GroundWorld } from '../groundChunkLoader';
import type { PropInstance } from '../../props/propSchema';

function ground(): GroundWorld {
  return { cols: 41, rows: 41, heights: Array(41 * 41).fill(0), boundsFeet: { x: 0, y: 0 },
    extentMetersX: 60.96, extentMetersZ: 60.96, buildings: [{ id: 'wf-plot-1-0', xM: 20, zM: 20,
      cornersM: [{ x: 13, z: 17 }, { x: 27, z: 17 }, { x: 27, z: 23 }, { x: 13, z: 23 }],
      frontDoorOffsetX: 0, frontDoorOffsetZ: -3 }], roads: [], props: [] } as unknown as GroundWorld;
}
const pile: PropInstance = { defId: 'woodpile', xM: 20, zM: 20, rotationRad: 0, variation: { scale: 1, variant: 0 } };
function candidates() {
  vi.spyOn(baseline, 'groundPropsGateSummary').mockReturnValue('');
  return vi.spyOn(baseline, 'buildGroundPropsInstrumented').mockReturnValue({ props: [pile],
    gateStats: { total: { considered: 1, kept: 1, rejected: 0, byReason: {} }, byPass: {} },
    placementSurface: undefined, placement: undefined,
  } as unknown as ReturnType<typeof baseline.buildGroundPropsInstrumented>);
}
afterEach(() => vi.restoreAllMocks());

describe('ground prop generation selection', () => {
  it('preserves legacy output and object shape when revision is absent or one', () => {
    candidates();
    for (const revision of [undefined, 1] as const) {
      const g = ground(), before = JSON.stringify(pile);
      expect(computeGroundProps(g, 42, undefined, { propGenerationRevision: revision })).toEqual([pile]);
      expect(Object.hasOwn(g, 'propSource')).toBe(false);
      expect(JSON.stringify(pile)).toBe(before);
    }
  });

  it('measures a new yard once and replays its exact source without generating again', () => {
    const generate = candidates(), g = ground();
    const props = computeGroundProps(g, 42, undefined, { propGenerationRevision: 2, anchorCellId: 7 });
    expect(g.propSource).toBeDefined();
    expect(g.propSource!.report).toMatchObject({ considered: 1, kept: 1, moved: 1 });
    expect(props[0].xM === pile.xM && props[0].zM === pile.zM).toBe(false);
    const source = JSON.parse(JSON.stringify(g.propSource)), saved = JSON.stringify(source);
    generate.mockClear().mockImplementation(() => { throw Error('must not regenerate an established yard'); });
    const later = ground(); later.buildings = [];
    const loaded = computeGroundProps(later, 42, undefined, { propGenerationRevision: 2, anchorCellId: 7,
      propSources: { [source.key]: source } });
    expect(loaded).toEqual(props); expect(generate).not.toHaveBeenCalled();
    loaded[0].xM++;
    expect(JSON.stringify(source)).toBe(saved);
    expect(later.propSource).toEqual(source); expect(later.propSource).not.toBe(source);
  });

  it('refuses unsupported versions, missing addresses and corrupt established sources before generation', () => {
    const generate = candidates(), g = ground();
    expect(() => computeGroundProps(g, 42, undefined, { propGenerationRevision: 3 as 2 })).toThrow('Unsupported');
    expect(() => computeGroundProps(g, 42, undefined, { propGenerationRevision: 2 })).toThrow('atlas cell');
    expect(generate).not.toHaveBeenCalled();
    computeGroundProps(g, 42, undefined, { propGenerationRevision: 2, anchorCellId: 7 });
    const source = structuredClone(g.propSource!); source.props[0].xM++;
    generate.mockClear();
    expect(() => computeGroundProps(ground(), 42, undefined, { propGenerationRevision: 2, anchorCellId: 7,
      propSources: { [source.key]: source } })).toThrow('Invalid saved');
    expect(generate).not.toHaveBeenCalled();
  });
});
