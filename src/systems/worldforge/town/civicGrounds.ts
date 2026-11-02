/**
 * @file civicGrounds.ts — the grounds around a temple, keep or citadel (GG-566).
 *
 * WHY THIS EXISTS (Remy 2026-11-01, Hafting: "temples don't get a connected
 * path or garden? ... or other logical temple set pieces (of course there are
 * different types of religions and set pieces)", and for the keep, "same
 * story"). A civic building was one plain square in the middle of its ward.
 * The deep lot rows stopped a lane short of it, so street houses closed it in
 * on every side: no approach, no forecourt, no grounds, and every temple and
 * every keep looked the same.
 *
 * The town engine now gives each civic building three things (it owns the
 * geometry, see `townEngine.generateTownPlan`):
 *  - an APPROACH: an open way from its best street to its door;
 *  - a FORECOURT: open paving in front of the door;
 *  - GROUNDS: the land around it that no house may take.
 * This module decides what the grounds hold. The choice comes from the
 * world, not from a roll: a temple follows the faith of its cell (the FMG
 * religion type and form), a keep follows the form of its state.
 *
 * Pure numbers: no React, no three.js, no import of `townEngine` at run time.
 */
import { fnv1a, type SeedPath } from '../seedPath';
import { pointInPolygon, type Pt } from '../submap/submapEngine';

/** What a civic building's grounds hold. */
export type CivicSetPiece =
  /** Graves in rows around a church: a monotheist or dualist faith, or ancestor worship. */
  | 'churchyard'
  /** A sacred grove of trees around the shrine: an animist, totemist or shamanist faith. */
  | 'grove'
  /** A temple precinct with a sacred pool behind the shrine: a polytheist faith. */
  | 'pool'
  /** A cloister (a covered walk round a garth) beside the house: a non-theist order, or a theocrat's seat. */
  | 'cloister'
  /** A curtain wall with a gatehouse round the keep: a monarch's or a lord's hold. */
  | 'bailey'
  /** An open yard before a council hall: the seat of a republic or a league. */
  | 'hall-yard'
  /** Plain grounds: no faith or holder is known (a schematic plan). */
  | 'grounds'
  /** A market square: stalls in rows, a centerpiece, and in larger towns a hall (GG-586, `marketSquare.ts`). */
  | 'market';

/** One feature drawn on the grounds. */
export interface CivicGroundsFeature {
  kind: 'grave' | 'tree' | 'pool' | 'cloister-walk' | 'garth' | 'curtain-wall' | 'gatehouse' | 'yard'
    // The market square (GG-586). A stall is a rectangle from `orientedRect`;
    // its customer side is the edge from corner 2 to corner 3.
    | 'stall' | 'well' | 'market-cross' | 'fountain' | 'market-hall' | 'weigh-house' | 'pillory';
  polygon: Pt[];
}

/**
 * The grounds of one temple, keep or citadel, in the plan's own frame. A market
 * square (GG-586) uses the same record: its civic kind is `plaza`, its grounds
 * are the square, and it has no forecourt and no approach.
 */
export interface CivicGrounds {
  /** Ward the civic building stands in (as on `CivicStructure.wardIndex`). */
  wardIndex: number;
  civicKind: 'temple' | 'keep' | 'citadel' | 'plaza';
  setPiece: CivicSetPiece;
  /** The faith or holder form the set piece was chosen from, for the record. */
  chosenBy: string;
  /** All the land the building owns: no house stands on it. */
  grounds: Pt[];
  /** Open paving between the door and the approach. */
  forecourt: Pt[];
  /** Centerline of the approach, from the door out to the street centerline. */
  approach: Pt[];
  /** Full width of the approach, in plan units. */
  approachWidth: number;
  features: CivicGroundsFeature[];
}

/** The faith of a town's cell: an FMG religion's type and form. */
export interface TownFaith {
  /** 'Folk' or 'Organized' (FMG). */
  type: string;
  /** 'Monotheism', 'Polytheism', 'Animism', ... (FMG). */
  form: string;
}

/** Who holds a town's keep: the FMG form of its state. */
export interface TownHolder {
  /** 'Monarchy', 'Theocracy', 'Republic' or 'Union' (FMG). */
  form: string;
}

/**
 * The temple set piece for a faith. Every FMG religion form has an answer
 * (the `forms` table in `fmg/religions-generator.ts`: Folk, Organized, Cult
 * and Heresy).
 * An unknown form is an error, not a default (the no-fallback directive);
 * only a plan with no faith at all gets plain grounds.
 */
