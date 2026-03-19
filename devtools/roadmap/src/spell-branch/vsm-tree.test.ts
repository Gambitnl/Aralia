// devtools/roadmap/src/spell-branch/vsm-tree.test.ts
import { describe, it, expect } from 'vitest';
import { resolveComponentCombination, VSM_COMBINATION_LABELS } from './vsm-tree';

describe('resolveComponentCombination', () => {
  it('maps V+S+M to verbal-somatic-material', () => {
    expect(
      resolveComponentCombination({ verbal: true, somatic: true, material: true })
    ).toBe('verbal-somatic-material');
  });

  it('maps V+S to verbal-somatic', () => {
    expect(
      resolveComponentCombination({ verbal: true, somatic: true, material: false })
    ).toBe('verbal-somatic');
  });

  it('maps V only to verbal-only', () => {
    expect(
      resolveComponentCombination({ verbal: true, somatic: false, material: false })
    ).toBe('verbal-only');
  });

  it('maps S+M to somatic-material', () => {
    expect(
      resolveComponentCombination({ verbal: false, somatic: true, material: true })
    ).toBe('somatic-material');
  });

  it('maps S only to somatic-only', () => {
    expect(
      resolveComponentCombination({ verbal: false, somatic: true, material: false })
    ).toBe('somatic-only');
  });

  it('maps V+M to verbal-material', () => {
    expect(
      resolveComponentCombination({ verbal: true, somatic: false, material: true })
    ).toBe('verbal-material');
  });

  it('maps M only to material-only', () => {
    expect(
      resolveComponentCombination({ verbal: false, somatic: false, material: true })
    ).toBe('material-only');
  });
});

describe('VSM_COMBINATION_LABELS', () => {
  it('has a human-readable label for every combination', () => {
    const combinations = [
      'verbal-only',
      'somatic-only',
      'material-only',
      'verbal-somatic',
      'verbal-material',
      'somatic-material',
      'verbal-somatic-material',
    ];
    for (const c of combinations) {
      expect(VSM_COMBINATION_LABELS[c]).toBeTruthy();
    }
  });
});
