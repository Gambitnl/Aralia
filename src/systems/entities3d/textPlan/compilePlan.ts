// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/07/2026, 22:32:15
 * Dependents: systems/entities3d/generateEntityBlueprint.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file compilePlan.ts — CreaturePlan → blueprint fields + driver-ready PlanSpec.
 *
 * Pure and deterministic: the stored plan is the source of truth, so compiling
 * it twice yields identical output. All feet→meters conversion happens here;
 * the plan driver only ever sees meters.
 *
 * Head↔neck binding: heads that name a neckIndex are dealt the expanded neck
 * chains of that appendage in order. More heads than chains is a hard error —
 * no fallback placement.
 */
import { FT_TO_M, deriveFrame, headRadiusM } from '../types';
import type { EntityBlueprint, PartInstance, PlanSpec } from '../types';
import { getPart } from '../registry';
import { PLAN_DEFAULT_BLEND, PLAN_DEFAULT_HEIGHT_FRAC, type CreaturePlan } from './planSchema';
import { spineRadiusAt } from './spineProfile';

/** Short chain-id stems per kind ('tent2', 'leg0L' …). */
const KIND_STEM: Record<CreaturePlan['appendages'][number]['kind'], string> = {
  leg: 'leg',
  arm: 'arm',
  tail: 'tail',
  tentacle: 'tent',
  neck: 'neck',
  wing: 'wing',
  torso: 'torso',
};

/**
 * Root-mass swell (creature-anatomy round 1): a chain must ROOT into the body
 * through a muscled swell — a haunch, a wing shoulder, a neck base — not plug
 * in as a constant-width pipe. Value = target root-to-tip radius ratio (the
 * WoW-drake reference thigh is ~3x its ankle). The swell grades toward the
 * tip; the tip link keeps its authored radius so ankles stay slim.
 */
const ROOT_SWELL: Partial<Record<CreaturePlan['appendages'][number]['kind'], number>> = {
  leg: 3.0,
  neck: 1.9,
  tail: 2.2,
  wing: 1.8,
};

/** Collar-reach boost at limb roots — the junction skirt must read as muscle.
 * round 10 (creature-anatomy): tentacles melt hardest — a gel pseudopod must
 * pour out of the mound, not plug into it (the round-9 ooze "flipper stubs"
 * verdict), so their root collars reach 1.7×. */
const ROOT_COLLAR_BOOST: Partial<Record<CreaturePlan['appendages'][number]['kind'], number>> = {
  leg: 1.25,
  wing: 1.25,
  tentacle: 1.7,
};