export function templeSetPiece(faith: TownFaith | undefined): { setPiece: CivicSetPiece; chosenBy: string } {
  if (!faith) return { setPiece: 'grounds', chosenBy: 'no faith given' };
  const chosenBy = `${faith.type} ${faith.form}`;
  switch (faith.form) {
    case 'Monotheism':
    case 'Dualism':
    case 'Ancestor Worship':
      return { setPiece: 'churchyard', chosenBy };
    // A heresy keeps the church and the dead of the faith it broke from.
    case 'Heresy':
      return { setPiece: 'churchyard', chosenBy };
    case 'Animism':
    case 'Totemism':
    case 'Shamanism':
    case 'Nature Worship':
    case 'Pantheism':
    // An open cult meets in a sacred grove.
    case 'Cult':
      return { setPiece: 'grove', chosenBy };
    case 'Polytheism':
      return { setPiece: 'pool', chosenBy };
    case 'Non-theism':
    // A closed order (a sect, a dark cult) keeps behind a cloister wall.
    case 'Sect':
    case 'Dark Cult':
      return { setPiece: 'cloister', chosenBy };
    default:
      throw new Error(`[civicGrounds] No temple set piece for the faith form "${faith.form}".`);
  }
}

/** The stronghold set piece for a holder. A citadel is always a walled hold. */
export function strongholdSetPiece(kind: 'keep' | 'citadel', holder: TownHolder | undefined): { setPiece: CivicSetPiece; chosenBy: string } {
  if (kind === 'citadel') return { setPiece: 'bailey', chosenBy: 'citadel' };
  if (!holder) return { setPiece: 'grounds', chosenBy: 'no holder given' };
  const chosenBy = holder.form;
  switch (holder.form) {
    case 'Monarchy':
      return { setPiece: 'bailey', chosenBy };
    case 'Theocracy':
      return { setPiece: 'cloister', chosenBy };
    case 'Republic':
    case 'Union':
    // An anarchy is ruled by a council or a commune: a hall, not a keep.
    case 'Anarchy':
      return { setPiece: 'hall-yard', chosenBy };
    default:
      throw new Error(`[civicGrounds] No keep set piece for the state form "${holder.form}".`);
  }
}

/** A rectangle centered at `c`, `w` across `side` and `d` along `face`. */
export function orientedRect(c: Pt, face: Pt, w: number, d: number): Pt[] {
  const s: Pt = [-face[1], face[0]];
  const hw = w / 2, hd = d / 2;
  return [
    [c[0] - s[0] * hw - face[0] * hd, c[1] - s[1] * hw - face[1] * hd],
    [c[0] + s[0] * hw - face[0] * hd, c[1] + s[1] * hw - face[1] * hd],
    [c[0] + s[0] * hw + face[0] * hd, c[1] + s[1] * hw + face[1] * hd],
    [c[0] - s[0] * hw + face[0] * hd, c[1] - s[1] * hw + face[1] * hd],
  ];
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const L2 = vx * vx + vy * vy;
  const t = L2 > 1e-12 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy);
}

export interface SetPieceInput {
  setPiece: CivicSetPiece;
  grounds: Pt[];
  building: Pt[];
  /** Building center. */
  center: Pt;
  /** Unit vector from the building toward its approach. */
  face: Pt;
  /** Half the building's side, in plan units. */
  halfSize: number;
  forecourt: Pt[];
  approach: Pt[];
  approachWidth: number;
  unit: (ft: number) => number;
  seedPath: SeedPath;
}

/**
 * The features of a set piece, all inside the grounds and clear of the
 * building, the forecourt and the approach. Deterministic per `seedPath`.
 */
