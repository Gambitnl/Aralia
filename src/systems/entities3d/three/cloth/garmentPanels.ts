/**
 * @file garmentPanels.ts — the cut of each simulated garment: a particle grid
 * at rest, which rows pin to which bones, and how soft the cloth is.
 *
 * Character cloth+armor campaign, slice 1b (2026-11-04). A panel is the data
 * a cloth solver needs and nothing else. The solver itself (GPU particle
 * cloth, Remy's pick on sheet 71CWggvG q3) reads this; whichever GPU path q10
 * settles takes the same panel, so this file does not wait on that answer.
 *
 * The method follows entity-forge src/anim/cloth.ts clothPanels (a grid,
 * open for a cape, closed into a tube for a skirt; pinned rows follow a bone;
 * surplus width so the sheet must fold), reimplemented against our skeleton
 * and our measured body colliders. One rule is new here: every rest point is
 * pushed clear of the body colliders before the first frame, so a garment
 * never starts inside the body it hangs on. Cape first: Remy's q4 order, and
 * it shows the physics fastest.
 */
import type { BipedBoneName } from '../skeletonBuilder';
import { CLOTH_COLLIDER_STRIDE, colliderClearance, packRestColliders, type ClothCollider } from './bodyColliders';

export interface ClothPin {
  /** Grid index (row * cols + col) of the pinned point. */
  index: number;
  bone: BipedBoneName;
}

export interface ClothPanel {
  /** Which garment this is (for names, tests and materials). */
  kind: 'cape';
  rows: number;
  cols: number;
  /** True for a tube (skirt, robe): the last column joins the first. */
  wrap: boolean;
  /** Rest positions, entity-local meters, rows * cols * 3 floats, row-major
   * from the top row. */
  rest: Float32Array;
  /** Points held to a bone frame every step. */
  pins: ClothPin[];
  /** Across-the-row rest lengths are this much longer than the rest shape,
   * so the sheet has more cloth than it can lie flat on and folds (entity-
   * forge fm-003, fm-010). 1 = taut. The top two rows stay taut. */
  slack: number;
  /** Bend stiffness 0..1; low folds, high stays flat. */
  bend: number;
  /** Ids of the body colliders this panel collides with. */
  colliders: string[];
}

export type CapeLength = 'hip' | 'knee' | 'calf' | 'ankle';

export interface CapeOptions {
  length: CapeLength;
}

/** Collider set a cape touches: the back, shoulders, arms (they swing into
 * it) and the legs below the hem line it can reach. The head stays out — a
 * cape hangs from the shoulders, and a hood is its own panel. */
const CAPE_COLLIDERS = [
  'torso.pelvis', 'torso.chest', 'neck', 'clavicleL', 'clavicleR', 'deltoidL', 'deltoidR',
  'armL.upper', 'armL.fore', 'handL.palm', 'armR.upper', 'armR.fore', 'handR.palm',
  'legL.thigh', 'legL.shin', 'legR.thigh', 'legR.shin',
];

function colliderById(colliders: readonly ClothCollider[], id: string): ClothCollider {
  const c = colliders.find((k) => k.id === id);
  if (!c) throw new Error(`garmentPanels: body collider "${id}" is missing`);
  return c;
}

/**
 * The cape: an open sheet pinned along the shoulder line, behind the neck,
 * hanging down the back. Sized from the body colliders, so it fits any race
 * without per-race numbers: the top row spans the two deltoids, the sheet
 * flares to 1.25 times that at the hem, and the hem height comes from the
 * leg colliders (hip = top of the thigh, knee = thigh end, calf = mid shin,
 * ankle = shin end).
 */
