/**
 * @file dendriticDrainageNetwork.ts — explicit dendritic drainage network generator.
 *
 * This file creates realistic tree-like river and tributary networks for the terrain.
 *
 * Rather than relying on simple noise thresholding (which creates disconnected blobs or
 * noisy spikes), this generator builds true branching stream trees (Horton-Strahler networks)
 * and simulates particle routing down terrain slopes. It carves crisp valleys and gorges
 * whose width, depth, and wall steepness directly respond to the underlying rock hardness
 * and water discharge.
 *
 * Called by: region composite height field, terrain generation pipelines, and erosion bake passes.
 * Depends on: rockHardness.ts for rock resistance and slope angles, atlasErosionBake.ts for discharge.
 */

import {
  REFERENCE_HARDNESS,
  erodibilityOf,
  talusScaleOf,
} from './rockHardness';

// ============================================================================
// Types and Interfaces
// ============================================================================
// These data structures represent stream nodes, branching segments, the complete
// river tree hierarchy, and point evaluation results.
// ============================================================================

/** A single point along a synthesized stream channel. */
export interface StreamNode {
  /** Unique numeric identifier for this node. */
  id: number;
  /** X coordinate in world feet or local domain units. */
  x: number;
  /** Y coordinate in world feet or local domain units. */
  y: number;
  /** Elevation at this stream node (0..1 normalized or feet). */
  elevation: number;
  /** Accumulated water discharge passing through this node. */
  discharge: number;
  /** Horton-Strahler stream order (1 = smallest headwater tributary, higher = trunk river). */
  order: number;
  /** Identifier of the downstream parent node this node flows into (null if outlet). */
  parentId: number | null;
}

/** A directed segment connecting two stream nodes. */
export interface StreamSegment {
  /** Upstream source node. */
  from: StreamNode;
  /** Downstream target node. */
  to: StreamNode;
  /** Planar length of this segment. */
  length: number;
  /** Downward slope (elevation drop divided by planar length). */
  slope: number;
  /** Stream order of this segment. */
  order: number;
  /** Accumulated water discharge along this segment. */
  discharge: number;
  /** Channel bed width based on hydraulic geometry. */
  width: number;
  /** Maximum channel incision depth based on stream power. */
  depth: number;
}

