/**
 * Proves the Voronoi-ward town adapts into a roster-ready artifact plan: homes +
 * jobs + a ward-edge street network, and a real roster generates on top of it.
 */
import { describe, it, expect } from 'vitest';
import { generateTownPlan as generateVoronoiTown } from '../townEngine';
import { voronoiTownToArtifactPlan } from '../voronoiTownAdapter';
import { generateTownRoster } from '../../roster/generateTownRoster';
import { buildStreetGraph, nearestNode } from '../../roster/agentPath';
import { rootSeedPath } from '../../seedPath';
import type { Pt } from '../../submap/submapEngine';

// A simple square cell footprint at feet scale (~1600 ft span).
const footprint: Pt[] = [[0, 0], [1600, 0], [1600, 1600], [0, 1600]];
const SEED = rootSeedPath(42);

describe('voronoiTownToArtifactPlan', () => {
  it('flattens a ward town into homes, jobs, and a ward-edge street network', () => {
    const town = generateVoronoiTown(footprint, SEED, { population: 600 });
    const plan = voronoiTownToArtifactPlan(town, 9001);

    expect(plan.burgId).toBe(9001);
    const houses = plan.plots.filter((p) => p.role === 'house');
    const jobs = plan.plots.filter((p) => p.role === 'workshop' || p.role === 'market');
    expect(houses.length).toBeGreaterThan(0);
    expect(jobs.length).toBeGreaterThan(0);

    // Streets come from ward edges — every centerline is a 2-point segment.
    expect(plan.streets.length).toBeGreaterThan(0);
    for (const s of plan.streets) expect(s.centerline.length).toBeGreaterThanOrEqual(2);

    // Plot ids are unique and stable.
    const ids = plan.plots.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Deterministic.
    expect(voronoiTownToArtifactPlan(generateVoronoiTown(footprint, SEED, { population: 600 }), 9001)).toEqual(plan);
  });

  it('supports a real roster + a connected street graph', () => {
    const town = generateVoronoiTown(footprint, SEED, { population: 600 });
    const plan = voronoiTownToArtifactPlan(town, 9001);

    const roster = generateTownRoster(plan, SEED, { nameFor: (rng) => `N${Math.floor(rng.next() * 1000)}` });
    expect(roster.occupants.length).toBeGreaterThan(0);
    // Some occupants got jobs (workPlotId), others are residents.
    expect(roster.occupants.some((o) => o.workPlotId !== undefined)).toBe(true);
    // Every occupant lives in a real house plot.
    const houseIds = new Set(plan.plots.filter((p) => p.role === 'house').map((p) => p.id));
    expect(roster.occupants.every((o) => houseIds.has(o.homePlotId))).toBe(true);

    // The ward-edge street graph has nodes (agents can route on it).
    const graph = buildStreetGraph(plan);
    expect(graph.nodes.length).toBeGreaterThan(0);
  });

  it('streets are densified so agents join the road near their door (no cut-across)', () => {
    const town = generateVoronoiTown(footprint, SEED, { population: 600 });
    const plan = voronoiTownToArtifactPlan(town, 9001);
    const graph = buildStreetGraph(plan);

    // Densification adds many mid-edge nodes (not just the few ward corners).
    expect(graph.nodes.length).toBeGreaterThan(plan.plots.length);

    // Town span (feet) from all plot footprints.
    const pts = plan.plots.flatMap((p) => p.footprint);
    const xs = pts.map((q) => q[0]); const ys = pts.map((q) => q[1]);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

    // Every house centroid snaps onto a street within a small fraction of the
    // town span — so the centroid→road segment is short, not a diagonal across
    // the block (the "trespassing" symptom).
    const cen = (poly: Pt[]): Pt => [
      poly.reduce((a, q) => a + q[0], 0) / poly.length,
      poly.reduce((a, q) => a + q[1], 0) / poly.length,
    ];
    const houses = plan.plots.filter((p) => p.role === 'house');
    let sumSnap = 0;
    for (const h of houses) {
      const c = cen(h.footprint);
      const ni = nearestNode(graph, c);
      sumSnap += Math.hypot(graph.nodes[ni][0] - c[0], graph.nodes[ni][1] - c[1]);
    }
    // The TYPICAL house joins a street within a small fraction of the town span
    // (deep courtyard infill buildings are the rare exception, not the rule).
    expect(sumSnap / houses.length).toBeLessThan(span * 0.07);
  });
});
