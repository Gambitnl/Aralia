/**
 * @file anatomyVariety.test.ts — seeded individuality for generic monsters.
 * The 'anatomy' seed stream jitters plan proportions, rolls per-type identity
 * picks (dragon head form, monstrosity pupil), and swaps garnish parts
 * (horns/ears) — deterministically per recipe seed. The stream-free path
 * keeps the historical fixed anatomy byte-identical, and humanoid race
 * identities never pass through the variant table.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { planForCreature, CREATURE_PART_VARIANTS } from '../creaturePlans';
import { registerAllParts } from '../parts';
import { getPart } from '../registry';

/** A comparable fingerprint of one blueprint's compiled anatomy. */
function anatomySignature(bp: ReturnType<typeof generateEntityBlueprint>): string {
  const spec = bp.planSpec!;
  const chains = spec.chains
    .map((c) => `${c.id}:${c.links.map((l) => `${l.lenM.toFixed(4)}/${l.rM.toFixed(4)}`).join(',')}`)
    .join('|');
  const heads = spec.heads.map((h) => `${h.form ?? 'plain'}:${h.sizeScale.toFixed(3)}`).join('|');
  const parts = bp.parts.map((p) => p.partId).join('|');
  return `${spec.bodyLenM.toFixed(4)}#${chains}#${heads}#${parts}`;
}

describe('seeded creature anatomy (the individuality pass)', () => {
  beforeAll(() => {
    registerAllParts();
  });

  it('stays deterministic per recipe seed', () => {
    const recipe = { kind: 'creature', creatureType: 'Dragon', size: 'Huge', seed: 'indy-1' } as const;
    expect(generateEntityBlueprint(recipe)).toEqual(generateEntityBlueprint(recipe));
  });

  it('twenty same-size dragons are individuals, not clones', () => {
    const signatures = new Set<string>();
    const hornStyles = new Set<string>();
    const headForms = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const bp = generateEntityBlueprint({ kind: 'creature', creatureType: 'Dragon', size: 'Huge', seed: `indy-dragon-${i}` });
      expect(bp.gait).toBe('plan');
      signatures.add(anatomySignature(bp));
      for (const p of bp.parts) {
        if (p.partId.startsWith('horns')) hornStyles.add(p.partId);
      }
      headForms.add(bp.planSpec!.heads[0].form ?? 'plain');
    }
    expect(signatures.size, 'dragons still stamp out clones').toBeGreaterThanOrEqual(15);
    expect(hornStyles.size, 'horn style never varies').toBeGreaterThanOrEqual(2);
    expect(headForms, 'head form should roll beast AND serpent').toContain('beast');
    expect(headForms).toContain('serpent');
  });

  it('beasts roll ear variants and jittered proportions', () => {
    const earStyles = new Set<string>();
    const signatures = new Set<string>();
    for (let i = 0; i < 16; i++) {
      const bp = generateEntityBlueprint({ kind: 'creature', creatureType: 'Beast', size: 'Large', seed: `indy-beast-${i}`, cues: ['wolf'] });
      signatures.add(anatomySignature(bp));
      for (const p of bp.parts) {
        if (p.partId.startsWith('ears')) earStyles.add(p.partId);
      }
    }
    expect(signatures.size).toBeGreaterThanOrEqual(12);
    expect(earStyles).toContain('earsPointed');
    expect(earStyles).toContain('earsLong');
  });

  it('every variant part id resolves in the registry (no dangling swaps)', () => {
    for (const variants of Object.values(CREATURE_PART_VARIANTS)) {
      for (const id of variants) {
        expect(() => getPart(id), `variant part "${id}" missing from registry`).not.toThrow();
      }
    }
  });

  it('the stream-free path keeps the fixed historical anatomy', () => {
    const a = planForCreature('Dragon', 'Huge', [], 12, 0.9);
    const b = planForCreature('Dragon', 'Huge', [], 12, 0.9);
    expect(a).toEqual(b);
    expect(a!.heads[0].form).toBe('beast'); // no identity rolls without a stream
    // and the historical table values are untouched (2026-07-27: + three-lobe
    // mass profile from the body-plan rework — chest/waist/hips, not sausage)
    expect(a!.appendages.map((x) => x.kind)).toEqual(['leg', 'leg', 'neck', 'tail']);
    expect(a!.spine).toEqual({ segments: 5, taper: 0.7, arch: 0.08, bulge: 0.5, mass: [1.42, 0.76, 1.2] });
  });

  it('monstrosity pupils roll across seeds', () => {
    const pupils = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const bp = generateEntityBlueprint({ kind: 'creature', creatureType: 'Monstrosity', size: 'Large', seed: `indy-mon-${i}` });
      pupils.add(bp.planSpec!.heads[0].eyes.pupil ?? 'round');
    }
    expect(pupils.size, 'pupil shape never varies').toBeGreaterThanOrEqual(2);
  });

  it('humanoid race identities never pass through the variant table', () => {
    // tieflings ARE curved-horn creatures by race definition — no seeded swap
    for (let i = 0; i < 6; i++) {
      const bp = generateEntityBlueprint({ kind: 'humanoid', raceId: 'infernal_tiefling', classId: 'fighter', seed: `indy-tief-${i}` });
      expect(bp.parts.some((p) => p.partId === 'hornsCurved')).toBe(true);
      expect(bp.parts.some((p) => p.partId === 'hornsStraight' || p.partId === 'hornsRam')).toBe(false);
    }
  });

  it('chain totals stay budget-neutral across 200 seeds (no giraffe dragons)', () => {
    // Regression for 2026-07-27: per-link length jitter stacked multiplicatively
    // (forge seed 1 rolled long on all 3 neck links + short on both leg links,
    // a ~2x neck-vs-leg silhouette drift). varyPlan now renormalizes each chain
    // so its TOTAL length lands within a tight band of the template's.
    const mulberry32 = (seed: number) => {
      let a = seed >>> 0;
      return { next() {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      } };
    };
    const tpl = planForCreature('Dragon', 'Huge', [], 12, 0.9)!;
    const sum = (chain: ReadonlyArray<{ lenFt: number }>) => chain.reduce((s, l) => s + l.lenFt, 0);
    for (let i = 1; i <= 200; i++) {
      const v = planForCreature('Dragon', 'Huge', [], 12, 0.9, mulberry32(i * 7919))!;
      v.appendages.forEach((a, ai) => {
        const ratio = sum(a.chain) / sum(tpl.appendages[ai].chain);
        expect(ratio, `${a.kind} chain total drifted out of band on seed ${i}`).toBeGreaterThanOrEqual(0.94 - 1e-9);
        expect(ratio, `${a.kind} chain total drifted out of band on seed ${i}`).toBeLessThanOrEqual(1.08 + 1e-9);
      });
    }
  });
});