/** Complete dendritic stream network graph. */
export interface DendriticStreamTree {
  /** All nodes in the drainage tree. */
  nodes: StreamNode[];
  /** All directed channel segments in the drainage tree. */
  segments: StreamSegment[];
  /** Node ids of terminal outlets where water exits the domain. */
  outletIds: number[];
  /** Highest Horton-Strahler stream order present in this tree. */
  maxOrder: number;
  /** Bounding box of the network domain. */
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

/** Configuration options for synthesizing a dendritic stream tree. */
export interface StreamTreeOptions {
  /** World seed for deterministic procedural generation. */
  seed: number;
  /** Domain bounds in world feet. */
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  /** Number of major river trunk outlets on the boundary or basin floor. */
  outletCount?: number;
  /** Target density of tributary branching (higher produces finer gully networks). */
  branchDensity?: number;
  /** Maximum recursion depth for tributary branching. */
  maxGenerations?: number;
  /** Base branching angle in radians (standard geomorphic range is ~0.6 to 0.9 rad / 35-55 deg). */
  branchAngleRad?: number;
  /** Base segment step length in world feet. */
  segmentLengthFt?: number;
  /** Mean rock hardness (0..1) across the network. */
  hardness?: number;
}

/** Result of sampling the dendritic drainage field at an arbitrary point. */
export interface DendriticIncisionSample {
  /** Valley incision depth to subtract from terrain height (0..1 or feet). */
  depth: number;
  /** Distance in feet to the centerline of the nearest stream channel. */
  distanceToStream: number;
  /** Horton-Strahler order of the nearest channel. */
  streamOrder: number;
  /** Accumulated discharge of the nearest channel. */
  discharge: number;
  /** True if the point lies inside the active carved riverbed. */
  isChannelBed: boolean;
  /** Influence factor (0 to 1) describing how strongly the valley affects this point. */
  valleyInfluence: number;
}

/** Configuration options for particle-based drainage routing. */
export interface ParticleRoutingOptions {
  /** Number of water droplet particles to simulate. */
  particleCount?: number;
  /** Maximum simulation steps per droplet before termination. */
  maxSteps?: number;
  /** Inertia weighting (0 = strictly follow local slope, 1 = ignore slope changes). */
  inertia?: number;
  /** Base erosion rate multiplier. */
  erosionRate?: number;
  /** Base deposition rate multiplier for excess sediment load. */
  depositionRate?: number;
  /** Rock hardness value or per-cell hardness array (0..1). */
  hardness?: number | ArrayLike<number>;
  /** Minimum slope to prevent division by zero in steepness calculations. */
  minSlope?: number;
}

/** Result of simulating particle-based drainage routing over a grid. */
export interface ParticleRoutingResult {
  /** Accumulated water flux per cell. */
  waterAccumulation: Float32Array;
  /** Net erosion (positive) or deposition (negative) height offset per cell. */
  elevationDelta: Float32Array;
  /** Width of the grid. */
  width: number;
  /** Height of the grid. */
  height: number;
}

// ============================================================================
// Procedural Math and Random Utilities
// ============================================================================
// Deterministic hash-based random number generation ensures that identical
// seeds always create bit-identical drainage networks across runs.
// ============================================================================

/** Create a deterministic pseudo-random number generator function from a seed. */
function createPrng(seed: number): () => number {
  let s = (seed ^ 0x6c656166) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// Stream Tree Synthesis (Horton-Strahler Branching Generator)
// ============================================================================
// This section constructs an explicit geometric tree of river channels.
// Starting at downstream outlet points, branches grow upstream and bifurcate
// into smaller tributaries according to physical laws of geomorphology.
// ============================================================================

/**
 * Synthesizes a branching dendritic stream tree inside a bounding box.
 *
 * @param options - Generation settings including seed, bounds, and density.
 * @returns Complete stream tree with connected nodes, orders, and channel dimensions.
 */
export function generateDendriticStreamTree(options: StreamTreeOptions): DendriticStreamTree {
  const {
    seed,
    bounds,
    outletCount = 2,
    branchDensity = 0.85,
    maxGenerations = 5,
    branchAngleRad = 0.78, // ~45 degrees
    segmentLengthFt = 1200,
    hardness = REFERENCE_HARDNESS,
  } = options;

  const prng = createPrng(seed);
  const nodes: StreamNode[] = [];
  const segments: StreamSegment[] = [];
  const outletIds: number[] = [];

  const domainWidth = bounds.maxX - bounds.minX;
  const domainHeight = bounds.maxY - bounds.minY;
  let nextNodeId = 0;

  // Rock properties modulate how wide channels spread and how deeply they incise.
  const erodibility = erodibilityOf(hardness);
  const talusScale = talusScaleOf(hardness);

  // Helper to create and record a new stream node.
  function addNode(x: number, y: number, elevation: number, parentId: number | null): StreamNode {
    const node: StreamNode = {
      id: nextNodeId++,
      x,
      y,
      elevation,
      discharge: 1.0,
      order: 1,
      parentId,
    };
    nodes.push(node);
    return node;
  }

  // Generate initial trunk outlets along the low elevation boundary (typically the bottom edge).
  for (let o = 0; o < outletCount; o++) {
    const frac = (o + 0.5 + (prng() - 0.5) * 0.4) / outletCount;
    const outletX = bounds.minX + frac * domainWidth;
    const outletY = bounds.minY + prng() * (domainHeight * 0.08);
    const outletNode = addNode(outletX, outletY, 0.0, null);
    outletIds.push(outletNode.id);

    // Initial upstream direction is generally northward into the rising interior.
    const baseAngle = Math.PI * 0.5 + (prng() - 0.5) * 0.35;
    growBranch(outletNode, baseAngle, segmentLengthFt, 1, maxGenerations);
  }

  // Recursive upstream branch growth simulating tributary network synthesis.
  function growBranch(
    parentNode: StreamNode,
    currentAngle: number,
    stepLength: number,
    generation: number,
    maxGen: number,
  ): void {
    if (generation > maxGen) return;

    // Determine how many steps this segment runs before bifurcating.
    const stepsInSegment = 2 + Math.floor(prng() * 3);
    let currentNode = parentNode;
    let angle = currentAngle;

    for (let s = 0; s < stepsInSegment; s++) {
      // Jitter the flow direction slightly to create natural meandering curves.
      angle += (prng() - 0.5) * 0.3;
      const nextX = currentNode.x + Math.cos(angle) * stepLength;
      const nextY = currentNode.y + Math.sin(angle) * stepLength;

      // Stop branch growth if it exits the domain boundary.
      if (
        nextX < bounds.minX ||
        nextX > bounds.maxX ||
        nextY < bounds.minY ||
        nextY > bounds.maxY
      ) {
        break;
      }

      // Elevation increases monotonically upstream (Flint's law approximation).
      const elevationGain = 0.02 + 0.03 * prng();
      const nextElev = currentNode.elevation + elevationGain;

      const childNode = addNode(nextX, nextY, nextElev, currentNode.id);
      currentNode = childNode;
    }

    if (generation >= maxGen) return;

    // Tributary bifurcation: stream splits into left and right branches.
    const doBranch = prng() < branchDensity;
    if (doBranch) {
      // Main continuing branch: slight deflection.
      const mainAngle = angle + (prng() - 0.5) * 0.2;
      growBranch(currentNode, mainAngle, stepLength * 0.85, generation + 1, maxGen);

      // Secondary tributary branch: bifurcates at characteristic geomorphic angle.
      const side = prng() < 0.5 ? -1 : 1;
      const tribAngle = angle + side * (branchAngleRad + (prng() - 0.5) * 0.2);
      growBranch(currentNode, tribAngle, stepLength * 0.75, generation + 1, maxGen);
    }
  }

  // Build lookup map for quick node lookup by ID.
  const nodeMap = new Map<number, StreamNode>();
  for (let i = 0; i < nodes.length; i++) {
    nodeMap.set(nodes[i].id, nodes[i]);
  }

  // Compute accumulated discharge and Horton-Strahler stream order.
  // We process nodes from leaves (headwaters) toward trunk roots.
  const childrenMap = new Map<number, StreamNode[]>();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.parentId !== null) {
      const list = childrenMap.get(node.parentId);
      if (list) list.push(node);
      else childrenMap.set(node.parentId, [node]);
    }
  }

