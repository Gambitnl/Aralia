/**
 * @file planSchema.test.ts — body-plan language validation (text-to-creature).
 * Spec: docs/superpowers/specs/2026-07-15-text-to-creature-design.md.
 */
import { describe, it, expect } from 'vitest';
import { validateCreaturePlan, type CreaturePlan } from '../textPlan/planSchema';

const KNOWN_PARTS = new Set(['hornsCurved', 'tailThick', 'shellBack']);

/** A minimal valid upright creature; tests mutate copies of this. */
function basePlan(): CreaturePlan {
  return {
    name: 'Test Beast',
    frame: { heightFt: 5, bulk: 0.5, stance: 'upright' },
    spine: { segments: 3, taper: 0.7, arch: 0 },
    appendages: [
      {
        kind: 'leg',
        attach: 0.8,
        perSide: true,
        count: 1,
        chain: [
          { lenFt: 1.2, r: 0.3 },
          { lenFt: 1.1, r: 0.2 },
        ],
      },
    ],
    heads: [{ sizeScale: 1, eyes: { count: 2, sizeScale: 1 } }],
    palette: { bodyHex: '#7a9e5f', eyeHex: '#1a1a2e' },
  };
}

/** deep-clone + patch helper */
function mut(patch: (p: CreaturePlan) => void): CreaturePlan {
  const p = JSON.parse(JSON.stringify(basePlan())) as CreaturePlan;
  patch(p);
  return p;
}

describe('validateCreaturePlan — accepts', () => {
  it('accepts the base upright biped', () => {
    expect(validateCreaturePlan(basePlan(), KNOWN_PARTS)).toEqual([]);
  });

  it('accepts a serpent with zero appendages (lengthFt present)', () => {
    const p = mut((p) => {
      p.frame = { heightFt: 2, lengthFt: 24, bulk: 0.6, stance: 'serpentine' };
      p.appendages = [];
    });
    expect(validateCreaturePlan(p, KNOWN_PARTS)).toEqual([]);
  });

  it('accepts multi-head on neck appendages', () => {
    const p = mut((p) => {
      p.appendages.push({ kind: 'neck', attach: 0.05, count: 3, chain: [{ lenFt: 2, r: 0.2 }] });
      p.heads = [
        { neckIndex: 1, sizeScale: 0.8, eyes: { count: 2, sizeScale: 1 } },
        { neckIndex: 1, sizeScale: 0.8, eyes: { count: 2, sizeScale: 1 } },
      ];
    });
    expect(validateCreaturePlan(p, KNOWN_PARTS)).toEqual([]);
  });

  it('accepts garnish from the known part set + snout + optional palette fields', () => {
    const p = mut((p) => {
      p.garnish = [{ partId: 'hornsCurved', params: { scale: 1.2 } }];
      p.heads[0].snout = { lengthScale: 1.5, droop: 0.2 };
      p.palette.accentHex = '#aa3355';
      p.palette.bellyHex = '#d8cfa8';
    });
    expect(validateCreaturePlan(p, KNOWN_PARTS)).toEqual([]);
  });

  it('accepts a floating creature without lengthFt', () => {
    const p = mut((p) => {
      p.frame = { heightFt: 3, bulk: 0.9, stance: 'floating' };
      p.appendages = [];
    });
    expect(validateCreaturePlan(p, KNOWN_PARTS)).toEqual([]);
  });

  it('accepts v1.2: torso with parented arms and a torso-bound head (centaur shape)', () => {
    const p = mut((p) => {
      p.frame = { heightFt: 6, lengthFt: 8, bulk: 0.7, stance: 'horizontal' };
      p.appendages = [
        { kind: 'leg', attach: 0.2, perSide: true, count: 1, chain: [{ lenFt: 2, r: 0.2 }, { lenFt: 1.8, r: 0.14 }] },
        { kind: 'leg', attach: 0.8, perSide: true, count: 1, chain: [{ lenFt: 2, r: 0.2 }, { lenFt: 1.8, r: 0.14 }] },
        { kind: 'torso', attach: 0.08, count: 1, chain: [{ lenFt: 1.4, r: 0.55 }, { lenFt: 1.2, r: 0.45 }] },
        { kind: 'arm', attach: 0.08, parent: 2, perSide: true, count: 1, tips: 'hand', chain: [{ lenFt: 1.4, r: 0.12 }, { lenFt: 1.2, r: 0.09 }] },
      ];
      p.heads = [{ neckIndex: 2, sizeScale: 1, eyes: { count: 2, sizeScale: 1 } }];
    });
    expect(validateCreaturePlan(p, KNOWN_PARTS)).toEqual([]);
  });

  it('accepts v1.2: box spine with opacity (gelatinous cube shape) and 12 heads', () => {
    const p = mut((p) => {
      p.frame = { heightFt: 10, lengthFt: 10, bulk: 1, stance: 'horizontal' };
      p.spine = { segments: 2, taper: 1, arch: 0, shape: 'box' };
      p.appendages = [{ kind: 'neck', attach: 0.1, count: 4, perSide: true, chain: [{ lenFt: 1, r: 0.12 }] }];
      p.heads = Array.from({ length: 12 }, (_, i) => ({
        neckIndex: i < 8 ? 0 : undefined,
        sizeScale: 0.5,
        eyes: { count: 1, sizeScale: 1.5 },
      }));
      p.palette.opacity = 0.35;
    });
    expect(validateCreaturePlan(p, KNOWN_PARTS)).toEqual([]);
  });

  it('accepts v1.1 fields: hand tips, joint rings, eye cilia', () => {
    const p = mut((p) => {
      p.appendages.push({
        kind: 'arm',
        attach: 0.3,
        perSide: true,
        count: 2,
        tips: 'hand',
        jointRings: true,
        chain: [
          { lenFt: 2, r: 0.15 },
          { lenFt: 1.6, r: 0.1 },
        ],
      });
      p.heads[0].cilia = true;
    });
    expect(validateCreaturePlan(p, KNOWN_PARTS)).toEqual([]);
  });
});

