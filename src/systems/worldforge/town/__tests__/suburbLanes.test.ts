/** GG-604: the lanes between suburb blocks are streets.
 * Each suburb block is pulled in from its cell by about half a lane, but that
 * lane was not a street, so a row that faced it had no way out except through
 * the row behind (demo town: 27 of 674 fitted doors cut a neighbor). The real
 * current-layout demo town is the fixture; revision 1 does not use this pass. */
import { beforeAll, describe, expect, it } from 'vitest';
import { getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { getCanonicalTownPlan } from '../canonicalTown';
import { toArtifactPlan } from '../townPlanAdapter';
import { buildStreetGraph, type Point, type StreetGraph } from '../../roster/agentPath';
import type { TownPlan as EnginePlan } from '../townEngine';
import type { TownPlan as ArtifactPlan } from '../../artifacts';

const SEED = 42, BURG = 14;
let engine: EnginePlan, plan: ArtifactPlan, graph: StreetGraph;
beforeAll(() => {
  engine = getCanonicalTownPlan(getBridgeAtlas(SEED), SEED, BURG);
  plan = toArtifactPlan(engine, BURG).plan;
  graph = buildStreetGraph(plan);
}, 120000);

const inPolygon = (p: Point, poly: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
/** Feet of the straight line a -> b inside a plot other than `own` (2 ft samples). */
const insideOtherFt = (a: Point, b: Point, own: number): number => {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(length / 2));
  let inside = 0;
  for (let k = 0; k < n; k++) {
    const p: Point = [a[0] + ((b[0] - a[0]) * (k + 0.5)) / n, a[1] + ((b[1] - a[1]) * (k + 0.5)) / n];
    if (plan.plots.some((q) => q.id !== own && inPolygon(p, q.footprint as Point[]))) inside += length / n;
  }
  return inside;
};

describe('suburb lanes (GG-604)', () => {
  it('emits the suburb lanes as narrow passages that serve no back court', () => {
    const lanes = engine.streetNetwork.filter((s) => s.role === 'passage' && s.tier === 'lane' && !s.serves);
    expect(lanes.length).toBeGreaterThan(20);
    const laneWidth = Math.min(...engine.streetNetwork.filter((s) => s.role !== 'passage' && s.tier === 'lane').map((s) => s.width));
    // Half a lane: a suburb lot keeps more than a quarter lane from the lane line.
    for (const lane of lanes) expect(lane.width).toBeLessThanOrEqual(laneWidth / 2 + 1e-9);
  });

  it('gives every door a step to a street that crosses no other plot', () => {
    const crossing = [...graph.plotEntrances.values()].filter((e) => insideOtherFt(e.door, e.streetPoint, e.plotId) > 1);
    expect(graph.plotEntrances.size).toBe(plan.plots.length);
    expect(crossing.map((e) => e.plotId)).toEqual([]);
  });

  it('joins every door to one street network, so no lane is an island', () => {
    const component = new Array<number>(graph.nodes.length).fill(-1);
    let count = 0;
    for (let start = 0; start < graph.nodes.length; start++) {
      if (component[start] >= 0) continue;
      const stack = [start];
      component[start] = count;
      while (stack.length > 0) {
        for (const edge of graph.adj[stack.pop()!]) {
          if (component[edge.to] < 0) { component[edge.to] = count; stack.push(edge.to); }
        }
      }
      count++;
    }
    const reached = new Set([...graph.plotEntrances.values()].map((e) => component[graph.segments[e.streetSegmentIndex].fromNode]));
    expect(reached.size).toBe(1);
  });

  it('runs no lane through a house', () => {
    // Artifact street ids follow the network order (streets with two or more
    // points), so the suburb lanes keep their network identity here.
    const network = engine.streetNetwork.filter((s) => s.centerline.length >= 2);
    const laneIds = new Set(network.flatMap((s, id) => (s.role === 'passage' && s.tier === 'lane' && !s.serves ? [id] : [])));
    const lanes = plan.streets.filter((s) => laneIds.has(s.id));
    let inside = 0, total = 0;
    for (const lane of lanes) {
      for (let i = 1; i < lane.centerline.length; i++) {
        total += Math.hypot(lane.centerline[i][0] - lane.centerline[i - 1][0], lane.centerline[i][1] - lane.centerline[i - 1][1]);
        inside += insideOtherFt(lane.centerline[i - 1], lane.centerline[i], -1);
      }
    }
    expect(total).toBeGreaterThan(1000);
    // A lane may graze a house corner where it meets a road; never more.
    expect(inside / total).toBeLessThan(0.002);
  });
});