  // Post-order traversal to calculate discharge and stream order.
  function evaluateHydraulics(nodeId: number): { discharge: number; order: number } {
    const node = nodeMap.get(nodeId);
    if (!node) return { discharge: 1, order: 1 };

    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) {
      node.discharge = 1.0;
      node.order = 1;
      return { discharge: node.discharge, order: node.order };
    }

    let sumDischarge = 1.0;
    let maxChildOrder = 1;
    let countMaxOrder = 0;

    for (let c = 0; c < children.length; c++) {
      const childResult = evaluateHydraulics(children[c].id);
      sumDischarge += childResult.discharge;
      if (childResult.order > maxChildOrder) {
        maxChildOrder = childResult.order;
        countMaxOrder = 1;
      } else if (childResult.order === maxChildOrder) {
        countMaxOrder++;
      }
    }

    node.discharge = sumDischarge;
    // Horton-Strahler rule: when two equal-order tributaries meet, order increments by 1.
    node.order = countMaxOrder >= 2 ? maxChildOrder + 1 : maxChildOrder;
    return { discharge: node.discharge, order: node.order };
  }

  let maxOrder = 1;
  for (let o = 0; o < outletIds.length; o++) {
    const outResult = evaluateHydraulics(outletIds[o]);
    if (outResult.order > maxOrder) maxOrder = outResult.order;
  }

  // Construct stream segments with physical channel widths and depths.
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.parentId !== null) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        const dx = parent.x - node.x;
        const dy = parent.y - node.y;
        const len = Math.hypot(dx, dy);
        const drop = Math.max(0.001, node.elevation - parent.elevation);
        const slope = drop / (len || 1);

        // Leopold-Maddock hydraulic geometry laws:
        // Width ~ Q^0.5, Depth ~ Q^0.4, scaled inversely by rock hardness.
        const width = (80 + 35 * Math.pow(node.discharge, 0.48)) / talusScale;
        const depth = (0.015 + 0.025 * Math.pow(node.discharge, 0.38)) * erodibility;

        segments.push({
          from: node,
          to: parent,
          length: len,
          slope,
          order: node.order,
          discharge: node.discharge,
          width,
          depth,
        });
      }
    }
  }

  return {
    nodes,
    segments,
    outletIds,
    maxOrder,
    bounds: { ...bounds },
  };
}

