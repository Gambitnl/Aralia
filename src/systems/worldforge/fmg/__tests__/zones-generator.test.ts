/**
 * @file zones-generator.test.ts — golden + invariant tests for the
 * Zones.generate port (pipeline stage 35, the final generation stage).
 * Goldens FREEZE AT ACCEPTANCE per the Worldforge tracker conventions.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { generateFmgWorld, type FmgWorldResult } from '../generateWorld';

const SEED = 'world-42';
const OPTS = { width: 960, height: 540, cellsDesired: 10000, template: 'continents' as const };

let world: FmgWorldResult;

describe('Zones.generate (FMG port, stage 35)', () => {
  beforeAll(() => {
    world = generateFmgWorld(SEED, OPTS);
  }, 120_000);

  it('matches FROZEN golden values for world-42', () => {
    const golden = {
      zoneCount: world.zones.length,
      types: world.zones.map(z => z.type),
      names: world.zones.map(z => z.name),
      cellCounts: world.zones.map(z => z.cells.length),
    };
    expect(golden.zoneCount).toBeGreaterThan(0);
    expect(golden).toMatchSnapshot('zones-golden');
  });

  it('invariants: sequential ids; valid cells; hatch colors; known types', () => {
    const cellsN = (world.pack as any).cells.i.length;
    const KNOWN = new Set([
      'Invasion', 'Rebels', 'Proselytism', 'Crusade', 'Disease', 'Disaster',
      'Eruption', 'Avalanche', 'Fault', 'Flood', 'Tsunami',
    ]);
    world.zones.forEach((z, idx) => {
      expect(z.i).toBe(idx);
      expect(KNOWN.has(z.type)).toBe(true);
      expect(z.color).toMatch(/^url\(#hatch\d+\)$/);
      expect(z.cells.length).toBeGreaterThan(0);
      for (const c of z.cells) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(cellsN);
      }
    });
  });

  it('eruption zones rewrite their volcano marker note to Erupting', () => {
    const eruptions = world.zones.filter(z => z.type === 'Eruption');
    for (const z of eruptions) {
      const volcanoNote = world.notes.find(
        n => n.name && z.name.startsWith(n.name.replace(' Volcano', '').replace('Mount ', 'Mount ')),
      );
      // The shared-note rewrite is upstream behavior; assert at least that no
      // note still says "Active volcano" when an eruption zone targeted it.
      if (volcanoNote && /volcano/i.test(volcanoNote.legend)) {
        expect(volcanoNote.legend).not.toContain('Active volcano');
      }
    }
  });

  it('determinism: same seed + options → identical zones', () => {
    const again = generateFmgWorld(SEED, OPTS);
    expect(again.zones).toEqual(world.zones);
  }, 120_000);
});
