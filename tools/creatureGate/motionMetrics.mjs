/**
 * tools/creatureGate/motionMetrics.mjs — the pure half of the MOTION gate.
 *
 * WHY THIS EXISTS (the 2026-08-24 standing lesson, GOAL doc). A still T-pose
 * proof alone ships nothing: two clean stills went past review in one night
 * while the rig underneath them had crossed finger chains and scissored curls.
 * Neither defect exists in the bind pose — both only appear once a clip drives
 * the bones. So the gate has to look at a MOVING frame, and it has to look with
 * numbers, because the frame that hides a crossed chain is exactly the frame a
 * reader calls clean.
 *
 * Two cheap metrics, deliberately chosen because they are computable off the
 * same capture the T-pose proof already takes:
 *
 *   1. FINGER INTERPENETRATION — bone-space, from the digit chains' world
 *      positions, measured two ways because they fail differently:
 *        - `crossings`: a neighboring pair of fingers whose lateral ordering
 *          FLIPS somewhere between knuckle and tip. One chain has passed
 *          through the other; that is interpenetration by construction, it is
 *          scale-free, and it needs no reference frame. This is what the gate
 *          fails on.
 *        - `anatomicalOrderOk`: index<middle<ring<pinky (or its mirror) along
 *          the hand's own lateral axis. A gross scramble no single adjacent
 *          flip explains.
 *      `minGapRatio` — closest approach between two digits over the mean digit
 *      length — is REPORTED but not gated. Measured 2026-09-09: on the mitten-
 *      handed lowpoly bodies the finger bones live inside one fused mesh and
 *      sit 0.56 mm apart in every frame, so a distance floor fires forever
 *      while nothing on screen is wrong. It stays in the report as the trend
 *      number a per-body baseline could gate on later.
 *
 *   2. SILHOUETTE BREAK — pixel-space, from the capture's ink mask. The body
 *      is one connected shape; a limb that tears off its socket, or geometry
 *      that flies away under a clip, shows up as a SECOND island. Islands are
 *      counted with a flood fill on a downsampled mask, and only islands worth
 *      a real share of the subject count, so antialiasing specks are not a
 *      finding.
 *
 * Everything here is pure so it can be tested without a browser
 * (motionGate.test.mjs). The capture side lives in motionGate.mjs.
 */

// ---------------------------------------------------------------- naming

/**
 * Digit bones under BOTH skeletons the Part Lab can show, because the gate has
 * to measure whichever one the pose selects:
 *   - our 39-bone biped (`pose=rest`, `clip:*`): fingerR0a, fingerR0b, thumbRa
 *   - the pack author's armature (`pose=pack:*`): index_01_r, thumb_04_leaf_l
 * A body whose bones match neither is reported as `unavailable`, never as a
 * silent pass — an unmeasured check is not a passed check.
 */
const UE_DIGIT = /^(thumb|index|middle|ring|pinky)_(\d+)(_leaf)?_([lr])$/;
const OUR_FINGER = /^finger([LR])(\d)([ab])$/;
const OUR_THUMB = /^thumb([LR])([ab])$/;

/**
 * Classify one bone name into { side, digit, depth } or null.
 * `depth` orders the chain from knuckle to tip; `metacarp_*` bones are skipped
 * on purpose — they live inside the palm, so palm-internal proximity would read
 * as an interpenetration on every hand ever rigged.
 */
export function classifyDigitBone(name) {
  let m = UE_DIGIT.exec(name);
  if (m) return { side: m[4].toUpperCase(), digit: m[1], depth: Number(m[2]) };
  m = OUR_FINGER.exec(name);
  // Our finger indices run inboard->outboard (bipedBoneSpec restJoints: on the
  // left hand fingerL0a sits at x -0.169 and fingerL3a at x -0.227), so 0..3
  // ARE index..pinky. Canonicalizing here is what lets one order rule serve
  // both skeletons instead of two rules that can silently disagree.
  if (m) return { side: m[1], digit: FINGERS[Number(m[2])] ?? `f${m[2]}`, depth: m[3] === 'a' ? 1 : 2 };
  m = OUR_THUMB.exec(name);
  if (m) return { side: m[1], digit: 'thumb', depth: m[2] === 'a' ? 1 : 2 };
  return null;
}

/**
 * The four fingers in anatomical order, inboard to outboard. The THUMB is
 * deliberately absent: it opposes the palm and legitimately swings across every
 * other digit, so including it in an ordering rule turns every relaxed hand
 * into a "crossed chain".
 */
export const FINGERS = ['index', 'middle', 'ring', 'pinky'];

// ---------------------------------------------------------------- geometry

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));