export function setPieceFeatures(a: SetPieceInput): CivicGroundsFeature[] {
  const { grounds, center: c, face: f, unit } = a;
  const s: Pt = [-f[1], f[0]];
  const hb = a.halfSize;
  const clearOf = (poly: Pt[], gap: number): boolean => {
    if (!poly.every((p) => pointInPolygon(p, grounds))) return false;
    for (const p of poly) {
      // Off the building (with a walkway), the forecourt and the approach.
      const lx = (p[0] - c[0]) * s[0] + (p[1] - c[1]) * s[1];
      const ly = (p[0] - c[0]) * f[0] + (p[1] - c[1]) * f[1];
      if (Math.abs(lx) < hb + gap && Math.abs(ly) < hb + gap) return false;
      if (pointInPolygon(p, a.forecourt)) return false;
      for (let i = 0; i < a.approach.length - 1; i++) {
        if (segDist(p, a.approach[i], a.approach[i + 1]) < a.approachWidth / 2 + gap) return false;
      }
    }
    return true;
  };
  const hash = (k: string): number => fnv1a(`${a.seedPath}|${k}`) / 0xffffffff;
  // Local grid over the grounds, in the building's own frame.
  let minS = Infinity, maxS = -Infinity, minF = Infinity, maxF = -Infinity;
  for (const p of grounds) {
    const ls = (p[0] - c[0]) * s[0] + (p[1] - c[1]) * s[1];
    const lf = (p[0] - c[0]) * f[0] + (p[1] - c[1]) * f[1];
    minS = Math.min(minS, ls); maxS = Math.max(maxS, ls); minF = Math.min(minF, lf); maxF = Math.max(maxF, lf);
  }
  const at = (ls: number, lf: number): Pt => [c[0] + s[0] * ls + f[0] * lf, c[1] + s[1] * ls + f[1] * lf];
  const out: CivicGroundsFeature[] = [];

  switch (a.setPiece) {
    case 'churchyard': {
      // Graves in rows, head to foot along the church's axis, a path apart.
      const stepS = unit(6), stepF = unit(10);
      for (let lf = minF + stepF / 2; lf < maxF; lf += stepF) {
        for (let ls = minS + stepS / 2; ls < maxS; ls += stepS) {
          if (hash(`grave:${ls.toFixed(2)}:${lf.toFixed(2)}`) < 0.3) continue;
          const g = orientedRect(at(ls, lf), f, unit(3), unit(7));
          if (clearOf(g, unit(4))) out.push({ kind: 'grave', polygon: g });
          if (out.length >= 120) return out;
        }
      }
      return out;
    }
    case 'grove': {
      // Trees on a loose grid, each nudged off its cell center.
      const step = unit(16), r = unit(6);
      for (let lf = minF + step / 2; lf < maxF; lf += step) {
        for (let ls = minS + step / 2; ls < maxS; ls += step) {
          const k = `tree:${ls.toFixed(2)}:${lf.toFixed(2)}`;
          const p = at(ls + (hash(`${k}:s`) - 0.5) * step * 0.5, lf + (hash(`${k}:f`) - 0.5) * step * 0.5);
          const crown: Pt[] = [];
          for (let q = 0; q < 8; q++) crown.push([p[0] + Math.cos((q * Math.PI) / 4) * r, p[1] + Math.sin((q * Math.PI) / 4) * r]);
          if (clearOf(crown, unit(3))) out.push({ kind: 'tree', polygon: crown });
          if (out.length >= 60) return out;
        }
      }
      return out;
    }
    case 'pool': {
      // The sacred pool lies behind the shrine, on its axis; it shrinks to fit.
      for (let k = 1; k >= 0.3; k -= 0.1) {
        const depth = unit(24) * k, width = hb * 1.6 * k;
        const pool = orientedRect(at(0, -(hb + unit(8) + depth / 2)), f, width, depth);
        if (clearOf(pool, unit(2))) return [{ kind: 'pool', polygon: pool }];
      }
      return out;
    }
    case 'cloister': {
      // A cloister against one side of the building: a covered walk round an
      // open garth, as long as the building and as deep as the ground there
      // allows. The side with more ground wins.
      const walk = unit(6);
      const gap = unit(1);
      for (const dir of maxS + minS >= 0 ? [1, -1] : [-1, 1]) {
        const room = (dir > 0 ? maxS : -minS) - hb - gap - unit(2);
        for (let k = 1; k >= 0.5; k -= 0.1) {
          const w = Math.min(hb * 2, room) * k;
          const l = hb * 2 * 0.9 * k;
          if (w < unit(16)) break;
          const mid = at(dir * (hb + gap + w / 2), 0);
          const outer = orientedRect(mid, f, w, l);
          if (!outer.every((p) => pointInPolygon(p, grounds))) continue;
          const inner = orientedRect(mid, f, w - 2 * walk, l - 2 * walk);
          return [{ kind: 'cloister-walk', polygon: outer }, { kind: 'garth', polygon: inner }];
        }
      }
      return out;
    }
    case 'bailey': {
      // The curtain wall runs round the grounds; the gatehouse stands where
      // the approach passes through it.
      const wall = shrinkToward(grounds, c, unit(3));
      out.push({ kind: 'curtain-wall', polygon: wall });
      const hit = rayHit(c, f, wall);
      if (hit) out.push({ kind: 'gatehouse', polygon: orientedRect(hit, f, Math.max(a.approachWidth + unit(8), unit(18)), unit(14)) });
      return out;
    }
    case 'hall-yard': {
      // An open yard before the hall, wider than the forecourt.
      for (let k = 1; k >= 0.4; k -= 0.1) {
        const d = unit(30) * k;
        const yard = orientedRect(at(0, hb + d / 2), f, hb * 3 * k, d);
        if (yard.every((p) => pointInPolygon(p, grounds))) return [{ kind: 'yard', polygon: yard }];
      }
      return out;
    }
    case 'grounds':
    // A market square places its own pieces (`marketSquare.ts`).
    case 'market':
      return out;
  }
}

/** Move every vertex `d` toward `center` (a simple inset for a near-convex ring). */
function shrinkToward(poly: Pt[], center: Pt, d: number): Pt[] {
  return poly.map((p) => {
    const dx = p[0] - center[0], dy = p[1] - center[1];
    const L = Math.hypot(dx, dy);
    return L > d * 2 ? [p[0] - (dx / L) * d, p[1] - (dy / L) * d] as Pt : [p[0], p[1]] as Pt;
  });
}

/** First crossing of the ray `c + t·dir` (t > 0) with a ring. */
function rayHit(c: Pt, dir: Pt, ring: Pt[]): Pt | null {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const det = ex * dir[1] - dir[0] * ey;
    if (Math.abs(det) < 1e-12) continue;
    const acx = a[0] - c[0], acy = a[1] - c[1];
    const t = (ex * acy - ey * acx) / det;
    const u = (dir[0] * acy - dir[1] * acx) / det;
    if (t > 0 && u >= 0 && u <= 1 && t < best) best = t;
  }
  return isFinite(best) ? [c[0] + dir[0] * best, c[1] + dir[1] * best] : null;
}
