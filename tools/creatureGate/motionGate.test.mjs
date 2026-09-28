/**
 * Guards the MOTION gate's metrics (motionMetrics.mjs).
 *
 * WHY THIS FILE EXISTS. The gate's whole value is that it FAILS on the two
 * defects a still T-pose proof hides — a crossed finger chain and a broken
 * silhouette. A gate nobody has watched fail is a gate nobody knows works, and
 * the capture half needs a browser and a dev server, so the floors would
 * otherwise only ever be exercised on real bodies that (correctly) pass. These
 * tests drive the pure half with synthetic captures: one clean hand, one hand
 * with two fingers swapped, one whole silhouette, one torn one.
 *
 * The mitten case is here too, because it is the reason the distance floor was
 * dropped: on the lowpoly bodies the finger bones sit inside one fused mesh
 * 0.56 mm apart in every frame, and a naive gap floor would have failed the
 * gate forever on geometry that has no fingers to cross.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyDigitBone, segmentDistance, digitChains, chainCrossings, digitOrder,
  sameOrder, fingerMetrics, maskIslands, silhouetteMetrics, motionFlags, FLOORS,
} from './motionMetrics.mjs';

/**
 * A synthetic right hand on the PACK skeleton: four fingers spaced along x,
 * each a straight four-joint chain running along +z. `bend` displaces one
 * finger sideways at the tip, which is how a crossing is injected.
 */
function packHand({ swap = null, spacing = 0.02, length = 0.09 } = {}) {
  const names = ['index', 'middle', 'ring', 'pinky'];
  const bones = {};
  names.forEach((n, i) => {
    for (let j = 0; j < 4; j++) {
      const z = (j / 3) * length;
      // A swap moves BOTH members of the pair past each other by the far end,
      // which is exactly what a crossed chain looks like in world space.
      let x = i * spacing;
      if (swap && (swap[0] === n || swap[1] === n)) {
        const other = swap[0] === n ? swap[1] : swap[0];
        const to = names.indexOf(other) * spacing;
        x = x + (to - x) * (j / 3);
      }
      const bone = j === 3 ? `${n}_04_leaf_r` : `${n}_0${j + 1}_r`;
      bones[bone] = [x, 0, z];
    }
  });
  // palm bones the gate must ignore, and a thumb that crosses the palm — a
  // legitimate pose that must never read as a crossed chain
  bones.metacarp_index_r = [0, 0, -0.03];
  bones.thumb_01_r = [0.02, -0.02, 0.0];
  bones.thumb_02_r = [0.04, -0.01, 0.03];
  bones.thumb_03_r = [0.05, 0.0, 0.05];
  bones.thumb_04_leaf_r = [0.06, 0.0, 0.06];
  return bones;
}

/** A w x h mask with `rects` of 1s: [x, y, w, h]. */
function mask(w, h, rects) {
  const m = new Array(w * h).fill(0);
  for (const [rx, ry, rw, rh] of rects) {
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) m[y * w + x] = 1;
  }
  return m;
}

describe('digit bone naming', () => {
  it('canonicalizes both skeletons onto the same digit names', () => {
    expect(classifyDigitBone('index_02_r')).toEqual({ side: 'R', digit: 'index', depth: 2 });
    expect(classifyDigitBone('pinky_04_leaf_l')).toEqual({ side: 'L', digit: 'pinky', depth: 4 });
    // our 39-bone rig: finger 0 is inboard, so it IS the index
    expect(classifyDigitBone('fingerL0a')).toEqual({ side: 'L', digit: 'index', depth: 1 });
    expect(classifyDigitBone('fingerR3b')).toEqual({ side: 'R', digit: 'pinky', depth: 2 });
    expect(classifyDigitBone('thumbRa')).toEqual({ side: 'R', digit: 'thumb', depth: 1 });
  });

  it('ignores palm and non-digit bones', () => {
    // metacarpals live INSIDE the palm; counting them makes every hand look
    // like it interpenetrates itself
    expect(classifyDigitBone('metacarp_middle_l')).toBeNull();
    expect(classifyDigitBone('upperArmR')).toBeNull();
    expect(classifyDigitBone('root')).toBeNull();
  });
});

describe('segmentDistance', () => {
  it('is zero for segments that actually cross', () => {
    expect(segmentDistance([-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0])).toBeCloseTo(0, 6);
  });

  it('measures the gap between parallel segments', () => {
    expect(segmentDistance([0, 0, 0], [0, 0, 1], [0.05, 0, 0], [0.05, 0, 1])).toBeCloseTo(0.05, 6);
  });

  it('clamps to the endpoints when the closest approach is off-segment', () => {
    // the classic single-clamp bug reports an off-segment distance here
    expect(segmentDistance([0, 0, 0], [0, 0, 1], [0, 0, 3], [0, 0, 4])).toBeCloseTo(2, 6);
  });
});

describe('digitChains', () => {
  it('keeps the pack rig four joints and extrapolates our rig a fingertip', () => {
    const pack = digitChains(packHand());
    expect(pack.R.index).toHaveLength(4);
    // our rig stops at the second phalanx; without the extrapolated tip a
    // crossing past the last joint would be invisible
    const ours = digitChains({ fingerR0a: [0, 0, 0], fingerR0b: [0, 0, 0.04], fingerR1a: [0.02, 0, 0], fingerR1b: [0.02, 0, 0.04] });
    expect(ours.R.index).toHaveLength(3);
    expect(ours.R.index[2]).toEqual([0, 0, 0.08]);
  });
});

