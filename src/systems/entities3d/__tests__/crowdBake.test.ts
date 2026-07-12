/**
 * @file crowdBake.test.ts — crowd stand-ins: an entity baked to static
 * walk-cycle keyframe geometries (slice 5 groundwork).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { bakeCrowdArchetype, crowdArchetypeForGroup, CROWD_WALK_PHASES } from '../three/crowdBake';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { recipeFromOccupant } from '../recipeFromOccupant';
import { registerAllParts } from '../parts';
import { heightM } from '../types';

describe('bakeCrowdArchetype', () => {
  beforeAll(() => registerAllParts());

  it('bakes one idle + N walk phase geometries with positions, normals, and colors', () => {
    const bp = generateEntityBlueprint(recipeFromOccupant({ id: 42, ageBand: 'adult', race: 'Elf' }));
    const arch = bakeCrowdArchetype(bp);
    expect(arch.geometries.length).toBe(CROWD_WALK_PHASES + 1); // [idle, ...walk]
    for (const g of arch.geometries) {
      expect(g.attributes.position.count).toBeGreaterThan(200);
      expect(g.attributes.normal.count).toBe(g.attributes.position.count);
      expect(g.attributes.color.count).toBe(g.attributes.position.count);
    }
    expect(arch.heightM).toBeCloseTo(heightM(bp.frame), 3);
  });

  it('walk phases differ from each other (legs actually move)', () => {
    const bp = generateEntityBlueprint(recipeFromOccupant({ id: 7, ageBand: 'adult', race: 'Human' }));
    const arch = bakeCrowdArchetype(bp);
    const a = arch.geometries[1].attributes.position;
    const b = arch.geometries[1 + Math.floor(CROWD_WALK_PHASES / 2)].attributes.position;
    let maxDelta = 0;
    const n = Math.min(a.count, b.count);
    for (let i = 0; i < n; i += 7) {
      maxDelta = Math.max(maxDelta, Math.abs(a.getY(i) - b.getY(i)), Math.abs(a.getZ(i) - b.getZ(i)));
    }
    expect(maxDelta).toBeGreaterThan(0.02);
  });

  it('caches archetypes per ancestry group and is deterministic', () => {
    const a = crowdArchetypeForGroup('Dwarf');
    const b = crowdArchetypeForGroup('Dwarf');
    expect(a).toBe(b); // cached
    expect(a.geometries[0].attributes.position.count).toBeGreaterThan(200);
    const elf = crowdArchetypeForGroup('Elf');
    expect(elf).not.toBe(a);
  });
});