describe('validateCreaturePlan — rejects, one named error per rule', () => {
  const expectError = (plan: unknown, substring: string) => {
    const errors = validateCreaturePlan(plan, KNOWN_PARTS);
    expect(errors.length, `expected an error mentioning "${substring}"`).toBeGreaterThan(0);
    expect(errors.join('\n')).toContain(substring);
  };

  it('non-object input', () => {
    expectError('a dragon', 'plan is not an object');
  });

  it('name too long', () => {
    expectError(mut((p) => { p.name = 'x'.repeat(41); }), 'name');
  });

  it('height outside range', () => {
    expectError(mut((p) => { p.frame.heightFt = 45; }), 'frame.heightFt 45 outside 0.5–30');
  });

  it('horizontal stance requires lengthFt', () => {
    expectError(mut((p) => { p.frame.stance = 'horizontal'; }), 'lengthFt');
  });

  it('bad hex color', () => {
    expectError(mut((p) => { p.palette.bodyHex = 'green'; }), 'palette.bodyHex');
  });

  it('spine segments out of range', () => {
    expectError(mut((p) => { p.spine.segments = 12; }), 'spine.segments');
  });

  it('too many appendages', () => {
    expectError(
      mut((p) => {
        p.appendages = Array.from({ length: 13 }, () => ({
          kind: 'tentacle' as const, attach: 0.5, count: 1, chain: [{ lenFt: 1, r: 0.2 }],
        }));
      }),
      'appendages',
    );
  });

  it('bad appendage kind', () => {
    expectError(mut((p) => { (p.appendages[0] as { kind: string }).kind = 'flipper'; }), 'appendages[0].kind');
  });

  it('chain too long', () => {
    expectError(
      mut((p) => { p.appendages[0].chain = Array.from({ length: 9 }, () => ({ lenFt: 1, r: 0.2 })); }),
      'chain',
    );
  });

  it('chain link radius out of range', () => {
    expectError(mut((p) => { p.appendages[0].chain[0].r = 1.5; }), 'appendages[0].chain[0].r');
  });

  it('zero heads', () => {
    expectError(mut((p) => { p.heads = []; }), 'heads');
  });

  it('neckIndex pointing at a non-neck appendage', () => {
    expectError(mut((p) => { p.heads[0].neckIndex = 0; }), 'neckIndex');
  });

  it('neckIndex out of bounds', () => {
    expectError(mut((p) => { p.heads[0].neckIndex = 7; }), 'neckIndex');
  });

  it('too many eyes', () => {
    expectError(mut((p) => { p.heads[0].eyes.count = 9; }), 'eyes.count');
  });

  it('unknown garnish part', () => {
    expectError(mut((p) => { p.garnish = [{ partId: 'lasersaddle' }]; }), 'lasersaddle');
  });

  it('unknown top-level field', () => {
    expectError(mut((p) => { (p as unknown as Record<string, unknown>).motion = 'bouncy'; }), 'unknown field motion');
  });

  it('parent must point at a torso appendage', () => {
    expectError(
      mut((p) => {
        p.appendages.push({ kind: 'arm', attach: 0.3, count: 1, parent: 0, chain: [{ lenFt: 1, r: 0.1 }] });
      }),
      'appendages[1].parent',
    );
  });

  it('a torso cannot have a parent (no torso towers)', () => {
    expectError(
      mut((p) => {
        p.appendages.push({ kind: 'torso', attach: 0.2, count: 1, chain: [{ lenFt: 1, r: 0.4 }] });
        p.appendages.push({ kind: 'torso', attach: 0.2, count: 1, parent: 1, chain: [{ lenFt: 1, r: 0.3 }] });
      }),
      'appendages[2].parent',
    );
  });

  it('legs cannot be parented to a torso', () => {
    expectError(
      mut((p) => {
        p.appendages.push({ kind: 'torso', attach: 0.2, count: 1, chain: [{ lenFt: 1, r: 0.4 }] });
        p.appendages.push({ kind: 'leg', attach: 0.2, count: 1, parent: 1, chain: [{ lenFt: 1, r: 0.1 }] });
      }),
      'appendages[2].parent',
    );
  });

  it('heads may bind to torsos, but neckIndex at a tail still fails', () => {
    const good = mut((p) => {
      p.appendages.push({ kind: 'torso', attach: 0.15, count: 1, chain: [{ lenFt: 1.2, r: 0.5 }] });
      p.heads = [{ neckIndex: 1, sizeScale: 1, eyes: { count: 2, sizeScale: 1 } }];
    });
    expect(validateCreaturePlan(good, KNOWN_PARTS)).toEqual([]);
  });

  it('bad spine shape', () => {
    expectError(mut((p) => { (p.spine as unknown as Record<string, unknown>).shape = 'dodecahedron'; }), 'spine.shape');
  });

  it('opacity out of range', () => {
    expectError(mut((p) => { p.palette.opacity = 0.05; }), 'palette.opacity');
  });

  it('thirteen heads is too many', () => {
    expectError(
      mut((p) => {
        p.heads = Array.from({ length: 13 }, () => ({ sizeScale: 0.5, eyes: { count: 1, sizeScale: 1 } }));
      }),
      'heads',
    );
  });

  it('bad tips value', () => {
    expectError(mut((p) => { (p.appendages[0] as unknown as Record<string, unknown>).tips = 'lasers'; }), 'appendages[0].tips');
  });

  it('tips not allowed on legs', () => {
    expectError(mut((p) => { p.appendages[0].tips = 'hand'; }), 'appendages[0].tips');
  });

  it('non-boolean jointRings', () => {
    expectError(mut((p) => { (p.appendages[0] as unknown as Record<string, unknown>).jointRings = 'yes'; }), 'appendages[0].jointRings');
  });

  it('non-boolean cilia', () => {
    expectError(mut((p) => { (p.heads[0] as unknown as Record<string, unknown>).cilia = 3; }), 'heads[0].cilia');
  });

  it('unknown nested field', () => {
    expectError(
      mut((p) => { (p.appendages[0] as unknown as Record<string, unknown>).wiggle = 3; }),
      'unknown field appendages[0].wiggle',
    );
  });

  it('collects MULTIPLE errors in one pass', () => {
    const errors = validateCreaturePlan(
      mut((p) => {
        p.frame.heightFt = 100;
        p.palette.eyeHex = 'blue';
        p.spine.taper = 2;
      }),
      KNOWN_PARTS,
    );
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});
