/**
 * @file partVariants.test.ts — the Part Lab slot seam (part-quality
 * campaign, 2026-08-21): each variant changes the built body the way its
 * catalog note says, and the shipping choice is unchanged.
 */
import { describe, it, expect } from 'vitest';
import { deriveFrame } from '../types';
import { BIPED_BONE_NAMES, buildBipedSkeleton } from '../three/skeletonBuilder';
import { buildSmoothBipedGeometry, SMOOTH_CHAINS, smoothChainTable } from '../three/smoothBipedGeometry';
import { DEFAULT_PART_CHOICE, PART_VARIANTS, resolvePartChoice, partChoiceFromQuery, type PartChoice } from '../three/partVariants';
import { assembleEntity } from '../three/assembleEntity';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { registerAllParts } from '../parts';

const frame = deriveFrame('biped', 6, 1, 1);

/** Vertices whose primary skin bone passes `own`. */
function countOwned(own: (bone: string) => boolean, parts: PartChoice = DEFAULT_PART_CHOICE): number {
  const skeleton = buildBipedSkeleton(frame);
  const geometry = buildSmoothBipedGeometry(skeleton.restPose, skeleton.index, frame, parts);
  const sIdx = geometry.getAttribute('skinIndex');
  let n = 0;
  for (let v = 0; v < sIdx.count; v++) if (own(BIPED_BONE_NAMES[sIdx.getX(v)])) n++;
  return n;
}
const isHandBone = (b: string) => b.startsWith('hand') || b.startsWith('thumb') || b.startsWith('finger');
const isFootBone = (b: string) => b.startsWith('foot');

describe('partVariants catalog', () => {
  it('resolves defaults and rejects unknown ids', () => {
    expect(resolvePartChoice()).toEqual(DEFAULT_PART_CHOICE);
    expect(resolvePartChoice({ hand: 'lofted' }).hand).toBe('lofted');
    expect(() => resolvePartChoice({ hand: 'tentacle' })).toThrow(/unknown hand variant/);
    expect(partChoiceFromQuery(new URLSearchParams('head=beast&foot=none'))).toEqual({ hand: 'reference', head: 'beast', foot: 'none' });
  });
  it('lists the shipping build first in every slot', () => {
    expect(PART_VARIANTS.hand[0].id).toBe(DEFAULT_PART_CHOICE.hand);
    expect(PART_VARIANTS.head[0].id).toBe(DEFAULT_PART_CHOICE.head);
    expect(PART_VARIANTS.foot[0].id).toBe(DEFAULT_PART_CHOICE.foot);
  });
});

describe('smooth biped part seam', () => {
  it('the shipping choice is the unchanged chain table', () => {
    expect(smoothChainTable(DEFAULT_PART_CHOICE)).toBe(SMOOTH_CHAINS);
  });
  it('lofted hands extend the arm chain to the palm and add digit chains', () => {
    const ids = smoothChainTable({ ...DEFAULT_PART_CHOICE, hand: 'lofted' }).map((c) => c.segIds.join('>'));
    expect(ids).toContain('armL.upper>armL.fore>handL.palm');
    expect(ids).toContain('handR.finger3a>handR.finger3b');
  });
  it('hand variants own hand-bone vertices; none owns zero', () => {
    expect(countOwned(isHandBone)).toBeGreaterThan(0);
    expect(countOwned(isHandBone, { ...DEFAULT_PART_CHOICE, hand: 'lofted' })).toBeGreaterThan(0);
    expect(countOwned(isHandBone, { ...DEFAULT_PART_CHOICE, hand: 'none' })).toBe(0);
  });
  it('foot none drops the wedge feet', () => {
    expect(countOwned(isFootBone)).toBeGreaterThan(0);
    expect(countOwned(isFootBone, { ...DEFAULT_PART_CHOICE, foot: 'none' })).toBe(0);
  });
});

describe('assembleEntity head slot', () => {
  registerAllParts();
  const blueprint = generateEntityBlueprint({ kind: 'humanoid', raceId: 'hill_dwarf', classId: 'fighter', seed: 'partlab-test' });
  const smooth = { renderMode: 'solid', bodyTech: 'skinned', skinnedWeights: 'smooth' } as const;
  const names = (parts: PartChoice) => {
    const handle = assembleEntity(blueprint, { ...smooth, parts });
    const out: string[] = [];
    handle.group.traverse((o) => {
      if (o.name) out.push(o.name);
    });
    handle.dispose();
    return out;
  };
  it('humanoid head by default, a form head on swap, no head on none', () => {
    expect(names(DEFAULT_PART_CHOICE)).toContain('mouthLine');
    const beast = names({ ...DEFAULT_PART_CHOICE, head: 'beast' });
    expect(beast).toContain('head:form');
    expect(beast).toContain('eyeL');
    expect(beast).not.toContain('mouthLine');
    const none = names({ ...DEFAULT_PART_CHOICE, head: 'none' });
    expect(none).not.toContain('head:form');
    expect(none).not.toContain('eyeL');
  });
  it('rejects parts on any body but the skinned smooth biped', () => {
    expect(() => assembleEntity(blueprint, { renderMode: 'solid', parts: DEFAULT_PART_CHOICE })).toThrow(/skinned smooth biped/);
  });
});
