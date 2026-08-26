/**
 * @file src/utils/visuals/__tests__/conditionPalette.test.ts
 * Guards the single condition palette: enum coverage, unique chip labels, the
 * six ruled colors, and a resolver that never throws on arbitrary input.
 */
import { describe, it, expect } from 'vitest';
import { ConditionType } from '../../../types/conditions';
import {
  CONDITION_VISUALS,
  DEFAULT_CONDITION_VISUAL,
  STATUS_KIND_GLYPHS,
  lookupConditionVisual,
  resolveConditionVisual,
  resolveDominantCondition,
  resolveStatusGlyph,
} from '../conditionPalette';

/** Set C, exactly as Remy ruled it on 2026-09-21 (sheet q1). */
const RULED_COLORS: Record<string, string> = {
  poisoned: '#56d364',
  ignited: '#ff7a33',
  blinded: '#b9e4f0',
  blessed: '#ffe066',
  restrained: '#b06cf0',
  unconscious: '#6f6fa8',
};

describe('conditionPalette', () => {
  it('has a row for every ConditionType member', () => {
    for (const condition of Object.values(ConditionType)) {
      const visual = lookupConditionVisual(condition);
      expect(visual, `no palette row for ${condition}`).toBeDefined();
      expect(visual!.name).toBe(condition);
    }
  });

  it('gives every chip label a unique two letters', () => {
    const labels = Object.values(CONDITION_VISUALS).map((v) => v.chipLabel);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label).toHaveLength(2);
  });

  it('carries the six ruled Set C colors and nothing else', () => {
    for (const [key, hex] of Object.entries(RULED_COLORS)) {
      expect(lookupConditionVisual(key)!.chipColor, `${key} chip color`).toBe(hex);
    }
    const colored = Object.values(CONDITION_VISUALS).filter(
      (v) => v.chipColor !== DEFAULT_CONDITION_VISUAL.chipColor,
    );
    expect(colored.map((v) => v.key).sort()).toEqual(Object.keys(RULED_COLORS).sort());
  });

  it('drives the 3D body tint from the same ruled hex', () => {
    expect(lookupConditionVisual('Poisoned')!.tintColor).toBe(0x56d364);
    expect(lookupConditionVisual('Ignited')!.tintColor).toBe(0xff7a33);
  });

  it('never throws on an arbitrary string and keeps two letters', () => {
    const junk = ['', '   ', 'Wibbling', '🔥🔥', 'a', '{"x":1}', 'Poisoned '];
    for (const name of junk) {
      expect(() => resolveConditionVisual(name)).not.toThrow();
    }
    expect(resolveConditionVisual('Wibbling').chipLabel).toBe('WI');
    expect(resolveConditionVisual('Wibbling').chipColor).toBe(DEFAULT_CONDITION_VISUAL.chipColor);
    expect(resolveConditionVisual('').key).toBe('unknown');
    // Trailing whitespace must still hit the real row, not the fallback.
    expect(resolveConditionVisual('Poisoned ').chipLabel).toBe('PO');
  });

  it('resolves by exact key and alias, never by substring', () => {
    expect(resolveConditionVisual('poisoned').key).toBe('poisoned');
    expect(resolveConditionVisual('burning').key).toBe('ignited');
    expect(resolveConditionVisual('On Fire').key).toBe('ignited');
    expect(resolveConditionVisual('Slasher Slow').key).toBe('slowed');
    // "Deeply Poisoned" contains "poisoned" but is not that condition.
    expect(lookupConditionVisual('Deeply Poisoned')).toBeUndefined();
  });

  it('picks the highest-severity condition, preserving the shipped order', () => {
    expect(resolveDominantCondition(['Poisoned', 'Ignited'])!.key).toBe('ignited');
    expect(resolveDominantCondition(['Stunned', 'Petrified'])!.key).toBe('petrified');
    expect(resolveDominantCondition(['Chilled', 'Frozen'])!.key).toBe('frozen');
    expect(resolveDominantCondition(['Charmed', 'Paralyzed'])!.key).toBe('paralyzed');
    expect(resolveDominantCondition(['Wibbling'])).toBeNull();
    expect(resolveDominantCondition([])).toBeNull();
  });

  it('never lets an untinted row beat a ruled tint on equal severity', () => {
    // Blinded is Set C and tints the body; Deafened is unruled and does not.
    // Both sit on the severity floor, so only the tie-break separates them.
    expect(resolveDominantCondition(['Blinded', 'Deafened'])!.key).toBe('blinded');
    expect(resolveDominantCondition(['Deafened', 'Blinded'])!.key).toBe('blinded');
    expect(lookupConditionVisual('Blinded')!.severity).toBe(
      lookupConditionVisual('Deafened')!.severity,
    );
  });

  it('answers the same whatever order the conditions are carried in', () => {
    const pairs: [string, string][] = [
      ['Blinded', 'Restrained'],
      ['Prone', 'Unconscious'],
      ['Grappled', 'Deafened'],
      ['Blessed', 'Slowed'],
    ];
    for (const [a, b] of pairs) {
      expect(resolveDominantCondition([a, b])!.key).toBe(resolveDominantCondition([b, a])!.key);
    }
    // And a tinted Set C row still beats an untinted one both ways round.
    expect(resolveDominantCondition(['Prone', 'Unconscious'])!.key).toBe('unconscious');
  });

  it('resolves status glyphs by icon, then name, then effect kind', () => {
    expect(resolveStatusGlyph({ icon: '★', name: 'Poisoned', type: 'debuff' })).toBe('★');
    expect(resolveStatusGlyph({ name: 'Poisoned', type: 'debuff' })).toBe(
      lookupConditionVisual('Poisoned')!.icon,
    );
    expect(resolveStatusGlyph({ name: 'Wibbling', type: 'buff' })).toBe(
      STATUS_KIND_GLYPHS.buff.icon,
    );
    expect(resolveStatusGlyph({ type: 'nonsense' })).toBe('◼️');
  });

  it('gives the overlay ASCII glyphs from the same table', () => {
    expect(resolveStatusGlyph({ type: 'buff' }, 'ascii')).toBe('+');
    expect(resolveStatusGlyph({ type: 'debuff' }, 'ascii')).toBe('!');
    expect(resolveStatusGlyph({ type: 'dot' }, 'ascii')).toBe('DOT');
    expect(resolveStatusGlyph({ type: 'hot' }, 'ascii')).toBe('HOT');
    expect(resolveStatusGlyph({ type: undefined }, 'ascii')).toBe('?');
  });
});
