/**
 * @file actorStatusShading.test.ts
 * Pins the body-shading lookup and the burning flicker (task agora-6ab9).
 *
 * The flicker is the only part of the actor's status story that changes every
 * frame, so it is the only part a screenshot cannot prove. These specs pin the
 * three things a live eyeball cannot: that the swing stays inside the range the
 * shader can use, that it really moves, and that two burning creatures do not
 * pulse in step.
 */
import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../../types/combat';
import {
  ACTOR_BURNING_FLICKER,
  ACTOR_SHADING_BASE,
  ACTOR_SHADING_DEFEATED,
  flickerTintStrength,
  resolveActorBodyShading,
} from '../actorStatusShading';
import {
  CONDITION_VISUALS,
  resolveConditionVisual,
} from '../../../../utils/visuals/conditionPalette';

/** The smallest character the lookup reads: id, HP, and the two status lists. */
function actor(overrides: Partial<CombatCharacter> = {}): CombatCharacter {
  return {
    id: 'actor-1',
    name: 'Test Subject',
    currentHP: 20,
    maxHP: 20,
    conditions: [],
    statusEffects: [],
    ...overrides,
  } as unknown as CombatCharacter;
}

const named = (name: string) => [{ name }] as unknown as CombatCharacter['conditions'];

describe('resolveActorBodyShading', () => {
  it('gives a healthy, unafflicted actor the plain baseline and no flicker', () => {
    const shading = resolveActorBodyShading(actor());
    expect(shading).toEqual(ACTOR_SHADING_BASE);
    expect(shading.flicker).toBeNull();
  });

  it('gives every burning alias the ruled Set C tint AND a flicker', () => {
    for (const name of ['Ignited', 'burning', 'ON FIRE']) {
      const shading = resolveActorBodyShading(actor({ conditions: named(name) }));
      expect(shading.tintColor).toBe(0xff7a33);
      expect(shading.tintStrength).toBe(0.5);
      expect(shading.flicker).not.toBeNull();
      expect(shading.flicker?.amplitude).toBe(ACTOR_BURNING_FLICKER.amplitude);
    }
  });

  it('leaves every non-burning condition steady', () => {
    for (const name of ['petrified', 'frozen', 'chilled', 'paralyzed', 'poisoned', 'charmed', 'stunned']) {
      const shading = resolveActorBodyShading(actor({ conditions: named(name) }));
      expect(shading.tintColor).not.toBeNull();
      expect(shading.flicker).toBeNull();
    }
  });

  it('keeps burning ahead of a lower condition, flicker included', () => {
    const shading = resolveActorBodyShading(
      actor({ conditions: [{ name: 'Poisoned' }, { name: 'Ignited' }] as unknown as CombatCharacter['conditions'] }),
    );
    expect(shading.tintColor).toBe(0xff7a33);
    expect(shading.flicker).not.toBeNull();
  });

  it('stops the flicker at defeat — a corpse does not burn', () => {
    const shading = resolveActorBodyShading(actor({ currentHP: 0, conditions: named('Ignited') }));
    expect(shading).toEqual(ACTOR_SHADING_DEFEATED);
    expect(shading.flicker).toBeNull();
  });

  it('gives two burning actors different phases, and one actor the same phase twice', () => {
    const a = resolveActorBodyShading(actor({ id: 'goblin-7', conditions: named('Ignited') }));
    const b = resolveActorBodyShading(actor({ id: 'ogre-3', conditions: named('Ignited') }));
    const aAgain = resolveActorBodyShading(actor({ id: 'goblin-7', conditions: named('Ignited') }));
    expect(a.flicker?.phase).not.toBe(b.flicker?.phase);
    expect(a.flicker?.phase).toBe(aAgain.flicker?.phase);
  });
});

