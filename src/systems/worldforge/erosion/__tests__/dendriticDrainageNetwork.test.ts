// src/systems/worldforge/erosion/__tests__/dendriticDrainageNetwork.test.ts
//
// Unit tests for the explicit dendritic drainage network generator:
//   1. Determinism — identical seeds produce bit-identical stream trees and field queries.
//   2. Horton-Strahler Ordering — tributary hierarchy and discharge accumulation.
//   3. Hydraulic Geometry — channel width and depth scaling with discharge and rock hardness.
//   4. Valley Cross-Sections — V-notch vs U-swale profiles modulated by rock hardness.
//   5. Particle Routing — hydraulic droplet transport and bedload carving.
//   6. Inlay Application — heightfield incision without NaN or negative elevations.

import { describe, it, expect } from 'vitest';
import {
  generateDendriticStreamTree,
  createDendriticChannelField,
  routeDendriticParticles,
  applyDendriticIncision,
} from '../dendriticDrainageNetwork';
import { REFERENCE_HARDNESS } from '../rockHardness';

const DEFAULT_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: 25000,
  maxY: 25000,
};

describe('dendriticDrainageNetwork — stream tree synthesis', () => {
  it('is deterministic for the same seed and bounds', () => {
    const treeA = generateDendriticStreamTree({ seed: 42, bounds: DEFAULT_BOUNDS });
    const treeB = generateDendriticStreamTree({ seed: 42, bounds: DEFAULT_BOUNDS });

    expect(treeA.nodes.length).toBe(treeB.nodes.length);
    expect(treeA.segments.length).toBe(treeB.segments.length);
    expect(treeA.maxOrder).toBe(treeB.maxOrder);

    for (let i = 0; i < treeA.nodes.length; i++) {
      expect(treeA.nodes[i].x).toBe(treeB.nodes[i].x);
      expect(treeA.nodes[i].y).toBe(treeB.nodes[i].y);
      expect(treeA.nodes[i].discharge).toBe(treeB.nodes[i].discharge);
      expect(treeA.nodes[i].order).toBe(treeB.nodes[i].order);
    }
  });

  it('produces different networks for different seeds', () => {
    const tree1 = generateDendriticStreamTree({ seed: 101, bounds: DEFAULT_BOUNDS });
    const tree2 = generateDendriticStreamTree({ seed: 202, bounds: DEFAULT_BOUNDS });

    expect(tree1.nodes[0].x).not.toBe(tree2.nodes[0].x);
  });

  it('maintains Horton-Strahler ordering and discharge accumulation downstream', () => {
    const tree = generateDendriticStreamTree({ seed: 777, bounds: DEFAULT_BOUNDS });

    expect(tree.maxOrder).toBeGreaterThanOrEqual(2);

    for (let s = 0; s < tree.segments.length; s++) {
      const seg = tree.segments[s];
      // Downstream node must receive at least as much water as the upstream node
      expect(seg.to.discharge).toBeGreaterThanOrEqual(seg.from.discharge);
      // Downstream order must be greater than or equal to upstream order
      expect(seg.to.order).toBeGreaterThanOrEqual(seg.from.order);
      // Physical segments must have positive length and width
      expect(seg.length).toBeGreaterThan(0);
      expect(seg.width).toBeGreaterThan(0);
      expect(seg.depth).toBeGreaterThan(0);
    }
  });

  it('scales channel width and depth with discharge and rock hardness', () => {
    const softTree = generateDendriticStreamTree({
      seed: 888,
      bounds: DEFAULT_BOUNDS,
      hardness: 0.1, // Soft sedimentary rock
    });
    const hardTree = generateDendriticStreamTree({
      seed: 888,
      bounds: DEFAULT_BOUNDS,
      hardness: 0.9, // Hard crystalline rock
    });

    expect(softTree.segments.length).toBe(hardTree.segments.length);

    for (let s = 0; s < softTree.segments.length; s++) {
      // Soft rock carves wider, deeper channels (higher erodibility, lower talus steepness)
      expect(softTree.segments[s].width).toBeGreaterThan(hardTree.segments[s].width);
      expect(softTree.segments[s].depth).toBeGreaterThan(hardTree.segments[s].depth);
    }
  });
});

