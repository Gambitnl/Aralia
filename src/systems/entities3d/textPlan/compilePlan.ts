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
import { PLAN_DEFAULT_HEIGHT_FRAC, type CreaturePlan } from './planSchema';

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
    pf.stance === 'serpentine' ? bodyLenM * 0.032 * (0.6 + pf.bulk) : 0,
    pf.stance === 'horizontal' && legless ? heightM * 0.36 * (0.4 + 0.6 * pf.bulk) : 0,
  );

  // Expand appendages into concrete chains with stable ids. Mirrored pairs
  // yield L before R; per-kind counters run in appendage order.
  const kindCounters: Record<string, number> = {};
  const chains: PlanSpec['chains'] = [];
  /** appendage index → ids of its expanded chains (for head binding). */
  const chainsByAppendage: string[][] = [];

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
        chains.push({
          id,
          kind: a.kind,
          side,
          attach,
          heightFrac,
          links: a.chain.map((l) => ({ lenM: l.lenFt * FT_TO_M, rM: l.r * bodyRadM })),
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
    for (const id of chainsByAppendage[ai]) {
      chains.find((c) => c.id === id)!.parentId = parentId;
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
      bulge: plan.spine.bulge ?? (plan.spine.shape === 'box' ? 0 : 0.3),
    },
    opacity: plan.palette.opacity,
    chains,
    heads,
  };

  const parts: PartInstance[] = (plan.garnish ?? []).map((g) => ({
    partId: g.partId,
    anchor: getPart(g.partId).anchor,
    params: g.params,
  }));

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
