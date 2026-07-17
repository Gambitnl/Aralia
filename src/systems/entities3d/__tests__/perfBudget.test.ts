/**
 * @file perfBudget.test.ts — FPS guardrails: triangle budgets are a regression
 * gate, and identical segment dimensions share geometry across entities.
 */
import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { assembleEntity } from '../three/assembleEntity';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { registerAllParts } from '../parts';
import { PLAN_FIXTURES } from '../textPlan/fixtures';

registerAllParts();

describe('triangle budgets (solid mode)', () => {
  it('a humanoid stays under 12k body triangles', () => {
    const bp = generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'perf-1' });
    const handle = assembleEntity(bp, { renderMode: 'solid' });
    handle.update(0.5, 1 / 60);
    expect(handle.stats().triangles).toBeLessThan(12_000);
    handle.dispose();
  });

  it('every plan fixture stays under 30k body triangles', () => {
    for (const [key, plan] of Object.entries(PLAN_FIXTURES)) {
      const handle = assembleEntity(generateEntityBlueprint({ kind: 'planned', plan, seed: 'perf' }), { renderMode: 'solid' });
      handle.update(0.5, 1 / 60);
      expect(handle.stats().triangles, `${key} budget`).toBeLessThan(30_000);
      handle.dispose();
    }
  });
});

describe('shared geometry cache', () => {
  it('equal segment dimensions share one geometry across entities', () => {
    const a = assembleEntity(generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'geo-1' }), { renderMode: 'solid' });
    const b = assembleEntity(generateEntityBlueprint({ kind: 'humanoid', raceId: 'human', classId: 'fighter', seed: 'geo-1' }), { renderMode: 'solid' });
    a.update(0.1, 1 / 60);
    b.update(0.1, 1 / 60);
    const geoOf = (h: typeof a, name: string) => {
      const node = h.group.getObjectByName(name)!;
      let g: unknown = null;
      node.traverse((o) => {
        if (!g && (o as Mesh).isMesh) g = (o as Mesh).geometry;
      });
      return g;
    };
    const ga = geoOf(a, 'seg:torso.chest');
    const gb = geoOf(b, 'seg:torso.chest');
    expect(ga, 'geometry missing').toBeTruthy();
    expect(ga).toBe(gb); // same instance — the cache is real
    a.dispose();
    // b still works after a's dispose (refcounted, not destroyed)
    expect(() => b.update(0.2, 1 / 60)).not.toThrow();
    b.dispose();
  });
});
