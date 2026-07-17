/**
 * @file planSchema.ts — the body-plan language for text-to-creature.
 *
 * A CreaturePlan is what the LLM writes: a constrained JSON description of a
 * creature's skeleton (spine + free appendage chains + heads + palette +
 * optional known-part garnish). Motion is NOT in the language — animation
 * derives from appendage kind, keeping the LLM out of tuning.
 *
 * Validation is total and loud: every rule produces a named error and the
 * caller gets the full list. There is no clamping and no fallback — a bad
 * plan fails, and the retry prompt carries these errors verbatim.
 *
 * Spec: docs/superpowers/specs/2026-07-15-text-to-creature-design.md.
 */

export interface PlanChainLink {
  /** Link length in feet (feet-canon like the rest of the generator). */
  lenFt: number;
  /** Link radius as a fraction of the frame's base body radius. */
  r: number;
}

export interface PlanAppendage {
  kind: 'leg' | 'arm' | 'tail' | 'tentacle' | 'neck' | 'wing' | 'torso';
  /** 0 (spine front) – 1 (spine rear). */
  attach: number;
  /** Index of a 'torso' appendage to root on (arms/necks/wings/tentacles only) —
   * the tauric seam: a centaur's arms ride its torso, not the horse spine. */
  parent?: number;
  /** 0–1 attachment height on the body; defaults per kind (see PLAN_DEFAULT_HEIGHT_FRAC). */
  heightFrac?: number;
  /** true = mirrored left/right pair. */
  perSide?: boolean;
  /** 1–4 (per side when perSide). */
  count: number;
  /** 1–8 tapered links, root to tip. */
  chain: PlanChainLink[];
  /** Terminator: 'hand' = stylized palm + fingers at the tip (arms/tentacles/wings — legs already get feet). */
  tips?: 'hand';
  /** Floating accent-colored energy rings hovering at each interior joint. */
  jointRings?: boolean;
}

export interface PlanHead {
  /** Index of a 'neck' appendage to ride; omitted = spine front. */
  neckIndex?: number;
  /** Sculpted head form (platonic-solid skull + jaw + teeth); omitted = plain ball. */
  form?: 'serpent' | 'beast' | 'blunt' | 'skull';
  /** 0.4–2 of the frame-derived head radius. */
  sizeScale: number;
  eyes: { count: number; sizeScale: number; pupil?: 'round' | 'slit' | 'goat' };
  snout?: { lengthScale: number; droop: number };
  /** Ring of twitching fleshy lashes around each eye instead of lids. */
  cilia?: boolean;
}

export interface CreaturePlan {
  name: string;
  frame: {
    heightFt: number;
    /** Nose-to-tail body length; required for horizontal/serpentine stances. */
    lengthFt?: number;
    /** 0–1 radius scale. */
    bulk: number;
    stance: 'upright' | 'horizontal' | 'serpentine' | 'floating';
  };
  /** shape 'box' renders the body as rectangular slabs (cubes, chests, golems);
   * bulge 0–1 swells the mid-body (muscle mass). */
  spine: { segments: number; taper: number; arch: number; shape?: 'round' | 'box'; bulge?: number };
  appendages: PlanAppendage[];
  heads: PlanHead[];
  /** opacity < 1 = translucent body (ghosts, oozes); eyes stay solid. */
  palette: { bodyHex: string; accentHex?: string; bellyHex?: string; eyeHex: string; opacity?: number };
  garnish?: Array<{ partId: string; params?: Record<string, number> }>;
}

/** Hard ranges — exported so the CLI prompt can state them exactly. */
export const PLAN_LIMITS = {
  nameChars: [1, 40],
  heightFt: [0.5, 30],
  lengthFt: [1, 60],
  bulk: [0, 1],
  spineSegments: [2, 8],
  spineTaper: [0.3, 1],
  spineArch: [-0.5, 0.5],
  spineBulge: [0, 1],
  appendages: [0, 12],
  attach: [0, 1],
  heightFrac: [0, 1],
  count: [1, 4],
  chainLinks: [1, 8],
  linkLenFt: [0.1, 12],
  linkR: [0.02, 1],
  heads: [1, 12],
  opacity: [0.2, 1],
  headSizeScale: [0.4, 2],
  eyeCount: [0, 8],
  eyeSizeScale: [0.4, 2],
  snoutLengthScale: [0.3, 2.5],
  snoutDroop: [-0.6, 0.8],
  garnish: [0, 8],
} as const;

