/**
 * Healer's Kit resolver: the cases src/data/feats/__tests__/healerFeat.test.ts
 * does not reach (C14, agora-9ed9.14). That file covers stabilize, the Hit Die
 * rider, the reroll of a 1, kit use counting, and the no-feat refusal.
 *
 * Exercises: src/systems/healing/healersKit.ts
 */
import { describe, it, expect } from 'vitest';
import {
  HEALERS_KIT_MAX_USES,
  hasHealerFeat,
  kitUsesRemaining,
  resolveHealersKitUse,
} from '../healersKit';
import type { HitPointDicePool } from '../../../types/character';
import type { AbilityScores } from '../../../types';

/** rng that returns the scripted values in order, then fails loudly. */
const scriptedRng = (values: number[]) => {
  let index = 0;
  return () => {
    if (index >= values.length) throw new Error('rng called more often than scripted');
    return values[index++];
  };
};

const scores = (constitution: number): AbilityScores => ({
  Strength: 10, Dexterity: 10, Constitution: constitution, Intelligence: 10, Wisdom: 10, Charisma: 10,
});

const medic = { name: 'Medic', feats: ['healer'] };
const plainUser = { name: 'Plain', feats: [] as string[] };
const kit = { id: 'healer_s_kit', usesRemaining: 5 };

const target = (overrides: Partial<{ hp: number; maxHp: number; constitution: number; hitPointDice: HitPointDicePool[] }> = {}) => ({
  name: 'Ally',
  hp: overrides.hp ?? 4,
  maxHp: overrides.maxHp ?? 20,
  finalAbilityScores: scores(overrides.constitution ?? 14),
  hitPointDice: overrides.hitPointDice ?? [{ die: 8 as const, current: 2, max: 2 }],
});

describe('hasHealerFeat and kitUsesRemaining', () => {
  it('reads the feat list and tolerates a missing one', () => {
    expect(hasHealerFeat({ feats: ['alert', 'healer'] })).toBe(true);
    expect(hasHealerFeat({ feats: ['alert'] })).toBe(false);
    expect(hasHealerFeat({ feats: undefined as unknown as string[] })).toBe(false);
  });

  it('treats a missing kit as 0 uses and an untracked kit as brand new', () => {
    expect(kitUsesRemaining(undefined)).toBe(0);
    expect(kitUsesRemaining({ usesRemaining: undefined })).toBe(HEALERS_KIT_MAX_USES);
    expect(kitUsesRemaining({ usesRemaining: 3 })).toBe(3);
  });
});

describe('resolveHealersKitUse', () => {
  it('fails with no_kit and spends nothing when no kit is carried', () => {
    const outcome = resolveHealersKitUse({ user: medic, target: target({ hp: 0 }), kit: undefined, rng: scriptedRng([]) });
    expect(outcome).toMatchObject({ ok: false, failure: 'no_kit', kitUsesRemaining: 0, healing: 0, rolls: [] });
  });

  it('lets a Healer tend a wounded ally who is not dying, without stabilizing', () => {
    // d8 roll 5 (rng 0.5) + Constitution 14 (+2) = 7 HP; 4 of 20 HP leaves room.
    const outcome = resolveHealersKitUse({ user: medic, target: target({ hp: 4 }), kit, rng: scriptedRng([0.5]) });
    expect(outcome).toMatchObject({ ok: true, stabilized: false, healing: 7, rolls: [5], kitUsesRemaining: 4 });
    expect(outcome.message).toContain('Medic tends Ally');
  });

  it('refuses to tend an ally at full HP, keeping the kit use and the Hit Die (C14 fix)', () => {
    const full = target({ hp: 20, maxHp: 20 });
    const outcome = resolveHealersKitUse({ user: medic, target: full, kit, rng: scriptedRng([]) });
    expect(outcome).toMatchObject({ ok: false, failure: 'target_dead_or_full', kitUsesRemaining: 5, healing: 0, rolls: [] });
    expect(outcome.hitPointDice).toBeUndefined();
  });

  it('caps the healing at the missing HP', () => {
    // d8 roll 8 (rng 0.99) + 2 = 10, but only 3 HP are missing.
    const outcome = resolveHealersKitUse({ user: medic, target: target({ hp: 17, maxHp: 20 }), kit, rng: scriptedRng([0.99]) });
    expect(outcome.healing).toBe(3);
  });

  it('uses healer Proficiency Bonus instead of target Constitution modifier (GG-447)', () => {
    // GG-447: 2024 PHB Battle Medic adds healer Proficiency Bonus, not target CON.
    // Level 1 healer (PB +2), ally with CON 8 (-1) rolls 4 on d8 (rng 0.4):
    // roll (4) + PB (2) = 6 HP (previously gave 4 - 1 = 3 HP).
    const level1Healer = { name: 'Medic', feats: ['healer'], level: 1 };
    const lowConTarget = target({ hp: 0, constitution: 8 });
    const outcome = resolveHealersKitUse({ user: level1Healer, target: lowConTarget, kit, rng: scriptedRng([0.4]) });
    expect(outcome).toMatchObject({ ok: true, stabilized: true, healing: 6, rolls: [4] });
  });

  it('scales healing with higher healer level and explicit proficiencyBonus', () => {
    // Level 5 healer (PB +3), ally rolls 4 on d8 -> 4 + 3 = 7 HP
    const level5Healer = { name: 'Expert Medic', feats: ['healer'], level: 5 };
    const outcomeLvl5 = resolveHealersKitUse({ user: level5Healer, target: target({ hp: 0 }), kit, rng: scriptedRng([0.4]) });
    expect(outcomeLvl5.healing).toBe(7);

    // Explicit proficiencyBonus 4: 4 + 4 = 8 HP
    const highPbHealer = { name: 'Master Medic', feats: ['healer'], proficiencyBonus: 4 };
    const outcomePb4 = resolveHealersKitUse({ user: highPbHealer, target: target({ hp: 0 }), kit, rng: scriptedRng([0.4]) });
    expect(outcomePb4.healing).toBe(8);
  });

  it('spends the die from the largest pool that still has one', () => {
    const pools: HitPointDicePool[] = [
      { die: 6, current: 3, max: 3 },
      { die: 10, current: 0, max: 1 },
      { die: 8, current: 1, max: 1 },
    ];
    const outcome = resolveHealersKitUse({ user: medic, target: target({ hp: 0, hitPointDice: pools }), kit, rng: scriptedRng([0.5]) });
    // The empty d10 pool is skipped; the d8 is the largest with a die left.
    expect(outcome.rolls).toEqual([5]);
    expect(outcome.hitPointDice).toEqual([
      { die: 6, current: 3, max: 3 },
      { die: 10, current: 0, max: 1 },
      { die: 8, current: 0, max: 1 },
    ]);
  });

  it('still stabilizes, and says so, when the dying target has no Hit Dice left', () => {
    const outcome = resolveHealersKitUse({
      user: medic,
      target: target({ hp: 0, hitPointDice: [{ die: 8, current: 0, max: 2 }] }),
      kit,
      rng: scriptedRng([]),
    });
    expect(outcome).toMatchObject({ ok: true, stabilized: true, healing: 0, rolls: [], kitUsesRemaining: 4 });
    expect(outcome.message).toContain('has no Hit Dice left to spend');
  });

  it('uses the singular in the message when one use is left', () => {
    const outcome = resolveHealersKitUse({ user: plainUser, target: target({ hp: 0 }), kit: { id: 'healer_s_kit', usesRemaining: 2 }, rng: scriptedRng([]) });
    expect(outcome.message).toContain("(Healer's Kit: 1 use left.)");
  });
});