export function compilePlan(
  plan: CreaturePlan,
): Pick<EntityBlueprint, 'gait' | 'frame' | 'palette' | 'parts' | 'label' | 'planSpec'> {
  const { frame: pf } = plan;
  const heightM = pf.heightFt * FT_TO_M;
  const upright = pf.stance === 'upright' || pf.stance === 'floating';
  const bodyLenM = (pf.lengthFt ?? pf.heightFt * (upright ? 0.42 : 1.6)) * FT_TO_M;
  // The plan language's base radius: chain link r values are fractions of this.
  // Long low bodies earn thickness from LENGTH — a 26ft serpent is not a hose —
  // and a legless horizontal body (an ooze) is a MOUND, not a pill.
  const legless = !plan.appendages.some((a) => a.kind === 'leg');
  const bodyRadM = Math.max(
    0.04,
    heightM * 0.13 * (0.6 + pf.bulk),
    // round 7 (creature-anatomy): 0.032 → 0.042 — the serpent trunk must
    // carry serpent MASS in plan view; at 0.032 the 26 ft fixture's grounded
    // body read as a line next to its own heads.
    // round 22 (creature-anatomy): 0.042 → 0.033 — the round-21 verdict read
    // "pinheads on a garden hose": at 0.042 the 26 ft fixture's trunk
    // (r ≈ 0.40 m, chest swell 0.58 m) out-gauged its own capped heads. The
    // ratio INVERTS at the join — heads grow past the trunk (fixtures +
    // headSizeScale cap 4) while the trunk slims back toward, not past, the
    // round-7 floor. Valheim: a head towing a body, never a hose with studs.
    pf.stance === 'serpentine' ? bodyLenM * 0.033 * (0.6 + pf.bulk) : 0,
    pf.stance === 'horizontal' && legless ? heightM * 0.36 * (0.4 + 0.6 * pf.bulk) : 0,
  );

  // Junction blend: resolve the softness fraction per appendage (override →
  // creature skin.blend → per-kind default) and the hull tube radius at an
  // attach fraction (mirrors the driver's spine profile: rear-thick per
  // taper, muscle bulge mid-body) so chains carry collar reach in meters.
  const spineBulge = plan.spine.bulge ?? (plan.spine.shape === 'box' ? 0 : 0.3);
  const blendFrac = (a: CreaturePlan['appendages'][number]): number =>
    a.blend ?? plan.skin?.blend ?? PLAN_DEFAULT_BLEND[a.kind];
  const hullRadiusAt = (attach: number): number =>
    // THE shared profile (spineProfile.ts) — same curve the driver meshes,
    // so blend collars hug the body the renderer actually draws
    spineRadiusAt({ bodyRadM, spine: { taper: plan.spine.taper, bulge: spineBulge, mass: plan.spine.mass } }, attach);

  // Expand appendages into concrete chains with stable ids. Mirrored pairs
  // yield L before R; per-kind counters run in appendage order.
  const kindCounters: Record<string, number> = {};
  const chains: PlanSpec['chains'] = [];
  /** appendage index → ids of its expanded chains (for head binding). */
  const chainsByAppendage: string[][] = [];

  // round 14 (creature-anatomy): a multi-neck crown must keep its AUTHORED
  // width stagger. The neck hull floor (0.4 × hull) plus tip × swell pulled
  // the serpent's 0.82/0.52/0.44 roots up to within 12% of each other — the
  // round-13 "three thin equal-width necks" verdict. With siblings, the floor
  // drops away and the swell honors the author's ratios.
  const neckChainTotal = plan.appendages
    .filter((a) => a.kind === 'neck')
    .reduce((total, a) => total + a.count * (a.perSide ? 2 : 1), 0);

  plan.appendages.forEach((a) => {
    const ids: string[] = [];
    const sides: Array<-1 | 0 | 1> = a.perSide ? [-1, 1] : [0];
    for (let i = 0; i < a.count; i++) {
      const n = kindCounters[a.kind] ?? 0;
      kindCounters[a.kind] = n + 1;
      // count > 1 fans out: siblings stagger along the spine and around the
      // body instead of stacking at one point (six tentacles = a skirt of
      // arms, not one thread).
      const spread = a.count > 1 ? i - (a.count - 1) / 2 : 0;
      const attach = Math.min(1, Math.max(0, a.attach + spread * 0.09));
      const baseHeight = a.heightFrac ?? PLAN_DEFAULT_HEIGHT_FRAC[a.kind];
      const heightFrac = Math.min(0.95, Math.max(0.05, baseHeight + spread * 0.16));
      for (const side of sides) {
        const id = `${KIND_STEM[a.kind]}${n}${side === -1 ? 'L' : side === 1 ? 'R' : ''}`;
        ids.push(id);
        const links = a.chain.map((l) => ({ lenM: l.lenFt * FT_TO_M, rM: l.r * bodyRadM }));
        const swellRatio = ROOT_SWELL[a.kind];
        const hullR = hullRadiusAt(attach);
        if (swellRatio) {
          // Root target: ratio × tip radius, floored against the hull so
          // twig-legged plans still read rooted, capped so the haunch never
          // dwarfs the body it joins.
          const tipRM = links[links.length - 1].rM;
          // per-kind hull floor: haunches read at half body width, a tail
          // flows from the hips at over half body width, necks/wings at 0.4.
          // round 14 (creature-anatomy): sibling necks drop the floor — a
          // crown's runts must stay runts (see neckChainTotal above).
          // round 20 (creature-anatomy): leg floor 0.5 → 1.0 — the round-19
          // verdict read "thigh ~= ankle width". The swollen root EXISTED in
          // the compiled data (0.466 on the dragon) but sat entirely INSIDE
          // the body hull (0.507 at the hip), so the haunch never crossed the
          // belly silhouette and the visible thigh started at ~0.40. A haunch
          // must stand PROUD of the hull (WoW drake / Valheim boar: the
          // haunch is a distinct mass on the body line); the 1.15 cap holds.
          const hullFloor =
            a.kind === 'leg' ? 1.0
            : a.kind === 'tail' ? 0.55
            : a.kind === 'neck' && neckChainTotal > 1 ? 0.18
            : 0.4;
          const target = Math.min(
            hullR * 1.15,
            Math.max(links[0].rM, tipRM * swellRatio, hullR * hullFloor),
          );
          const last = links.length - 1;
          for (let li = 0; li < links.length; li++) {
            // graded falloff root→tip; a single-link chain takes half swell
            const u = last === 0 ? 0.5 : li / last;
            const fall = Math.pow(1 - u, 1.6);
            links[li].rM = Math.max(links[li].rM, target * fall + links[li].rM * (1 - fall));
          }
        }
        // round 20 (creature-anatomy): a hull-proud haunch needs NO collar —
        // the swollen root ball already merges into the body, and the lathed
        // skirt around a near-hull-width thigh rendered as a floating
        // "sombrero brim" disc at each hip in the round-20 side sheets.
        const proudLegRoot = a.kind === 'leg' && swellRatio !== undefined && links[0].rM >= hullR * 0.9;
        chains.push({
          id,
          kind: a.kind,
          side,
          attach,
          heightFrac,
          links,
          blendM: proudLegRoot ? 0 : blendFrac(a) * Math.min(links[0].rM, hullR) * 2 * (ROOT_COLLAR_BOOST[a.kind] ?? 1),
          phaseOffset: 0,
          tips: a.tips,
          jointRings: a.jointRings,
        });
      }
    }
    chainsByAppendage.push(ids);
  });

  // Tauric binding: parented chains root on the FIRST expanded chain of their
  // parent torso entry.
  plan.appendages.forEach((a, ai) => {
    if (a.parent === undefined) return;
    const parentId = chainsByAppendage[a.parent]?.[0];
    if (!parentId) {
      throw new Error(`appendages[${ai}].parent ${a.parent} resolved to no chain`);
    }
    const parentRootRM = chains.find((c) => c.id === parentId)!.links[0].rM;
    for (const id of chainsByAppendage[ai]) {
      const chain = chains.find((c) => c.id === id)!;
      chain.parentId = parentId;
      // tauric seam: the junction is against the torso, not the spine hull
      chain.blendM = blendFrac(a) * Math.min(chain.links[0].rM, parentRootRM) * 2;
    }
  });

  // Distribute stride phases across legs: pair index spreads 0..1, right side
  // antiphase — the quad/hexa pattern generalized to any leg count.
  const legs = chains.filter((c) => c.kind === 'leg');
  const legPairs = Math.max(1, legs.filter((c) => c.side !== 1).length);
  let pairIdx = 0;
  const pairPhase = new Map<string, number>();
  for (const leg of legs) {
    const key = leg.id.replace(/[LR]$/, '');
    if (!pairPhase.has(key)) pairPhase.set(key, (pairIdx++ % legPairs) / legPairs);
    leg.phaseOffset = (pairPhase.get(key)! + (leg.side === 1 ? 0.5 : 0)) % 1;
  }

  // Frame: plan bulk 0–1 maps onto Frame's 0.6 gaunt … 1.6 massive scale. The
  // driver reads planSpec for shape; the frame exists for heightM/anchor math.
  const frame = deriveFrame('quad', pf.heightFt, 0.6 + pf.bulk, 1);

  // Bind heads to neck chains in order; spine-front heads have no chainId.
  const dealt: Record<number, number> = {};
  const heads: PlanSpec['heads'] = plan.heads.map((h, hi) => {
    let chainId: string | undefined;
    if (h.neckIndex !== undefined) {
      const pool = chainsByAppendage[h.neckIndex] ?? [];
      const take = dealt[h.neckIndex] ?? 0;
      if (take >= pool.length) {
        throw new Error(`heads[${hi}] neckIndex ${h.neckIndex} has no free neck chain (only ${pool.length})`);
      }
      chainId = pool[take];
      dealt[h.neckIndex] = take + 1;
      // a neck must be able to CARRY its head — thicken toward the size of the
      // head it holds (NOT the body: a bulky orb must keep slim eyestalks)
      const boundHeadR = Math.max(headRadiusM(frame), bodyRadM * 0.4) * h.sizeScale;
      const neck = chains.find((c) => c.id === chainId)!;
      neck.links = neck.links.map((l, li) => ({
        lenM: l.lenM,
        rM: Math.max(l.rM, boundHeadR * (0.5 - 0.16 * (li / Math.max(1, neck.links.length - 1)))),
      }));
    }
    return { chainId, form: h.form, sizeScale: h.sizeScale, eyes: { ...h.eyes }, snout: h.snout ? { ...h.snout } : undefined, cilia: h.cilia };
  });

  const planSpec: PlanSpec = {
    stance: pf.stance,
    bodyLenM,
    bodyRadM,
    spine: {
      segments: plan.spine.segments,
      taper: plan.spine.taper,
      arch: plan.spine.arch,
      shape: plan.spine.shape,
      // muscle bulge: authored, or a gentle default on round bodies
      bulge: spineBulge,
      ...(plan.spine.mass ? { mass: plan.spine.mass } : {}),
    },
    opacity: plan.palette.opacity,
    ...(plan.surface ? { surface: plan.surface } : {}),
    skinBlend: plan.skin?.blend,
    chains,
    heads,
  };

  // Head-anchored garnish (horns, ears) must root against the REAL skull the
  // driver draws — its socket radius (max of frame head and 0.4×body, times
  // sizeScale) can far outgrow the frame head radius the parts assume. Inject
  // it so horn bases sit inside the skull surface instead of floating above
  // it (round 1: the dragon's detached horns). Explicit plan params win.
  const headSocketRM = plan.heads.length
    ? Math.max(headRadiusM(frame), bodyRadM * 0.4) * plan.heads[0].sizeScale
    : undefined;
  const parts: PartInstance[] = (plan.garnish ?? []).map((g) => {
    const anchor = getPart(g.partId).anchor;
    const params =
      anchor === 'head' && headSocketRM !== undefined
        ? { anchorRadM: headSocketRM, ...(g.params ?? {}) }
        : g.params;
    return { partId: g.partId, anchor, params };
  });

  return {
    gait: 'plan',
    frame,
    palette: {
      skinHex: plan.palette.bodyHex,
      accentHex: plan.palette.accentHex ?? plan.palette.bodyHex,
      secondaryHex: plan.palette.bellyHex ?? plan.palette.bodyHex,
      eyeHex: plan.palette.eyeHex,
    },
    parts,
    label: plan.name,
    planSpec,
  };
}
