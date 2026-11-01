/** Keeps source DC ownership and failure receipts testable without rolls or publication. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CombatCharacter, StatusEffect } from '../../../types/combat';
import type { Spell, SpellcastingRestriction } from '../../../types/spells';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import { calculateSpellDC } from '../../../utils/character';
import * as characterUtils from '../../../utils/character';
import { resolveSpellcastingRestrictions } from '../../../hooks/ability/useAbilityExecution';
import swordBurst from '@/data/spells/level-0/sword-burst.json';
import { getSpellcastingRestrictionContext, getSpellcastingRestrictionDC, resolveSpellcastingRestrictionAttempt, getSpellcastingRestrictionFailureMessage } from '../spellcastingRestrictionResolution';

const spell = swordBurst as unknown as Spell;
const restriction: SpellcastingRestriction = { saveType: 'Constitution', failureOutcome: 'casting_fails_and_spell_is_wasted' };
const status = (rule: SpellcastingRestriction, sourceCasterId?: string): StatusEffect => ({ id: 'restriction', name: 'Pain', type: 'debuff', duration: 10, spellcastingRestriction: rule, sourceCasterId });
afterEach(() => vi.restoreAllMocks());

describe('pure spellcasting restriction rules', () => {
  it('uses the current roster caster and retains restriction identity for source lookup', () => {
    const stale = createMockCombatCharacter({ id: 'caster' });
    const live = { ...stale, statusEffects: [status(restriction)] };
    const context = getSpellcastingRestrictionContext(stale, [live]);
    expect(context.liveCaster).toBe(live);
    expect(context.restrictions).toEqual([restriction]);
    expect(context.restrictions[0]).toBe(restriction);
    expect(getSpellcastingRestrictionContext(stale, []).liveCaster).toBe(stale);
  });

  it('uses the explicit original DC even when it is zero', () => {
    const rule = { ...restriction, dc: 0 };
    const caster = createMockCombatCharacter({ statusEffects: [status(rule, 'source')] });
    expect(getSpellcastingRestrictionDC(caster, [caster], rule)).toBe(0);
  });

  it('looks up the exact restriction owner and uses fallback DC only when that owner is absent', () => {
    const other = { ...restriction };
    const source = createMockCombatCharacter({ id: 'source', level: 9 });
    const wrongSource = createMockCombatCharacter({ id: 'other-source', level: 1 });
    const caster = createMockCombatCharacter({ statusEffects: [status(other, wrongSource.id), status(restriction, source.id)] });
    expect(getSpellcastingRestrictionDC(caster, [source, wrongSource], restriction)).toBe(calculateSpellDC(source));
    expect(getSpellcastingRestrictionDC(caster, [], restriction)).toBe(10);
  });

  it('builds an unsuccessful save receipt without IDs, clocks, mutations, or ambient rolls', () => {
    const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster' });
    const before: CombatCharacter = structuredClone(caster);
    const result = resolveSpellcastingRestrictionAttempt(caster, spell, restriction, 16, { total: 8, success: false });
    expect(result.saveLog).toMatchObject({ type: 'status', characterId: 'caster', targetIds: ['caster'], data: { spellId: spell.id, preCastRestriction: true, saveSucceeded: false, failureOutcome: restriction.failureOutcome } });
    expect(result.saveLog).not.toHaveProperty('id');
    expect(result.saveLog).not.toHaveProperty('timestamp');
    expect(caster).toEqual(before);
    expect(getSpellcastingRestrictionFailureMessage(caster, spell, restriction)).toBe(`${spell.name} is wasted because Caster failed the required Constitution save.`);
  });

  it('keeps successful and failed save wording, including source labels awaiting an adapter', () => {
    const caster = createMockCombatCharacter({ name: 'Caster' });
    const rule = { ...restriction, saveType: 'source-authored label' };
    expect(resolveSpellcastingRestrictionAttempt(caster, spell, rule, 12, { total: 18, success: true }).saveLog.message).toContain('succeeds the source-authored label save');
    expect(resolveSpellcastingRestrictionAttempt(caster, spell, rule, 12, { total: 8, success: false }).saveLog.message).toContain('fails the source-authored label save');
  });
});

describe('existing restriction adapter ordering', () => {
  it('publishes each save before rolling the next and stops at the first failure', () => {
    const calls: string[] = [];
    const caster = createMockCombatCharacter({ id: 'caster', name: 'Before callback', statusEffects: [status({ ...restriction, dc: 12 }), status({ ...restriction, dc: 14 }), status({ ...restriction, dc: 18 })] });
    const roll = vi.spyOn(characterUtils, 'rollSavingThrow').mockImplementation((_caster, _ability, dc) => {
      calls.push(`roll:${dc}`);
      return { total: 13, success: dc === 12, modifiersApplied: [] };
    });
    const accepted = resolveSpellcastingRestrictions(caster, [caster], spell, entry => {
      calls.push(`log:${entry.type}`);
      if (entry.type === 'status' && entry.data?.saveSucceeded === false) caster.name = 'After callback';
    }, message => {
      calls.push('warning');
      expect(message).toContain('After callback');
    });
    expect(accepted).toBe(false);
    expect(roll).toHaveBeenCalledTimes(2);
    expect(calls).toEqual(['roll:12', 'log:status', 'roll:14', 'log:status', 'warning', 'log:action']);
  });

  it('uses callback-updated source DC for the following restriction', () => {
    const source = createMockCombatCharacter({ id: 'source', level: 1 });
    const caster = createMockCombatCharacter({ statusEffects: [status({ ...restriction, dc: 10 }), status(restriction, source.id)] });
    const dcs: number[] = [];
    vi.spyOn(characterUtils, 'rollSavingThrow').mockImplementation((_caster, _ability, dc) => {
      dcs.push(dc);
      return { total: 30, success: true, modifiersApplied: [] };
    });
    const notify = vi.fn();
    expect(resolveSpellcastingRestrictions(caster, [caster, source], spell, () => { source.level = 17; }, notify)).toBe(true);
    expect(dcs).toEqual([10, calculateSpellDC(source)]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not read the receipt clock when no log callback exists', () => {
    const caster = createMockCombatCharacter({ statusEffects: [status({ ...restriction, dc: 10 })] });
    vi.spyOn(characterUtils, 'rollSavingThrow').mockReturnValue({ total: 20, success: true, modifiersApplied: [] });
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Unexpected receipt clock'); });
    expect(resolveSpellcastingRestrictions(caster, [caster], spell)).toBe(true);
    expect(clock).not.toHaveBeenCalled();
  });
});
