/**
 * @file heroImagePrompt.test.ts — the pure hero-image prompt builder for the
 * creature hero pipeline. A CreaturePlan goes in, one deterministic image
 * prompt string comes out. No LLM, no I/O — fixtures only.
 */
import { describe, it, expect } from 'vitest';
import { heroImagePrompt, colorNameForHex } from '../textPlan/heroImagePrompt';
import { PLAN_FIXTURES } from '../textPlan/fixtures';
import type { CreaturePlan } from '../textPlan/planSchema';

describe('heroImagePrompt', () => {
  const dragonPrompt = heroImagePrompt(PLAN_FIXTURES.dragon);

  it('starts with the full-body concept opener naming the creature', () => {
    expect(dragonPrompt.startsWith('Full body 3D character concept of Emberwing Dragon')).toBe(true);
  });

  it('always carries the fixed framing phrases', () => {
    expect(dragonPrompt).toContain('neutral standing pose');
    expect(dragonPrompt).toContain('solid neutral gray background');
    expect(dragonPrompt).toContain('clean silhouette');
    expect(dragonPrompt).toContain('no pedestal');
    expect(dragonPrompt).toContain('single creature');
  });

  it('states height and length from the frame', () => {
    expect(dragonPrompt).toContain('about 9 feet tall and 22 feet long');
  });

  it('summarizes appendages with number words, doubling perSide pairs', () => {
    // Two perSide leg entries of count 1 each = four legs total.
    expect(dragonPrompt).toContain('four legs');
    expect(dragonPrompt).toContain('one long tail');
  });

  it('does not invent wings for the dragon — its wings are garnish, not chain appendages', () => {
    // wings come from garnish, and garnish identity MUST reach the prompt
    expect(dragonPrompt).toContain('membrane wings');
    expect(dragonPrompt).toContain('curved horns');
  });

  it('describes a legged horizontal creature as four-legged', () => {
    expect(dragonPrompt).toContain('four-legged posture');
  });

  it('names the serpent head form', () => {
    expect(dragonPrompt).toContain('wedge-shaped reptilian head');
  });

  it('ends with exactly the sculpt style phrase', () => {
    expect(dragonPrompt.endsWith('stylized game sculpt, hand-painted look, high detail')).toBe(true);
  });

  it('names palette colors with their hex codes', () => {
    expect(dragonPrompt).toContain('red (#8c3b2e)');
    expect(dragonPrompt).toContain('yellow (#f2c14e)');
    expect(dragonPrompt).toContain('belly in');
  });

  it('marks a translucent palette as ghostly', () => {
    const prompt = heroImagePrompt(PLAN_FIXTURES.ghost);
    expect(prompt).toContain('semi-translucent ghostly body');
  });

  it('describes the serpentine stance and counts multiple heads', () => {
    const prompt = heroImagePrompt(PLAN_FIXTURES.threeHeadedSerpent);
    expect(prompt).toContain('long serpentine body');
    expect(prompt).toContain('with three heads');
  });

  it('phrases a torso appendage as an upright humanoid torso', () => {
    const prompt = heroImagePrompt(PLAN_FIXTURES.centaur);
    expect(prompt).toContain('an upright humanoid torso');
  });

  it('describes a floating creature as floating in the air', () => {
    const prompt = heroImagePrompt(PLAN_FIXTURES.floatingEye);
    expect(prompt).toContain('floating in the air');
    // No lengthFt on the orb: height only, and no belly clause without bellyHex.
    expect(prompt).toContain('about 3.5 feet tall');
    expect(prompt).not.toContain('feet long');
    expect(prompt).not.toContain('belly in');
  });

  it('describes an upright biped as standing on two legs', () => {
    const biped: CreaturePlan = {
      name: 'Test Biped',
      frame: { heightFt: 6, bulk: 0.5, stance: 'upright' },
      spine: { segments: 3, taper: 0.7, arch: 0 },
      appendages: [
        {
          kind: 'leg',
          attach: 0.9,
          perSide: true,
          count: 1,
          chain: [{ lenFt: 1.5, r: 0.2 }],
        },
      ],
      heads: [{ sizeScale: 1, eyes: { count: 2, sizeScale: 1 } }],
      palette: { bodyHex: '#7a9e5f', eyeHex: '#1a1a2e' },
    };
    expect(heroImagePrompt(biped)).toContain('standing upright on two legs');
  });
});

describe('colorNameForHex', () => {
  it('maps known hexes into their perceptual hue buckets', () => {
    expect(colorNameForHex('#8c3b2e')).toContain('red');
    expect(colorNameForHex('#f2c14e')).toContain('yellow');
    expect(colorNameForHex('#d98e3a')).toContain('orange');
  });

  it('calls low-saturation colors gray', () => {
    expect(colorNameForHex('#808080')).toBe('gray');
  });

  it('prefixes dark and pale from lightness', () => {
    // #3e6b4f: lightness 0.33 — below the 0.35 dark threshold.
    expect(colorNameForHex('#3e6b4f')).toBe('dark green');
    // #d8e8f8: lightness 0.91... is achromatic-adjacent; use a clearly pale chroma instead.
    // #cfd8a3: lightness 0.74 — above the 0.7 pale threshold.
    expect(colorNameForHex('#cfd8a3')).toBe('pale chartreuse');
  });
});
