import { describe, it, expect } from 'vitest';
import { spellSlotsForClassLevel, growSpellSlots, cantripsKnownForClassLevel } from '../spellSlotProgression';

const max = (slots: ReturnType<typeof spellSlotsForClassLevel>, lvl: number) =>
  (slots as Record<string, { max: number }>)[`level_${lvl}`]?.max ?? 0;
const cur = (slots: ReturnType<typeof spellSlotsForClassLevel>, lvl: number) =>
  (slots as Record<string, { current: number }>)[`level_${lvl}`]?.current ?? 0;

describe('spellSlotsForClassLevel', () => {
  it('grows a full caster from level 1 to 3 (the campaign scope)', () => {
    expect(max(spellSlotsForClassLevel('wizard', 1), 1)).toBe(2);
    expect(max(spellSlotsForClassLevel('wizard', 2), 1)).toBe(3);
    const l3 = spellSlotsForClassLevel('wizard', 3);
    expect(max(l3, 1)).toBe(4);
    expect(max(l3, 2)).toBe(2); // a level-3 caster can finally cast 2nd-level spells
  });

  it('gives half casters level-1 slots that grow (2024 rules)', () => {
    expect(max(spellSlotsForClassLevel('paladin', 1), 1)).toBe(2);
    expect(max(spellSlotsForClassLevel('ranger', 3), 1)).toBe(3);
  });

  it('moves warlock pact slots up a level', () => {
    expect(max(spellSlotsForClassLevel('warlock', 1), 1)).toBe(1);
    expect(max(spellSlotsForClassLevel('warlock', 2), 1)).toBe(2);
    const l3 = spellSlotsForClassLevel('warlock', 3);
    expect(max(l3, 1)).toBe(0); // 1st-level pact slots are gone
    expect(max(l3, 2)).toBe(2); // now two 2nd-level slots
  });

  it('returns nothing for non-casters', () => {
    expect(spellSlotsForClassLevel('fighter', 3)).toBeUndefined();
    expect(spellSlotsForClassLevel('barbarian', 5)).toBeUndefined();
  });
});

describe('growSpellSlots (preserves spent slots)', () => {
  it('adds only the newly-gained slot when leveling a wizard who spent everything', () => {
    const l1Spent = spellSlotsForClassLevel('wizard', 1)!;
    (l1Spent as Record<string, { current: number }>).level_1.current = 0; // both L1 slots spent
    const grown = growSpellSlots(l1Spent, 'wizard', 2);
    expect(max(grown, 1)).toBe(3);
    expect(cur(grown, 1)).toBe(1); // only the new 3rd slot is available, not a free refill
  });

  it('grants a leveled warlock the new higher-level pact slots', () => {
    const l2Spent = spellSlotsForClassLevel('warlock', 2)!;
    (l2Spent as Record<string, { current: number }>).level_1.current = 0; // spent both L1 pact slots
    const grown = growSpellSlots(l2Spent, 'warlock', 3);
    expect(cur(grown, 1)).toBe(0);
    expect(cur(grown, 2)).toBe(2); // two fresh 2nd-level pact slots
  });

  it('leaves non-casters untouched', () => {
    expect(growSpellSlots(undefined, 'fighter', 3)).toBeUndefined();
  });
});

describe('cantripsKnownForClassLevel', () => {
  it('grows a wizard cantrip count across level milestones', () => {
    expect(cantripsKnownForClassLevel('wizard', 1)).toBe(3);
    expect(cantripsKnownForClassLevel('wizard', 4)).toBe(4); // gains one at level 4
    expect(cantripsKnownForClassLevel('wizard', 10)).toBe(5);
  });

  it('gives a sorcerer four cantrips at level 1, five at level 4', () => {
    expect(cantripsKnownForClassLevel('sorcerer', 1)).toBe(4);
    expect(cantripsKnownForClassLevel('sorcerer', 4)).toBe(5);
  });

  it('is case-insensitive and clamps out-of-range levels', () => {
    expect(cantripsKnownForClassLevel('Bard', 1)).toBe(2);
    expect(cantripsKnownForClassLevel('bard', 0)).toBe(2); // clamps up to 1
    expect(cantripsKnownForClassLevel('bard', 99)).toBe(4); // clamps down to 20
  });

  it('returns 0 for classes with no cantrip progression', () => {
    expect(cantripsKnownForClassLevel('paladin', 5)).toBe(0);
    expect(cantripsKnownForClassLevel('ranger', 5)).toBe(0);
    expect(cantripsKnownForClassLevel('fighter', 5)).toBe(0);
  });
});
