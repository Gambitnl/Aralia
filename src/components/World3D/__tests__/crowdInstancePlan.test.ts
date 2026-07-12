/**
 * @file crowdInstancePlan.test.ts — pure bucketing for the instanced crowd:
 * stable ancestry per agent, idle vs walk phases, headings from motion.
 */
import { describe, it, expect } from 'vitest';
import { crowdInstancePlan, groupForOccupant, CROWD_GROUPS } from '../crowdInstancePlan';
import type { GroundAgentSceneNode } from '@/systems/worldforge/bridge/groundAgentMotion';

const node = (over: Partial<GroundAgentSceneNode> & { occupantId: number }): GroundAgentSceneNode =>
  ({
    burgId: 1,
    name: 'X',
    xM: 10,
    zM: 10,
    moving: false,
    activity: 'home',
    gridX: 2,
    gridY: 2,
    surfaceY: 5,
    ...over,
  }) as GroundAgentSceneNode;

describe('groupForOccupant', () => {
  it('is stable per id and skews human', () => {
    expect(groupForOccupant(11)).toBe(groupForOccupant(11));
    const counts = new Map<string, number>();
    for (let id = 0; id < 300; id++) {
      const g = groupForOccupant(id);
      expect(CROWD_GROUPS).toContain(g);
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    const human = counts.get('Human') ?? 0;
    expect(human).toBeGreaterThan(60); // weighted toward Human
    expect(counts.size).toBeGreaterThan(4); // but mixed
  });
});

describe('crowdInstancePlan', () => {
  it('assigns idle agents phase 0 and walkers a walk phase', () => {
    const headings = new Map<number, { x: number; z: number; yaw: number }>();
    const plan = crowdInstancePlan(
      [node({ occupantId: 1, moving: false }), node({ occupantId: 2, moving: true })],
      3.2,
      headings,
    );
    expect(plan[0].phaseIdx).toBe(0);
    expect(plan[1].phaseIdx).toBeGreaterThan(0);
  });

  it('derives yaw from movement between ticks', () => {
    const headings = new Map<number, { x: number; z: number; yaw: number }>();
    crowdInstancePlan([node({ occupantId: 5, moving: true, gridX: 2, gridY: 2 })], 0, headings);
    const plan = crowdInstancePlan([node({ occupantId: 5, moving: true, gridX: 3, gridY: 2 })], 0.3, headings);
    // moved +x → yaw ~ atan2(dx, dz) = atan2(+, 0) ≈ π/2
    expect(Math.abs(plan[0].yaw - Math.PI / 2)).toBeLessThan(0.2);
  });

  it('jitters scale deterministically around 1', () => {
    const headings = new Map<number, { x: number; z: number; yaw: number }>();
    const a = crowdInstancePlan([node({ occupantId: 9 })], 1, headings)[0].scale;
    const b = crowdInstancePlan([node({ occupantId: 9 })], 2, headings)[0].scale;
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0.85);
    expect(a).toBeLessThan(1.15);
  });
});