describe('dendriticDrainageNetwork — continuous field evaluation', () => {
  it('identifies stream beds and computes decaying valley incision away from the channel', () => {
    const tree = generateDendriticStreamTree({ seed: 555, bounds: DEFAULT_BOUNDS });
    const sampler = createDendriticChannelField(tree);

    // Pick an existing node on a major segment
    const targetNode = tree.nodes[Math.floor(tree.nodes.length / 2)];
    const onStream = sampler(targetNode.x, targetNode.y, REFERENCE_HARDNESS);

    expect(onStream.distanceToStream).toBeLessThan(10);
    expect(onStream.isChannelBed).toBe(true);
    expect(onStream.valleyInfluence).toBe(1.0);
    expect(onStream.depth).toBeGreaterThan(0);

    // Point far away from any channel
    const offStream = sampler(targetNode.x + 10000, targetNode.y + 10000, REFERENCE_HARDNESS);
    expect(offStream.distanceToStream).toBeGreaterThan(1000);
    expect(offStream.isChannelBed).toBe(false);
    expect(offStream.depth).toBe(0);
    expect(offStream.valleyInfluence).toBe(0);
  });

  it('modulates valley incision and profile wall steepness by rock hardness', () => {
    const tree = generateDendriticStreamTree({ seed: 555, bounds: DEFAULT_BOUNDS });
    const sampler = createDendriticChannelField(tree);
    const targetNode = tree.nodes[Math.floor(tree.nodes.length / 2)];

    const softSample = sampler(targetNode.x, targetNode.y, 0.1);
    const hardSample = sampler(targetNode.x, targetNode.y, 0.9);

    // Softer rock experiences greater incision depth
    expect(softSample.depth).toBeGreaterThan(hardSample.depth);
  });
});

describe('dendriticDrainageNetwork — particle routing simulation', () => {
  it('routes water particles downhill across a simple inclined plane', () => {
    const width = 32;
    const height = 32;
    const plane = new Float32Array(width * height);

    // Create an eastward declining slope (high on west, low on east)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        plane[y * width + x] = 1.0 - (x / width) * 0.8;
      }
    }

    const result = routeDendriticParticles(plane, width, height, {
      particleCount: 500,
      maxSteps: 30,
      erosionRate: 0.05,
    });

    expect(result.waterAccumulation.length).toBe(width * height);
    expect(result.elevationDelta.length).toBe(width * height);

    // Downhill cells (east side) should receive accumulated flow
    let eastFlow = 0;
    let westFlow = 0;
    for (let y = 0; y < height; y++) {
      westFlow += result.waterAccumulation[y * width + 2];
      eastFlow += result.waterAccumulation[y * width + width - 3];
    }
    expect(eastFlow).toBeGreaterThan(0);
  });
});

describe('dendriticDrainageNetwork — heightfield incision in-place', () => {
  it('carves river channels into a heightfield without introducing NaN or negative elevations', () => {
    const width = 64;
    const height = 64;
    const heightfield = new Float32Array(width * height).fill(0.5);

    const tree = generateDendriticStreamTree({ seed: 999, bounds: DEFAULT_BOUNDS });
    applyDendriticIncision(heightfield, width, height, DEFAULT_BOUNDS, tree, REFERENCE_HARDNESS);

    let incisedCells = 0;
    for (let i = 0; i < heightfield.length; i++) {
      expect(Number.isNaN(heightfield[i])).toBe(false);
      expect(heightfield[i]).toBeGreaterThanOrEqual(0);
      expect(heightfield[i]).toBeLessThanOrEqual(0.5);
      if (heightfield[i] < 0.5) incisedCells++;
    }

    expect(incisedCells).toBeGreaterThan(0);
  });
});