/** Default attachment height on the body, per appendage kind. */
export const PLAN_DEFAULT_HEIGHT_FRAC: Record<PlanAppendage['kind'], number> = {
  leg: 0.05,
  arm: 0.75,
  tail: 0.35,
  tentacle: 0.4,
  neck: 0.9,
  wing: 0.8,
  torso: 0.85,
};

const APPENDAGE_KINDS = new Set(['leg', 'arm', 'tail', 'tentacle', 'neck', 'wing', 'torso']);
/** Kinds that may ride a torso via `parent`. */
const PARENTABLE_KINDS = new Set(['arm', 'neck', 'wing', 'tentacle']);
const STANCES = new Set(['upright', 'horizontal', 'serpentine', 'floating']);
const HEX_RE = /^#[0-9a-f]{6}$/i;

type Errs = string[];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkKeys(errs: Errs, obj: Record<string, unknown>, allowed: string[], path: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) errs.push(`unknown field ${path ? `${path}.` : ''}${key}`);
  }
}

function checkRange(errs: Errs, v: unknown, [lo, hi]: readonly [number, number], path: string): v is number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    errs.push(`${path} must be a number`);
    return false;
  }
  if (v < lo || v > hi) {
    errs.push(`${path} ${v} outside ${lo}–${hi}`);
    return false;
  }
  return true;
}

function checkHex(errs: Errs, v: unknown, path: string): void {
  if (typeof v !== 'string' || !HEX_RE.test(v)) errs.push(`${path} must be a #rrggbb color`);
}

/**
 * Validate a candidate plan. Returns [] when valid; otherwise every named
 * problem found in one pass (the LLM retry prompt includes them all).
 */
