/**
 * The material registry.
 *
 * Two kinds of test here. The first kind guards against DRIFT: the voxel enum
 * and the registry are two lists that must stay identical, and nothing but a
 * test keeps them so. The second kind guards the PROPERTIES, because a number
 * that is merely plausible is worth nothing — clay must actually hold water and
 * gravel must actually leak, or the properties are decoration.
 */
import { describe, it, expect } from 'vitest';
import { Material } from '../voxelVolume';
import {
  SUBSTANCES,
  substance,
  BIOME_GROUND,
  groundStackForBiome,
  substanceAtDepth,
  colorAtDepth,
  digSecondsPerM3,
  holdsWater,
  DEFAULT_STACK,
} from '../materials';

/** Every value the enum defines. Kept literal on purpose — see the drift test. */
const ALL: Material[] = [
  Material.Air, Material.Litter, Material.Turf, Material.Peat,
  Material.Topsoil, Material.Subsoil, Material.Clay, Material.Silt,
  Material.Sand, Material.Gravel, Material.Hardpan, Material.Permafrost,
  Material.Limestone, Material.Sandstone, Material.Granite,
  Material.Ice, Material.Snow, Material.Water,
];

describe('the registry does not drift from the enum', () => {
  it('registers every material, with no gaps', () => {
    for (const m of ALL) {
      expect(substance(m), `material ${m}`).toBeDefined();
      expect(substance(m).id).toBe(m);
    }
  });

  it('holds nothing the enum does not define', () => {
    // A stale entry left behind after an enum change would sit here forever,
    // reachable by no voxel and noticed by nobody.
    expect(Object.keys(SUBSTANCES).length).toBe(ALL.length);
  });

  it('gives every substance a distinct label', () => {
    const labels = ALL.map((m) => substance(m).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('throws rather than guessing at an unknown material', () => {
    expect(() => substance(99 as Material)).toThrow(/No substance/);
  });
});

describe('the numbers mean something', () => {
  it('keeps every color LINEAR and dark enough to survive sRGB', () => {
    /* The fault this catches has already happened once. Values picked to look
     * like soil in a color picker are sRGB values, and feeding them in as
     * linear renders the ground as a bright sand dune. Only snow and ice have
     * any business being bright. */
    for (const m of ALL) {
      const s = substance(m);
      for (const c of s.rgb) {
        expect(c, `${s.label} channel`).toBeGreaterThanOrEqual(0);
        expect(c, `${s.label} channel`).toBeLessThanOrEqual(1);
      }
      if (m !== Material.Snow && m !== Material.Ice && m !== Material.Air) {
        expect(Math.max(...s.rgb), `${s.label} is too bright to be linear`).toBeLessThan(0.4);
      }
    }
  });

  it('orders hardness the way the world does', () => {
    const h = (m: Material) => substance(m).hardness;
    expect(h(Material.Litter)).toBeLessThan(h(Material.Topsoil));
    expect(h(Material.Topsoil)).toBeLessThan(h(Material.Subsoil));
    expect(h(Material.Subsoil)).toBeLessThan(h(Material.Hardpan));
    expect(h(Material.Hardpan)).toBeLessThan(h(Material.Limestone));
    expect(h(Material.Limestone)).toBeLessThan(h(Material.Granite));
  });

  it('spans the real range of permeability, gravel to granite', () => {
    // Eight orders of magnitude is not decoration. It is the difference between
    // a basin that holds a lake and one that empties overnight.
    const gravel = substance(Material.Gravel).permeabilityMS;
    const granite = substance(Material.Granite).permeabilityMS;
    expect(gravel / granite).toBeGreaterThan(1e6);
  });

  it('says clay holds water and gravel does not', () => {
    expect(holdsWater(Material.Clay)).toBe(true);
    expect(holdsWater(Material.Permafrost)).toBe(true);
    expect(holdsWater(Material.Gravel)).toBe(false);
    expect(holdsWater(Material.Sand)).toBe(false);
  });

  it('lets loose material slump and rock stand', () => {
    expect(substance(Material.Sand).angleOfReposeDeg).toBeLessThan(40);
    expect(substance(Material.Granite).angleOfReposeDeg).toBeGreaterThan(80);
  });

  it('makes ice the slipperiest thing in the world', () => {
    const solids = ALL.filter((m) => substance(m).state !== 'gas' && m !== Material.Water);
    const min = Math.min(...solids.map((m) => substance(m).friction));
    expect(substance(Material.Ice).friction).toBe(min);
  });
});

describe('digging', () => {
  it('makes granite hundreds of times the work of topsoil, not twice', () => {
    // Hardness enters as a cube for exactly this reason. On a linear scale
    // every substance dug at roughly the same speed and the stack was pointless.
    const soil = digSecondsPerM3(Material.Topsoil);
    const rock = digSecondsPerM3(Material.Granite);
    expect(rock / soil).toBeGreaterThan(100);
  });

  it('costs nothing to move air or water', () => {
    expect(digSecondsPerM3(Material.Air)).toBe(0);
    expect(digSecondsPerM3(Material.Water)).toBe(0);
  });

  it('gets faster with more power, in proportion', () => {
    expect(digSecondsPerM3(Material.Subsoil, 2)).toBeCloseTo(
      digSecondsPerM3(Material.Subsoil, 1) / 2,
      6,
    );
  });
});

describe('biome stacks', () => {
  it('covers the whole closed vocabulary, 0 to 12', () => {
    for (let id = 0; id <= 12; id++) {
      expect(groundStackForBiome(id).length, `biome ${id}`).toBeGreaterThan(1);
    }
  });

  it('throws on a biome outside the vocabulary', () => {
    // Mirrors climateForBiomeId. An unmapped biome must fail, not become forest.
    expect(() => groundStackForBiome(13)).toThrow(/No ground stack/);
    expect(() => groundStackForBiome(-1)).toThrow(/No ground stack/);
  });

  it('ends every stack in rock that reaches forever', () => {
    // A stack that runs out leaves a depth with no substance, and the caller
    // then has to invent one. Bottoming out in endless rock removes the case.
    for (let id = 0; id <= 12; id++) {
      const stack = groundStackForBiome(id);
      const last = stack[stack.length - 1];
      expect(last.depthM, `biome ${id}`).toBe(Infinity);
      expect(substance(last.substance).state, `biome ${id}`).toBe('solid');
      expect(substance(last.substance).hardness, `biome ${id}`).toBeGreaterThan(0.5);
    }
  });

  it('orders every stack by increasing depth', () => {
    for (let id = 0; id <= 12; id++) {
      const stack = groundStackForBiome(id);
      for (let i = 1; i < stack.length; i++) {
        expect(stack[i].depthM, `biome ${id} band ${i}`).toBeGreaterThan(stack[i - 1].depthM);
      }
    }
  });

  it('makes DIGGING tell you where you are', () => {
    /* The point of per-biome stacks. A shovel one meter down should meet a
     * different substance in a bog, a desert and a glacier. If these agreed,
     * the whole table could be replaced by one stack. */
    const oneMeter = (id: number) => substanceAtDepth(1, groundStackForBiome(id)).label;
    expect(oneMeter(12)).toBe('peat'); // wetland
    expect(oneMeter(1)).toBe('sand'); // hot desert
    expect(oneMeter(11)).toBe('ice'); // glacier
    expect(oneMeter(6)).toBe('subsoil'); // temperate forest
    expect(new Set([oneMeter(12), oneMeter(1), oneMeter(11), oneMeter(6)]).size).toBe(4);
  });

  it('puts a wetland on ground that HOLDS water', () => {
    // A bog over gravel would drain, and would not be a bog.
    expect(holdsWater(substanceAtDepth(3, groundStackForBiome(12)).id)).toBe(true);
  });

  it('puts a hot desert on ground that does NOT hold water', () => {
    expect(holdsWater(substanceAtDepth(0.5, groundStackForBiome(1)).id)).toBe(false);
  });
});

describe('depth queries', () => {
  it('reads the surface substance at zero depth', () => {
    expect(substanceAtDepth(0, DEFAULT_STACK).label).toBe('leaf litter');
  });

  it('reaches rock below the last finite band', () => {
    expect(substanceAtDepth(500, DEFAULT_STACK).label).toBe('granite');
  });

  it('BLENDS color across a boundary rather than switching', () => {
    // A hard switch draws a contour line down a cut face. A real soil horizon
    // is a few centimeters thick.
    const above = colorAtDepth(0.05, DEFAULT_STACK);
    const mid = colorAtDepth(0.115, DEFAULT_STACK);
    const below = colorAtDepth(0.3, DEFAULT_STACK);
    expect(mid[0]).toBeGreaterThan(above[0]);
    expect(mid[0]).toBeLessThan(below[0]);
  });

  it('gets LIGHTER with depth, which is what real ground does', () => {
    const shallow = colorAtDepth(0.02, DEFAULT_STACK);
    const deep = colorAtDepth(50, DEFAULT_STACK);
    expect(deep[0]).toBeGreaterThan(shallow[0]);
  });
});