describe('flickerTintStrength', () => {
  const burning = { ...ACTOR_BURNING_FLICKER, phase: 0 };
  /** One second at 240 Hz — four times the swing's fastest rate. */
  const samples = Array.from({ length: 240 }, (_, i) => flickerTintStrength(0.5, burning, i / 240));

  it('never leaves the 0..1 range the shader mix factor accepts', () => {
    for (const v of samples) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('stays inside the resting value plus or minus the amplitude', () => {
    for (const v of samples) {
      expect(v).toBeGreaterThanOrEqual(0.5 - burning.amplitude - 1e-9);
      expect(v).toBeLessThanOrEqual(0.5 + burning.amplitude + 1e-9);
    }
  });

  it('actually moves — it uses most of the swing it is allowed', () => {
    const spread = Math.max(...samples) - Math.min(...samples);
    expect(spread).toBeGreaterThan(burning.amplitude);
  });

  it('is deterministic for the same clock reading', () => {
    expect(flickerTintStrength(0.5, burning, 3.25)).toBe(flickerTintStrength(0.5, burning, 3.25));
  });

  it('separates two actors that differ only by phase', () => {
    const other = { ...burning, phase: 0.37 };
    const apart = Array.from({ length: 60 }, (_, i) =>
      Math.abs(flickerTintStrength(0.5, burning, i / 60) - flickerTintStrength(0.5, other, i / 60)),
    );
    expect(Math.max(...apart)).toBeGreaterThan(0.05);
  });

  it('clamps rather than overshooting when the resting value is already extreme', () => {
    expect(flickerTintStrength(1, burning, 0.04)).toBeLessThanOrEqual(1);
    expect(flickerTintStrength(0, burning, 0.12)).toBeGreaterThanOrEqual(0);
  });
});

describe('palette wiring (agora-f821.24)', () => {
  it('takes every tint number straight from the palette row', () => {
    for (const visual of Object.values(CONDITION_VISUALS)) {
      const shading = resolveActorBodyShading(actor({ conditions: named(visual.name) }));
      if (visual.tintColor === null) {
        expect(shading.tintColor, visual.name).toBeNull();
        expect(shading.tintStrength, visual.name).toBe(0);
        expect(shading.desaturate, visual.name).toBe(0);
      } else {
        expect(shading.tintColor, visual.name).toBe(visual.tintColor);
        expect(shading.tintStrength, visual.name).toBe(visual.tintStrength);
        expect(shading.desaturate, visual.name).toBe(visual.desaturate);
      }
    }
  });

  it('gives every palette key either a tint or an explicit null — never undefined', () => {
    for (const key of Object.keys(CONDITION_VISUALS)) {
      const shading = resolveActorBodyShading(actor({ conditions: named(key) }));
      expect(shading.tintColor === null || typeof shading.tintColor === 'number', key).toBe(true);
    }
  });

  it('no longer substring-matches: a near-miss name gets the plain baseline', () => {
    expect(resolveConditionVisual('Deeply Poisoned').tintColor).not.toBe(
      CONDITION_VISUALS.poisoned.tintColor,
    );
    const shading = resolveActorBodyShading(actor({ conditions: named('Deeply Poisoned') }));
    expect(shading).toEqual(ACTOR_SHADING_BASE);
  });

  it('flickers for burning ONLY, whatever else is tinted', () => {
    expect(resolveActorBodyShading(actor({ conditions: named('Ignited') })).flicker).not.toBeNull();
    for (const name of ['Petrified', 'Frozen', 'Chilled', 'Paralyzed', 'Poisoned', 'Charmed', 'Stunned']) {
      expect(resolveActorBodyShading(actor({ conditions: named(name) })).flicker, name).toBeNull();
    }
  });

  it('still lets defeat beat every condition the palette knows', () => {
    for (const visual of Object.values(CONDITION_VISUALS)) {
      const shading = resolveActorBodyShading(actor({ currentHP: 0, conditions: named(visual.name) }));
      expect(shading, visual.name).toEqual(ACTOR_SHADING_DEFEATED);
    }
  });
});