/**
 * Shortest distance between segments p0->p1 and q0->q1.
 *
 * Ericson's clamped solve (Real-Time Collision Detection §5.1.9): solve the
 * unconstrained parameters, clamp s, re-solve t against the clamped s, clamp t,
 * then re-solve s. Clamping ONCE is the classic bug — it reports the distance
 * between two off-segment points, which for near-parallel finger bones is
 * wildly optimistic, and an optimistic gap is a missed interpenetration.
 */
export function segmentDistance(p0, p1, q0, q1) {
  const u = sub(p1, p0);
  const v = sub(q1, q0);
  const w = sub(p0, q0);
  const a = dot(u, u), b = dot(u, v), c = dot(v, v), d = dot(u, w), e = dot(v, w);
  const den = a * c - b * b;
  let s = den > 1e-12 ? Math.max(0, Math.min(1, (b * e - c * d) / den)) : 0;
  let t = c > 1e-12 ? (b * s + e) / c : 0;
  if (t < 0) {
    t = 0;
    s = a > 1e-12 ? Math.max(0, Math.min(1, -d / a)) : 0;
  } else if (t > 1) {
    t = 1;
    s = a > 1e-12 ? Math.max(0, Math.min(1, (b - d) / a)) : 0;
  }
  const cp = [p0[0] + s * u[0], p0[1] + s * u[1], p0[2] + s * u[2]];
  const cq = [q0[0] + t * v[0], q0[1] + t * v[1], q0[2] + t * v[2]];
  return len(sub(cp, cq));
}

/**
 * Group bone world positions into per-hand digit polylines.
 * `bones` is { name: [x,y,z] }. Returns { L: {digit: points[]}, R: {...} }.
 */
export function digitChains(bones) {
  const out = { L: {}, R: {} };
  for (const [name, p] of Object.entries(bones)) {
    const c = classifyDigitBone(name);
    if (!c) continue;
    (out[c.side][c.digit] ??= []).push({ depth: c.depth, p });
  }
  for (const side of ['L', 'R']) {
    for (const [digit, entries] of Object.entries(out[side])) {
      entries.sort((a, b) => a.depth - b.depth);
      const pts = entries.map((e) => e.p);
      // Our 39-bone rig stops at the second phalanx; extend by the last
      // segment so the FINGERTIP is represented on both skeletons. Without it
      // a crossing that happens past the last joint is invisible.
      if (pts.length >= 2 && !entries.some((e) => e.depth >= 4)) {
        const a = pts[pts.length - 2], b = pts[pts.length - 1];
        pts.push([b[0] + (b[0] - a[0]), b[1] + (b[1] - a[1]), b[2] + (b[2] - a[2])]);
      }
      if (pts.length < 2) delete out[side][digit];
      else out[side][digit] = pts;
    }
  }
  return out;
}

/** Total polyline length. */
function chainLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += len(sub(pts[i], pts[i - 1]));
  return s;
}

/**
 * The hand's own lateral axis: the direction of greatest spread between the
 * digit centroids. It follows the knuckle line whatever the hand is doing in
 * world space, so nothing here depends on the camera or on the body's facing.
 * Its SIGN is arbitrary — every rule built on it must be sign-symmetric.
 */
export function lateralAxis(chains) {
  const digits = Object.keys(chains);
  const centroids = digits.map((d) => {
    const pts = chains[d];
    const c = [0, 0, 0];
    for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    return [c[0] / pts.length, c[1] / pts.length, c[2] / pts.length];
  });
  let axis = [1, 0, 0], best = -1;
  for (let i = 0; i < centroids.length; i++) {
    for (let j = i + 1; j < centroids.length; j++) {
      const v = sub(centroids[i], centroids[j]);
      const l = len(v);
      if (l > best) { best = l; axis = [v[0] / l, v[1] / l, v[2] / l]; }
    }
  }
  return { axis, digits, centroids };
}

/** The digits sorted along the lateral axis. Reported as evidence, not gated. */
export function digitOrder(chains) {
  const { axis, digits, centroids } = lateralAxis(chains);
  if (digits.length < 2) return [];
  return digits
    .map((d, i) => ({ d, k: dot(centroids[i], axis) }))
    .sort((a, b) => a.k - b.k)
    .map((e) => e.d);
}

/** Two orders agree if they are equal or exactly reversed (the axis sign). */
export function sameOrder(a, b) {
  if (a.length !== b.length) return false;
  const eq = (x, y) => x.every((v, i) => v === y[i]);
  return eq(a, b) || eq(a, [...b].reverse());
}