// ============================================================================
// Continuous Field Evaluation (Distance Field & Valley Cross-Sections)
// ============================================================================
// This section allows any point in the world (x, y) to query its distance to
// the nearest stream channel, computing the exact valley profile, gorge walls,
// and water channel beds.
// ============================================================================

/**
 * Creates a continuous 2D spatial evaluator for a synthesized dendritic stream tree.
 *
 * @param tree - The dendritic stream tree to query.
 * @returns Sampling function taking world coordinates (x, y) and returning incision metrics.
 */
export function createDendriticChannelField(
  tree: DendriticStreamTree,
): (x: number, y: number, localHardness?: number) => DendriticIncisionSample {
  const { segments } = tree;

  // Build a spatial grid partition for fast line segment proximity queries.
  const cellSize = 2000;
  const grid = new Map<string, number[]>();

  function cellKey(gx: number, gy: number): string {
    return `${gx},${gy}`;
  }

  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    const minX = Math.min(seg.from.x, seg.to.x) - seg.width * 4;
    const maxX = Math.max(seg.from.x, seg.to.x) + seg.width * 4;
    const minY = Math.min(seg.from.y, seg.to.y) - seg.width * 4;
    const maxY = Math.max(seg.from.y, seg.to.y) + seg.width * 4;

    const startGx = Math.floor(minX / cellSize);
    const endGx = Math.floor(maxX / cellSize);
    const startGy = Math.floor(minY / cellSize);
    const endGy = Math.floor(maxY / cellSize);

    for (let gx = startGx; gx <= endGx; gx++) {
      for (let gy = startGy; gy <= endGy; gy++) {
        const k = cellKey(gx, gy);
        const list = grid.get(k);
        if (list) list.push(s);
        else grid.set(k, [s]);
      }
    }
  }

  return (x: number, y: number, localHardness = REFERENCE_HARDNESS): DendriticIncisionSample => {
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);

    let nearestDist = Infinity;
    let nearestSeg: StreamSegment | null = null;

    // Search candidate segments in neighboring cells.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const candidates = grid.get(cellKey(gx + dx, gy + dy));
        if (!candidates) continue;

        for (let i = 0; i < candidates.length; i++) {
          const seg = segments[candidates[i]];
          const ax = seg.from.x;
          const ay = seg.from.y;
          const bx = seg.to.x;
          const by = seg.to.y;

          const abx = bx - ax;
          const aby = by - ay;
          const apx = x - ax;
          const apy = y - ay;

          const segLenSq = abx * abx + aby * aby;
          let t = 0;
          if (segLenSq > 0) {
            t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / segLenSq));
          }

          const projX = ax + t * abx;
          const projY = ay + t * aby;
          const dist = Math.hypot(x - projX, y - projY);

          if (dist < nearestDist) {
            nearestDist = dist;
            nearestSeg = seg;
          }
        }
      }
    }

    // Default return if no stream segments are within search reach.
    if (!nearestSeg || nearestDist > 8000) {
      return {
        depth: 0,
        distanceToStream: nearestDist,
        streamOrder: 0,
        discharge: 0,
        isChannelBed: false,
        valleyInfluence: 0,
      };
    }

    const erodibility = erodibilityOf(localHardness);
    const talusScale = talusScaleOf(localHardness);

    // Channel bed and valley flank profile calculations:
    const channelHalfWidth = nearestSeg.width * 0.5;
    const valleyReach = nearestSeg.width * 3.5 * talusScale;
    const isChannelBed = nearestDist <= channelHalfWidth;

    let incision = 0;
    let valleyInfluence = 0;

    if (nearestDist <= valleyReach) {
      // Inside active riverbed: deep inner slot/gorge.
      if (isChannelBed) {
        const bedFraction = nearestDist / channelHalfWidth;
        // Parabolic / U-notch riverbed profile.
        incision = nearestSeg.depth * (1.0 - 0.3 * bedFraction * bedFraction);
        valleyInfluence = 1.0;
      } else {
        // Valley flanks relaxing outwards to the surrounding hillsides.
        const flankDistance = nearestDist - channelHalfWidth;
        const flankWidth = valleyReach - channelHalfWidth;
        const flankFraction = Math.min(1, flankDistance / flankWidth);

        // Hard rock forms steep V-shaped walls; soft rock forms gentle convex swales.
        const profileExponent = 1.2 * talusScale;
        valleyInfluence = Math.pow(1 - flankFraction, profileExponent);
        incision = nearestSeg.depth * 0.7 * valleyInfluence;
      }
    }

    return {
      depth: incision * erodibility,
      distanceToStream: nearestDist,
      streamOrder: nearestSeg.order,
      discharge: nearestSeg.discharge,
      isChannelBed,
      valleyInfluence,
    };
  };
}