export function validateCreaturePlan(input: unknown, knownPartIds: ReadonlySet<string>): string[] {
  const errs: Errs = [];
  if (!isObj(input)) return ['plan is not an object'];
  checkKeys(errs, input, ['name', 'frame', 'spine', 'appendages', 'heads', 'palette', 'garnish'], '');

  // name
  if (typeof input.name !== 'string' || input.name.length < PLAN_LIMITS.nameChars[0] || input.name.length > PLAN_LIMITS.nameChars[1]) {
    errs.push(`name must be a string of ${PLAN_LIMITS.nameChars[0]}–${PLAN_LIMITS.nameChars[1]} characters`);
  }

  // frame
  if (!isObj(input.frame)) {
    errs.push('frame must be an object');
  } else {
    const f = input.frame;
    checkKeys(errs, f, ['heightFt', 'lengthFt', 'bulk', 'stance'], 'frame');
    checkRange(errs, f.heightFt, PLAN_LIMITS.heightFt, 'frame.heightFt');
    checkRange(errs, f.bulk, PLAN_LIMITS.bulk, 'frame.bulk');
    const stanceOk = typeof f.stance === 'string' && STANCES.has(f.stance);
    if (!stanceOk) errs.push(`frame.stance must be one of upright|horizontal|serpentine|floating`);
    if (f.lengthFt !== undefined) checkRange(errs, f.lengthFt, PLAN_LIMITS.lengthFt, 'frame.lengthFt');
    if (stanceOk && (f.stance === 'horizontal' || f.stance === 'serpentine') && f.lengthFt === undefined) {
      errs.push(`frame.lengthFt is required for ${String(f.stance)} stance`);
    }
  }

  // spine
  if (!isObj(input.spine)) {
    errs.push('spine must be an object');
  } else {
    const s = input.spine;
    checkKeys(errs, s, ['segments', 'taper', 'arch', 'shape', 'bulge'], 'spine');
    if (checkRange(errs, s.segments, PLAN_LIMITS.spineSegments, 'spine.segments') && !Number.isInteger(s.segments)) {
      errs.push('spine.segments must be an integer');
    }
    checkRange(errs, s.taper, PLAN_LIMITS.spineTaper, 'spine.taper');
    checkRange(errs, s.arch, PLAN_LIMITS.spineArch, 'spine.arch');
    if (s.bulge !== undefined) checkRange(errs, s.bulge, PLAN_LIMITS.spineBulge, 'spine.bulge');
    if (s.shape !== undefined && s.shape !== 'round' && s.shape !== 'box') {
      errs.push(`spine.shape must be 'round' or 'box'`);
    }
  }

  // appendages
  const appendages: unknown[] = Array.isArray(input.appendages) ? input.appendages : [];
  if (!Array.isArray(input.appendages)) {
    errs.push('appendages must be an array');
  } else if (input.appendages.length > PLAN_LIMITS.appendages[1]) {
    errs.push(`appendages has ${input.appendages.length} entries, maximum ${PLAN_LIMITS.appendages[1]}`);
  }
  appendages.forEach((a, i) => {
    const path = `appendages[${i}]`;
    if (!isObj(a)) {
      errs.push(`${path} must be an object`);
      return;
    }
    checkKeys(errs, a, ['kind', 'attach', 'heightFrac', 'perSide', 'count', 'chain', 'tips', 'jointRings', 'parent'], path);
    if (typeof a.kind !== 'string' || !APPENDAGE_KINDS.has(a.kind)) {
      errs.push(`${path}.kind must be one of leg|arm|tail|tentacle|neck|wing|torso`);
    }
    if (a.parent !== undefined) {
      const target = typeof a.parent === 'number' && Number.isInteger(a.parent) ? appendages[a.parent] : undefined;
      const targetKind = isObj(target) ? target.kind : undefined;
      if (typeof a.kind === 'string' && !PARENTABLE_KINDS.has(a.kind)) {
        errs.push(`${path}.parent is only allowed on arm|neck|wing|tentacle (not ${String(a.kind)})`);
      } else if (targetKind !== 'torso' || a.parent === i) {
        errs.push(`${path}.parent ${String(a.parent)} must point at an appendage of kind torso`);
      }
    }
    if (a.tips !== undefined) {
      if (a.tips !== 'hand') {
        errs.push(`${path}.tips must be 'hand' when present`);
      } else if (a.kind === 'leg' || a.kind === 'torso') {
        errs.push(`${path}.tips is not allowed on ${String(a.kind)}s`);
      }
    }
    if (a.jointRings !== undefined && typeof a.jointRings !== 'boolean') {
      errs.push(`${path}.jointRings must be a boolean`);
    }
    checkRange(errs, a.attach, PLAN_LIMITS.attach, `${path}.attach`);
    if (a.heightFrac !== undefined) checkRange(errs, a.heightFrac, PLAN_LIMITS.heightFrac, `${path}.heightFrac`);
    if (a.perSide !== undefined && typeof a.perSide !== 'boolean') errs.push(`${path}.perSide must be a boolean`);
    if (checkRange(errs, a.count, PLAN_LIMITS.count, `${path}.count`) && !Number.isInteger(a.count)) {
      errs.push(`${path}.count must be an integer`);
    }
    if (!Array.isArray(a.chain) || a.chain.length < PLAN_LIMITS.chainLinks[0] || a.chain.length > PLAN_LIMITS.chainLinks[1]) {
      errs.push(`${path}.chain must have ${PLAN_LIMITS.chainLinks[0]}–${PLAN_LIMITS.chainLinks[1]} links`);
    } else {
      a.chain.forEach((link, j) => {
        const lp = `${path}.chain[${j}]`;
        if (!isObj(link)) {
          errs.push(`${lp} must be an object`);
          return;
        }
        checkKeys(errs, link, ['lenFt', 'r'], lp);
        checkRange(errs, link.lenFt, PLAN_LIMITS.linkLenFt, `${lp}.lenFt`);
        checkRange(errs, link.r, PLAN_LIMITS.linkR, `${lp}.r`);
      });
    }
  });

  // heads
  const heads: unknown[] = Array.isArray(input.heads) ? input.heads : [];
  if (!Array.isArray(input.heads) || input.heads.length < PLAN_LIMITS.heads[0] || input.heads.length > PLAN_LIMITS.heads[1]) {
    errs.push(`heads must have ${PLAN_LIMITS.heads[0]}–${PLAN_LIMITS.heads[1]} entries`);
  }
  heads.forEach((h, i) => {
    const path = `heads[${i}]`;
    if (!isObj(h)) {
      errs.push(`${path} must be an object`);
      return;
    }
    checkKeys(errs, h, ['neckIndex', 'sizeScale', 'eyes', 'snout', 'cilia', 'form'], path);
    if (h.form !== undefined && h.form !== 'serpent' && h.form !== 'beast' && h.form !== 'blunt' && h.form !== 'skull') {
      errs.push(`${path}.form must be serpent|beast|blunt|skull`);
    }
    if (h.cilia !== undefined && typeof h.cilia !== 'boolean') {
      errs.push(`${path}.cilia must be a boolean`);
    }
    if (h.neckIndex !== undefined) {
      const idx = h.neckIndex;
      const target = typeof idx === 'number' && Number.isInteger(idx) ? appendages[idx] : undefined;
      const targetKind = isObj(target) ? target.kind : undefined;
      if (targetKind !== 'neck' && targetKind !== 'torso') {
        errs.push(`${path}.neckIndex ${String(idx)} must point at an appendage of kind neck or torso`);
      }
    }
    checkRange(errs, h.sizeScale, PLAN_LIMITS.headSizeScale, `${path}.sizeScale`);
    if (!isObj(h.eyes)) {
      errs.push(`${path}.eyes must be an object`);
    } else {
      checkKeys(errs, h.eyes, ['count', 'sizeScale', 'pupil'], `${path}.eyes`);
      if (h.eyes.pupil !== undefined && h.eyes.pupil !== 'round' && h.eyes.pupil !== 'slit' && h.eyes.pupil !== 'goat') {
        errs.push(`${path}.eyes.pupil must be round|slit|goat`);
      }
      if (checkRange(errs, h.eyes.count, PLAN_LIMITS.eyeCount, `${path}.eyes.count`) && !Number.isInteger(h.eyes.count)) {
        errs.push(`${path}.eyes.count must be an integer`);
      }
      checkRange(errs, h.eyes.sizeScale, PLAN_LIMITS.eyeSizeScale, `${path}.eyes.sizeScale`);
    }
    if (h.snout !== undefined) {
      if (!isObj(h.snout)) {
        errs.push(`${path}.snout must be an object`);
      } else {
        checkKeys(errs, h.snout, ['lengthScale', 'droop'], `${path}.snout`);
        checkRange(errs, h.snout.lengthScale, PLAN_LIMITS.snoutLengthScale, `${path}.snout.lengthScale`);
        checkRange(errs, h.snout.droop, PLAN_LIMITS.snoutDroop, `${path}.snout.droop`);
      }
    }
  });

  // palette
  if (!isObj(input.palette)) {
    errs.push('palette must be an object');
  } else {
    const p = input.palette;
    checkKeys(errs, p, ['bodyHex', 'accentHex', 'bellyHex', 'eyeHex', 'opacity'], 'palette');
    checkHex(errs, p.bodyHex, 'palette.bodyHex');
    checkHex(errs, p.eyeHex, 'palette.eyeHex');
    if (p.accentHex !== undefined) checkHex(errs, p.accentHex, 'palette.accentHex');
    if (p.bellyHex !== undefined) checkHex(errs, p.bellyHex, 'palette.bellyHex');
    if (p.opacity !== undefined) checkRange(errs, p.opacity, PLAN_LIMITS.opacity, 'palette.opacity');
  }

  // garnish
  if (input.garnish !== undefined) {
    if (!Array.isArray(input.garnish) || input.garnish.length > PLAN_LIMITS.garnish[1]) {
      errs.push(`garnish must be an array of at most ${PLAN_LIMITS.garnish[1]} entries`);
    } else {
      input.garnish.forEach((g, i) => {
        const path = `garnish[${i}]`;
        if (!isObj(g)) {
          errs.push(`${path} must be an object`);
          return;
        }
        checkKeys(errs, g, ['partId', 'params'], path);
        if (typeof g.partId !== 'string' || !knownPartIds.has(g.partId)) {
          errs.push(`${path}.partId ${String(g.partId)} is not a known part`);
        }
        if (g.params !== undefined) {
          if (!isObj(g.params)) {
            errs.push(`${path}.params must be an object of numbers`);
          } else {
            for (const [k, v] of Object.entries(g.params)) {
              if (typeof v !== 'number' || !Number.isFinite(v)) errs.push(`${path}.params.${k} must be a number`);
            }
          }
        }
      });
    }
  }

  return errs;
}