/**
 * CROSSED CHAINS — the defect the 2026-08-24 stills hid.
 *
 * Two neighboring fingers cross when one chain passes to the other side of its
 * neighbor. Measured as a SIGN FLIP: project both chains' joints onto the
 * lateral axis, joint by joint at matching depth; the sign of (a - b) must hold
 * for the whole chain. A flip means the two chains swapped sides somewhere
 * between the knuckle and the tip, which is interpenetration by construction —
 * finger geometry occupies the space between those centerlines.
 *
 * Why this rather than a raw distance floor: on a mitten-handed low-poly body
 * the finger BONES sit inside one fused mesh, so their centerlines are always
 * near-touching and a distance floor fires on every frame while nothing on
 * screen is wrong (measured 2026-09-09: 0.56 mm between index and middle on
 * lowpoly-male under pack:Walk, with no separate finger geometry to cross).
 * A sign flip is scale-free and only fires on an actual pass-through.
 *
 * `tolerance` is a dead band in units of the lateral spread, so two chains that
 * merely touch and share a projection do not alternate signs on float noise.
 */
export function chainCrossings(chains, { tolerance = FLOORS.crossingTolerance } = {}) {
  const { axis } = lateralAxis(chains);
  const present = FINGERS.filter((f) => chains[f]);
  const out = [];
  // spread: how wide the hand is along its own axis, for the dead band
  let lo = Infinity, hi = -Infinity;
  for (const f of present) for (const p of chains[f]) { const k = dot(p, axis); lo = Math.min(lo, k); hi = Math.max(hi, k); }
  const band = (hi - lo) * tolerance;
  for (let i = 0; i + 1 < present.length; i++) {
    const A = chains[present[i]], B = chains[present[i + 1]];
    const n = Math.min(A.length, B.length);
    let sign = 0, flippedAt = -1;
    for (let k = 0; k < n; k++) {
      const d = dot(A[k], axis) - dot(B[k], axis);
      if (Math.abs(d) < band) continue; // touching: no opinion about which side
      const s = Math.sign(d);
      if (sign === 0) sign = s;
      else if (s !== sign) { flippedAt = k; break; }
    }
    if (flippedAt >= 0) out.push({ a: present[i], b: present[i + 1], joint: flippedAt });
  }
  return out;
}

/**
 * Finger metrics for one capture.
 *
 * `reference` is the same structure from the T-pose capture, or null. The order
 * comparison against it only runs when both captures saw the SAME digit set —
 * `pose=rest` drives our 39-bone rig and `pose=pack:*` drives the pack author's
 * armature, and comparing an order across two skeletons is meaningless. When it
 * cannot run the field is `null`, never `true`.
 */
export function fingerMetrics(bones, reference = null) {
  const chains = digitChains(bones);
  const result = { sides: {}, available: false };
  for (const side of ['L', 'R']) {
    const digits = Object.keys(chains[side]);
    if (digits.length < 2) continue;
    result.available = true;
    const meanLen = digits.reduce((s, d) => s + chainLength(chains[side][d]), 0) / digits.length;
    let minGap = Infinity, worst = null;
    for (let i = 0; i < digits.length; i++) {
      for (let j = i + 1; j < digits.length; j++) {
        const A = chains[side][digits[i]], B = chains[side][digits[j]];
        let g = Infinity;
        for (let a = 1; a < A.length; a++) {
          for (let b = 1; b < B.length; b++) {
            g = Math.min(g, segmentDistance(A[a - 1], A[a], B[b - 1], B[b]));
          }
        }
        if (g < minGap) { minGap = g; worst = [digits[i], digits[j]]; }
      }
    }
    const order = digitOrder(chains[side]);
    // Fingers only, thumb excluded: the anatomical order must survive any pose.
    const fingerOrder = order.filter((d) => FINGERS.includes(d));
    const present = FINGERS.filter((f) => chains[side][f]);
    const crossings = chainCrossings(chains[side]);
    const refOrder = reference?.sides?.[side]?.fingerOrder ?? null;
    result.sides[side] = {
      digits: digits.length,
      meanDigitLength: Number(meanLen.toFixed(5)),
      // Reported, not gated — see chainCrossings for why a distance floor
      // cannot tell a mitten from a crossed chain. Kept because it is the
      // trend number a future per-body baseline would gate on.
      minGap: Number(minGap.toFixed(5)),
      minGapRatio: meanLen > 0 ? Number((minGap / meanLen).toFixed(4)) : null,
      worstPair: worst,
      order,
      fingerOrder,
      anatomicalOrderOk: present.length >= 2 ? sameOrder(fingerOrder, present) : null,
      crossings,
      orderMatchesReference: refOrder && sameOrder(refOrder.slice().sort(), fingerOrder.slice().sort())
        ? sameOrder(fingerOrder, refOrder)
        : null,
      referenceOrder: refOrder,
    };
  }
  return result;
}