// ============================================================================
// Particle-Based Drainage Routing and Carving
// ============================================================================
// This section simulates discrete water droplets running down a heightfield.
// Droplets accelerate downhill, carve bedload channels, and deposit sediment
// in depressions to produce connected flow channels.
// ============================================================================

/**
 * Simulates hydraulic particle routing across a 2D heightfield grid.
 *
 * @param heightfield - Input grid of elevations (Float32Array or Float64Array).
 * @param width - Number of columns in the elevation grid.
 * @param height - Number of rows in the elevation grid.
 * @param options - Particle simulation parameters.
 * @returns Water accumulation and carved elevation delta maps.
 */
export function routeDendriticParticles(
  heightfield: ArrayLike<number>,
  width: number,
  height: number,
  options: ParticleRoutingOptions = {},
): ParticleRoutingResult {
  const {
    particleCount = width * height,
    maxSteps = 40,
    inertia = 0.15,
    erosionRate = 0.05,
    depositionRate = 0.05,
    hardness = REFERENCE_HARDNESS,
    minSlope = 0.001,
  } = options;

  const totalCells = width * height;
  const waterAccumulation = new Float32Array(totalCells);
  const elevationDelta = new Float32Array(totalCells);

  const prng = createPrng(1337);

  // Helper to read bilinear elevation at sub-pixel positions.
  function sampleElevation(fx: number, fy: number): { h: number; gx: number; gy: number } {
    const x0 = Math.max(0, Math.min(width - 2, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(height - 2, Math.floor(fy)));
    const tx = fx - x0;
    const ty = fy - y0;

    const idx00 = y0 * width + x0;
    const idx10 = idx00 + 1;
    const idx01 = idx00 + width;
    const idx11 = idx01 + 1;

    const h00 = heightfield[idx00] + elevationDelta[idx00];
    const h10 = heightfield[idx10] + elevationDelta[idx10];
    const h01 = heightfield[idx01] + elevationDelta[idx01];
    const h11 = heightfield[idx11] + elevationDelta[idx11];

    const h =
      h00 * (1 - tx) * (1 - ty) +
      h10 * tx * (1 - ty) +
      h01 * (1 - tx) * ty +
      h11 * tx * ty;

    // Gradients in X and Y directions.
    const gx = (h10 - h00) * (1 - ty) + (h11 - h01) * ty;
    const gy = (h01 - h00) * (1 - tx) + (h11 - h10) * tx;

    return { h, gx, gy };
  }

  // Simulate discrete water droplet trajectories.
  for (let p = 0; p < particleCount; p++) {
    let px = prng() * (width - 1);
    let py = prng() * (height - 1);
    let vx = 0;
    let vy = 0;
    let water = 1.0;
    let sediment = 0.0;

    for (let step = 0; step < maxSteps; step++) {
      const ix = Math.floor(px);
      const iy = Math.floor(py);
      if (ix < 0 || ix >= width - 1 || iy < 0 || iy >= height - 1) break;

      const cellIdx = iy * width + ix;
      waterAccumulation[cellIdx] += water;

      const sample = sampleElevation(px, py);
      const gradLen = Math.hypot(sample.gx, sample.gy);

      // Accelerate droplet down the gradient while maintaining momentum/inertia.
      if (gradLen > 0) {
        const targetVx = -sample.gx / gradLen;
        const targetVy = -sample.gy / gradLen;
        vx = vx * inertia + targetVx * (1 - inertia);
        vy = vy * inertia + targetVy * (1 - inertia);
      }

      const speed = Math.hypot(vx, vy);
      if (speed === 0) break;

      const nextPx = px + (vx / speed);
      const nextPy = py + (vy / speed);

      if (nextPx < 0 || nextPx >= width - 1 || nextPy < 0 || nextPy >= height - 1) break;

      const nextSample = sampleElevation(nextPx, nextPy);
      const deltaH = nextSample.h - sample.h;

      // Look up rock hardness at the current particle location.
      let cellHardness = REFERENCE_HARDNESS;
      if (typeof hardness === 'number') {
        cellHardness = hardness;
      } else if (hardness && hardness[cellIdx] !== undefined) {
        cellHardness = hardness[cellIdx];
      }

      const erodibility = erodibilityOf(cellHardness);

      // Sediment capacity proportional to slope and flow velocity.
      const slope = Math.max(minSlope, -deltaH);
      const sedimentCapacity = Math.max(0, -deltaH) * speed * water * 0.1;

      if (sediment > sedimentCapacity) {
        // Drop excess sediment in flat basins or depressions.
        const depositAmount = (sediment - sedimentCapacity) * depositionRate;
        sediment -= depositAmount;
        elevationDelta[cellIdx] += depositAmount;
      } else {
        // Carve channel bed load when water is under-saturated.
        const carveAmount = Math.min(
          slope,
          (sedimentCapacity - sediment) * erosionRate * erodibility,
        );
        sediment += carveAmount;
        elevationDelta[cellIdx] -= carveAmount;
      }

      px = nextPx;
      py = nextPy;
      water *= 0.98; // Gradual evaporation / soil absorption
    }
  }

  return {
    waterAccumulation,
    elevationDelta,
    width,
    height,
  };
}

// ============================================================================
// Terrain Application and Channel Inlaying
// ============================================================================
// Functions to combine synthesized dendritic networks directly onto existing
// heightfields and composite terrain models.
// ============================================================================

/**
 * Inlays a dendritic drainage network onto an existing heightfield grid.
 *
 * @param heightfield - The heightfield samples to modify in-place.
 * @param width - Grid width in sample columns.
 * @param height - Grid height in sample rows.
 * @param bounds - Spatial bounds covered by the grid in world feet.
 * @param tree - Synthesized dendritic stream tree.
 * @param hardness - Rock hardness (0..1) or per-cell hardness array.
 */
export function applyDendriticIncision(
  heightfield: Float32Array,
  width: number,
  height: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  tree: DendriticStreamTree,
  hardness: number | ArrayLike<number> = REFERENCE_HARDNESS,
): void {
  const sampler = createDendriticChannelField(tree);
  const stepX = (bounds.maxX - bounds.minX) / Math.max(1, width - 1);
  const stepY = (bounds.maxY - bounds.minY) / Math.max(1, height - 1);

  for (let r = 0; r < height; r++) {
    const wy = bounds.minY + r * stepY;
    const rowOffset = r * width;

    for (let c = 0; c < width; c++) {
      const wx = bounds.minX + c * stepX;
      const idx = rowOffset + c;

      let cellHardness = REFERENCE_HARDNESS;
      if (typeof hardness === 'number') {
        cellHardness = hardness;
      } else if (hardness && hardness[idx] !== undefined) {
        cellHardness = hardness[idx];
      }

      const sample = sampler(wx, wy, cellHardness);
      if (sample.depth > 0) {
        heightfield[idx] = Math.max(0, heightfield[idx] - sample.depth);
      }
    }
  }
}
