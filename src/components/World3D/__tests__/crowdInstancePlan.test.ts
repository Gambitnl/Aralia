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
  it('uses source ancestry for a joined resident instead of rerolling it from the roster id', () => {
    expect(groupForOccupant(84)).toBe('Dwarf'); // actual Fenna regression
    const nodes=[node({burgId:675,occupantId:84}),node({burgId:676,occupantId:84})];
    const result=crowdInstancePlan(nodes,0,new Map(),new Map([['675:84','Human']]));
    expect(result.map(r=>r.group)).toEqual(['Human','Dwarf']);
  });

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

  // NPC life (2026-11-02): people at an errand place face their group and
  // talk or listen; walkers and people with no group keep the gait frames.
  it('faces an errand group and gives its members a talk or listen frame', () => {
    const headings = new Map<number, { x: number; z: number; yaw: number }>();
    const members = Array.from({ length: 40 }, (_, i) => node({ occupantId: 100 + i, xM: 10, zM: 10, faceXM: 10, faceZM: 12 }));
    const plan = crowdInstancePlan(members, 1.5, headings);
    for (const inst of plan) {
      expect(Math.abs(inst.yaw)).toBeLessThan(1e-9); // the face point lies in +z
      expect(['talk', 'listen']).toContain(inst.activity);
      expect(inst.activityFrame).toBeGreaterThanOrEqual(0);
      expect(inst.phaseIdx).toBe(0);
    }
    const talkers = plan.filter((p) => p.activity === 'talk').length;
    expect(talkers).toBeGreaterThan(10);
    expect(talkers).toBeLessThan(35);
  });

  it('gives no activity to walkers or to people outside a group', () => {
    const plan = crowdInstancePlan([
      node({ occupantId: 1, moving: true, faceXM: 1, faceZM: 1 }),
      node({ occupantId: 2 }),
    ], 2, new Map());
    expect(plan[0].activity).toBeUndefined();
    expect(plan[1].activity).toBeUndefined();
  });

  it('steps a talker through its frames over time', () => {
    const frames = new Set<number>();
    for (let t = 0; t < 4; t += 0.1) {
      const inst = crowdInstancePlan([node({ occupantId: 3, faceXM: 0, faceZM: 50 })], t, new Map())[0];
      if (inst.activity) frames.add(inst.activityFrame!);
    }
    expect(frames.size).toBeGreaterThan(1);
  });
});