describe('crossed finger chains — the defect the T-pose still hides', () => {
  it('finds nothing on a clean hand', () => {
    expect(chainCrossings(digitChains(packHand()).R)).toEqual([]);
  });

  it('flags a swapped pair', () => {
    const crossings = chainCrossings(digitChains(packHand({ swap: ['index', 'middle'] })).R);
    expect(crossings).toHaveLength(1);
    expect([crossings[0].a, crossings[0].b].sort()).toEqual(['index', 'middle']);
  });

  it('does not blame the thumb for opposing the palm', () => {
    // the thumb legitimately swings across every other digit; including it in
    // the ordering rule would fail every relaxed hand
    const m = fingerMetrics(packHand());
    // the lateral axis sign is arbitrary, so the order may come back mirrored
    expect(sameOrder(m.sides.R.fingerOrder, ['index', 'middle', 'ring', 'pinky'])).toBe(true);
    expect(m.sides.R.anatomicalOrderOk).toBe(true);
    expect(m.sides.R.crossings).toEqual([]);
  });

  it('accepts a mirrored lateral axis — the axis sign is arbitrary', () => {
    expect(sameOrder(['index', 'middle', 'ring'], ['ring', 'middle', 'index'])).toBe(true);
    expect(sameOrder(['index', 'ring', 'middle'], ['index', 'middle', 'ring'])).toBe(false);
  });

  it('reads a hand with no digit bones as unavailable, never as a pass', () => {
    const m = fingerMetrics({ root: [0, 0, 0], handR: [0, 1, 0] });
    expect(m.available).toBe(false);
    expect(motionFlags({ silhouette: { inkFraction: 0.1, breaks: 0 }, fingers: m }))
      .toContain('finger check unavailable (no digit bones found)');
  });

  it('does NOT fail a mitten hand whose bones merely sit close together', () => {
    // 2026-09-09: lowpoly-male under pack:Walk reads 0.56 mm between index and
    // middle because the fingers share one fused mesh. Parallel and close is
    // not crossed, and a distance floor here would fail the gate forever.
    const m = fingerMetrics(packHand({ spacing: 0.0006 }));
    expect(m.sides.R.minGapRatio).toBeLessThan(FLOORS.crossingTolerance);
    expect(m.sides.R.crossings).toEqual([]);
    expect(motionFlags({ silhouette: { inkFraction: 0.1, breaks: 0 }, fingers: m })).toEqual([]);
  });
});

describe('silhouette break', () => {
  it('counts one island for a whole body', () => {
    const s = silhouetteMetrics(mask(40, 40, [[10, 5, 8, 30]]), 40, 40);
    expect(s.islands).toBe(1);
    expect(s.breaks).toBe(0);
  });

  it('flags a limb that tore off', () => {
    const s = silhouetteMetrics(mask(40, 40, [[10, 5, 8, 20], [30, 25, 6, 10]]), 40, 40);
    expect(s.significantIslands).toBe(2);
    expect(s.breaks).toBe(1);
    expect(motionFlags({ silhouette: s, fingers: fingerMetrics(packHand()) })[0]).toMatch(/^silhouette break/);
  });

  it('ignores an antialiasing speck', () => {
    const s = silhouetteMetrics(mask(40, 40, [[10, 5, 8, 30], [35, 38, 1, 1]]), 40, 40);
    expect(s.islands).toBe(2);
    expect(s.significantIslands).toBe(1);
    expect(s.breaks).toBe(0);
  });

  it('does not blow the stack on a full-frame subject', () => {
    // an iterative flood fill is the point; a recursive one dies here
    expect(maskIslands(mask(300, 300, [[0, 0, 300, 300]]), 300, 300)).toEqual([90000]);
  });
});

describe('motionFlags', () => {
  it('reports an empty capture and measures nothing else from it', () => {
    const flags = motionFlags({
      silhouette: { inkFraction: 0.0001, breaks: 1, significantIslands: 3, islandShares: [] },
      fingers: fingerMetrics({}),
    });
    expect(flags).toEqual(['empty capture (ink 0.0001)']);
  });

  it('fails a driven frame whose fingers cross', () => {
    const flags = motionFlags({
      silhouette: { inkFraction: 0.08, breaks: 0 },
      fingers: fingerMetrics(packHand({ swap: ['middle', 'ring'] })),
    });
    expect(flags.some((f) => f.startsWith('finger interpenetration R'))).toBe(true);
  });

  it('flags a driven frame that has no bones — a still wearing a clip name', () => {
    // measured 2026-09-09: stylized-head-kit has no pack rig, so pose=pack:Walk
    // silently renders its STATIC mesh and photographs beautifully
    const flags = motionFlags({
      silhouette: { inkFraction: 0.02, breaks: 0 },
      fingers: fingerMetrics({}),
      driven: true,
      boneCount: 0,
    });
    expect(flags[0]).toMatch(/^driven frame has no bones/);
  });

  it('passes a clean driven frame', () => {
    expect(motionFlags({
      silhouette: { inkFraction: 0.08, breaks: 0 },
      fingers: fingerMetrics(packHand()),
    })).toEqual([]);
  });
});

describe('digitOrder', () => {
  it('orders digits along the hand own lateral axis, whatever the world facing', () => {
    const straight = digitOrder(digitChains(packHand()).R);
    // rotate the same hand 90 degrees about y: the order must not change
    const rotated = {};
    for (const [n, [x, y, z]] of Object.entries(packHand())) rotated[n] = [z, y, -x];
    expect(sameOrder(straight, digitOrder(digitChains(rotated).R))).toBe(true);
  });
});