// ------------------------------------------------------------- silhouette

/**
 * Connected components of a binary mask (1 = subject), 4-connected.
 * Returns island pixel areas, largest first. Iterative flood fill: a recursive
 * one blows the stack on a full-frame subject.
 */
export function maskIslands(mask, w, h) {
  const seen = new Uint8Array(w * h);
  const areas = [];
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || seen[i]) continue;
    let area = 0;
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const k = stack.pop();
      area++;
      const x = k % w, y = (k - x) / w;
      if (x > 0 && mask[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; stack.push(k - 1); }
      if (x < w - 1 && mask[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; stack.push(k + 1); }
      if (y > 0 && mask[k - w] && !seen[k - w]) { seen[k - w] = 1; stack.push(k - w); }
      if (y < h - 1 && mask[k + w] && !seen[k + w]) { seen[k + w] = 1; stack.push(k + w); }
    }
    areas.push(area);
  }
  return areas.sort((a, b) => b - a);
}

/**
 * Silhouette-break reading for one capture.
 * An island smaller than `minShare` of the total subject is antialiasing or a
 * stray eyelash, not a torn limb, so it is counted but not held against the
 * body. `breaks` is what the floor fires on.
 */
export function silhouetteMetrics(mask, w, h, { minShare = FLOORS.islandMinShare } = {}) {
  const areas = maskIslands(mask, w, h);
  const total = areas.reduce((s, a) => s + a, 0);
  const significant = total > 0 ? areas.filter((a) => a / total >= minShare) : [];
  return {
    inkFraction: Number((total / (w * h)).toFixed(4)),
    islands: areas.length,
    significantIslands: significant.length,
    breaks: Math.max(0, significant.length - 1),
    islandShares: significant.slice(0, 6).map((a) => Number((a / total).toFixed(4))),
    minShare,
  };
}

// ------------------------------------------------------------------ floors

/**
 * The gate's floors. Deliberately few, and each one is an UNARGUABLE failure
 * rather than a taste call — the part gate beside this one learned that lesson
 * the expensive way (partGate.mjs).
 */
export const FLOORS = {
  /** Below this the capture rendered nothing; every other number is noise. */
  minInk: 0.005,
  /**
   * Dead band for the crossing test, as a share of the hand's lateral spread.
   * Two chains that merely touch share a projection; without a band they would
   * alternate signs on float noise and every hand would "cross".
   */
  crossingTolerance: 0.02,
  /**
   * A second silhouette island smaller than this share of the subject is
   * antialiasing, not a torn limb.
   */
  islandMinShare: 0.005,
};

/**
 * Turn one capture's metrics into floor flags. Pure, so the test can drive it
 * with synthetic captures and prove the gate can actually FAIL — a gate nobody
 * has watched fail is a gate nobody knows works.
 */
export function motionFlags({ silhouette, fingers, driven = false, boneCount = null }) {
  const flags = [];
  if (silhouette.inkFraction < FLOORS.minInk) {
    flags.push(`empty capture (ink ${silhouette.inkFraction})`);
    return flags; // nothing else measured on this frame means anything
  }
  // The trap this whole gate exists to close: a body the Part Lab cannot drive
  // renders its STATIC mesh under a `pack:` pose and photographs beautifully.
  // A driven frame with no bones is a still wearing a clip's name.
  if (driven && boneCount === 0) {
    flags.push('driven frame has no bones — the clip drove nothing; this is a still, not motion');
  }
  if (silhouette.breaks > 0) {
    flags.push(`silhouette break (${silhouette.significantIslands} islands, shares ${silhouette.islandShares.join('/')})`);
  }
  if (!fingers.available) {
    // An unmeasured check is not a passed check (the rig gate's rule).
    flags.push('finger check unavailable (no digit bones found)');
  } else {
    for (const [side, s] of Object.entries(fingers.sides)) {
      for (const c of s.crossings ?? []) {
        flags.push(`finger interpenetration ${side} (${c.a} crosses ${c.b} at joint ${c.joint}; closest pair ${s.worstPair?.join('/')} at ${s.minGapRatio} of digit length)`);
      }
      if (s.anatomicalOrderOk === false) {
        flags.push(`crossed digit chains ${side} (order ${s.fingerOrder.join('<')} is not anatomical)`);
      }
      if (s.orderMatchesReference === false) {
        flags.push(`digit order moved from the T-pose ${side} (${s.fingerOrder.join('<')} vs ${s.referenceOrder.join('<')})`);
      }
    }
  }
  return flags;
}