export function capePanel(colliders: readonly ClothCollider[], heightM: number, options: CapeOptions): ClothPanel {
  const chest = colliderById(colliders, 'torso.chest');
  const delL = colliderById(colliders, 'deltoidL');
  const delR = colliderById(colliders, 'deltoidR');
  const clavL = colliderById(colliders, 'clavicleL');
  const thigh = colliderById(colliders, 'legL.thigh');
  const shin = colliderById(colliders, 'legL.shin');

  // shoulder line: clavicle height, out to the deltoid centers
  const topY = clavL.a[1] + 0.01 * heightM;
  // round 3 (2026-11-04): 0.88 of the deltoid span, not 1.05. At full span
  // the dwarf's hanging arms sat on the cape edges, caught them every swing
  // and dragged the cloth round to the front. Narrower, the edges stay behind
  // the arm swing; the shoulder wrap below still carries the top over them.
  const halfTop = (Math.abs(delL.a[0] - delR.a[0]) / 2) * 0.88;
  // round 2 (2026-11-04): 1.25 spread the hem like a sack; the target
  // knight's cape falls nearly straight with a slight flare
  const halfHem = halfTop * 1.12;
  const hemY =
    options.length === 'hip' ? thigh.a[1] :
    options.length === 'knee' ? thigh.b[1] :
    options.length === 'calf' ? (shin.a[1] + shin.b[1]) / 2 :
    shin.b[1] + 0.02 * heightM;
  const length = topY - hemY;
  if (length <= 0.1 * heightM) throw new Error('garmentPanels: cape hem is above the shoulders');

  // grid: about 3% of stature between points, so a fold has room to form
  // (entity-forge fm-003: a coarse grid hangs as a board)
  const spacing = 0.03 * heightM;
  const cols = Math.max(13, Math.round((halfHem * 2) / spacing) + 1);
  const rows = Math.max(13, Math.round(length / spacing) + 1);

  // the back of the chest collider at the shoulder line is where the sheet
  // starts; it then falls straight, and the collider push below moves any
  // point that starts inside the body out behind it
  const backZ = chest.a[2] - Math.max(...chest.hz) - 0.01 * heightM;
  const rest = new Float32Array(rows * cols * 3);
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const half = halfTop + (halfHem - halfTop) * t;
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1) - 0.5;
      // the top rows wrap forward around the shoulders (an arc, deepest at
      // the sides, fading over three rows) so the cape sits ON the shoulders
      // and shows past them from the front. The first render (2026-11-04)
      // had a 0.06 H wrap on row 0 only, and the cape hid behind the
      // pauldrons in every front view.
      // (round 3: the wrap scales with the cape width, not stature — 0.1 H
      // folded a broad dwarf's cape forward over the shoulders)
      const wrap = u * u * 4 * 0.3 * halfTop * Math.max(0, 1 - r / 3);
      const o = (r * cols + c) * 3;
      rest[o] = u * 2 * half;
      rest[o + 1] = topY - t * length;
      rest[o + 2] = backZ + wrap;
    }
  }

  // Push every rest point clear of the colliders the cape touches: march it
  // backward (−Z) until it is outside all of them. A garment that starts
  // inside the body fights its own colliders on the first frame and pops.
  const used = CAPE_COLLIDERS.map((id) => colliderById(colliders, id));
  const caps = new Float32Array(used.length * CLOTH_COLLIDER_STRIDE);
  packRestColliders(used, caps);
  const step = 0.002 * heightM;
  for (let i = 0; i < rows * cols; i++) {
    const o = i * 3;
    let guard = 0;
    while (colliderClearance(caps, used.length, rest[o], rest[o + 1], rest[o + 2]) < 0.002 * heightM && guard++ < 400) {
      rest[o + 2] -= step;
    }
    if (guard >= 400) throw new Error('garmentPanels: a cape point could not be cleared of the body');
  }

  // pins: the whole top row. The middle third follows the chest, the outer
  // thirds follow their clavicle, so a raised arm lifts its side of the cape.
  const pins: ClothPin[] = [];
  for (let c = 0; c < cols; c++) {
    const u = c / (cols - 1);
    const bone: BipedBoneName = u < 1 / 3 ? 'clavicleL' : u > 2 / 3 ? 'clavicleR' : 'chest';
    pins.push({ index: c, bone });
  }
  // grid x runs −half → +half from col 0; the LEFT clavicle sits at −x
  // (deltoidL.a[0] < 0, measured), so col 0 is the left side
  if (delL.a[0] > 0) for (const p of pins) p.bone = p.bone === 'clavicleL' ? 'clavicleR' : p.bone === 'clavicleR' ? 'clavicleL' : p.bone;

  // round 2 (2026-11-04): slack 1.2 + bend 0.03 (the entity-forge values for a
  // realistic body) crumpled into paper-bag wrinkles. The target lineup has
  // a few broad soft folds, so the surplus drops and the bend stiffens.
  return { kind: 'cape', rows, cols, wrap: false, rest, pins, slack: 1.08, bend: 0.2, colliders: CAPE_COLLIDERS };
}
