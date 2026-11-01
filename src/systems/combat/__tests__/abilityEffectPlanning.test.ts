/** Pins registration order, source ownership and callback boundaries without clocks or IDs. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Spell, SpellEffect } from '../../../types/spells';
import type { MovementTriggerDebuff } from '../../spells/effects/trigger/types';
import type { AoEParams } from '../../../utils/combat/aoeCalculations';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import swordBurst from '@/data/spells/level-0/sword-burst.json';
import { getDurationRounds as legacyDuration } from '../../../hooks/spellEffectUtils';
import { getDurationRounds } from '../../spells/effects/spellEffectRules';
import { getZoneAreaFromAoEParams as legacyArea } from '../../../hooks/actionUtils';
import { getZoneAreaFromAoEParams } from '../../../utils/spatial/targetingUtils';
import { getPersistentSpellZoneArea, planPersistentSpellZone, planTerrainSpellZone, hasRecurringSpellTurnTiming, planScheduledSpellEffects, planUnpublishedMovementDebuffs } from '../abilityEffectPlanning';

const makeSpell = (effects: SpellEffect[]): Spell => ({ ...structuredClone(swordBurst) as unknown as Spell, effects, duration: { type: 'timed', value: 2, unit: 'round', concentration: false } });
const damage = (patch: Partial<SpellEffect> = {}): SpellEffect => ({ type: 'DAMAGE', trigger: { type: 'turn_start' }, condition: { type: 'always' }, damage: { dice: '1d6', type: 'fire' }, ...patch } as SpellEffect);
const params: AoEParams = { shape: 'Sphere', origin: { x: 2, y: 2 }, size: 10 };
const zone = { areaOfEffect: { shape: 'Sphere' }, aoeParams: params };
afterEach(() => vi.restoreAllMocks());

describe('pure spell registration plans', () => {
  it('keeps the established helper identities at compatibility paths', () => {
    expect(legacyDuration).toBe(getDurationRounds);
    expect(legacyArea).toBe(getZoneAreaFromAoEParams);
  });

  it('orders direct and recurring start effects per target before end effects', () => {
    const direct = damage();
    const recurring = damage({ trigger: { type: 'immediate' }, recurringMechanics: [{ timing: 'turn_start', frequency: 'every_time' }, { timing: 'turn_end', frequency: 'every_time' }] });
    const spell = makeSpell([direct, recurring]);
    const caster = createMockCombatCharacter({ id: 'caster' });
    const targets = [createMockCombatCharacter({ id: 'a' }), createMockCombatCharacter({ id: 'b' })];
    const plans = [...planScheduledSpellEffects(spell, caster, targets, 7, 15)];
    expect(plans.map(args => [args[2], args[3], args[4][0] === direct ? 'direct' : 'recurring'])).toEqual([
      ['a', 'turn_start', 'direct'], ['a', 'turn_start', 'recurring'],
      ['b', 'turn_start', 'direct'], ['b', 'turn_start', 'recurring'],
      ['a', 'turn_end', 'recurring'], ['b', 'turn_end', 'recurring']
    ]);
    expect(plans.every(args => args[5] === 7 && args[6] === 2 && args[7] === 15)).toBe(true);
  });

  it('suppresses zone-owned recurring end effects but retains direct end effects', () => {
    const direct = damage({ trigger: { type: 'turn_end' } });
    const recurring = damage({ trigger: { type: 'immediate' }, recurringMechanics: [{ timing: 'turn_end', frequency: 'every_time' }] });
    const spell = makeSpell([direct, recurring]);
    const caster = createMockCombatCharacter();
    const plans = [...planScheduledSpellEffects(spell, caster, [caster], 1, 14, zone)];
    expect(plans).toHaveLength(1);
    expect(plans[0][4]).toEqual([direct]);
    expect(plans[0][8]).toBeUndefined();
  });

  it('resumes after each publication and preserves forEach target-length semantics', () => {
    const spell = makeSpell([damage(), damage({ trigger: { type: 'turn_end' } })]);
    const caster = createMockCombatCharacter();
    const targets = [createMockCombatCharacter({ id: 'a' }), createMockCombatCharacter({ id: 'b' })];
    let currentTurn = 1;
    const plans = planScheduledSpellEffects(spell, caster, targets, () => currentTurn, 14);
    expect(plans.next().value?.[2]).toBe('a');
    // Model a publication callback that edits metadata and extends the roster.
    spell.duration.value = 5;
    currentTurn = 4;
    targets.push(createMockCombatCharacter({ id: 'added' }));
    const remaining = [...plans];
    expect(remaining.map(args => [args[2], args[3]])).toEqual([
      ['b', 'turn_start'], ['a', 'turn_end'], ['b', 'turn_end'], ['added', 'turn_end']
    ]);
    expect(remaining.every(args => args[6] === 5 && args[5] === 4)).toBe(true);
  });

  it('rechecks command debuffs after each target instead of duplicating a newly published record', () => {
    const spell = makeSpell([damage({ trigger: { type: 'on_target_move' } })]);
    const caster = createMockCombatCharacter({ id: 'caster' });
    const targets = [createMockCombatCharacter({ id: 'a' }), createMockCombatCharacter({ id: 'b' })];
    const commandDebuffs: MovementTriggerDebuff[] = [];
    const plans = planUnpublishedMovementDebuffs(spell, caster, targets, commandDebuffs, 2, 13);
    expect(plans.next().value?.[2]).toBe('a');
    commandDebuffs.push({ spellId: spell.id, casterId: caster.id, targetId: 'b' } as MovementTriggerDebuff);
    expect(plans.next().done).toBe(true);
  });

  it('keeps duration fallback and consumes no ambient receipt sources', () => {
    const spell = makeSpell([damage({ trigger: { type: 'on_target_move' } })]);
    spell.duration = { type: 'instantaneous', concentration: false };
    const caster = createMockCombatCharacter();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Unexpected clock'); });
    const rng = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unexpected randomness'); });
    const plans = [...planUnpublishedMovementDebuffs(spell, caster, [caster], [], 2, 13)];
    expect(plans[0][5]).toBe(1);
    expect(clock).not.toHaveBeenCalled();
    expect(rng).not.toHaveBeenCalled();
  });

  it('registers persistent defenses even without a persistent trigger, retaining source references', () => {
    const effect: SpellEffect = { type: 'DEFENSIVE', defenseType: 'resistance', trigger: { type: 'immediate' }, condition: { type: 'always' }, duration: { type: 'rounds', value: 2 }, damageType: ['fire'] };
    const spell = makeSpell([effect]);
    const caster = createMockCombatCharacter({ facing: 'north' });
    const plan = planPersistentSpellZone(spell, caster, zone, 4, 16);
    expect(plan?.[2]).toBe(params);
    expect(plan?.[4]).toBe(spell.effects);
    expect(plan?.slice(5)).toEqual([4, 2, 16, spell.targeting.validTargets, 'north']);
    expect(planPersistentSpellZone(makeSpell([damage({ trigger: { type: 'immediate' } })]), caster, zone, 4, 16)).toBeUndefined();
  });

  it('uses the secondary proximity radius only for a zero-size primary area', () => {
    const spell = makeSpell([damage({ recurringMechanics: [{ timing: 'on_entity_proximity', frequency: 'every_time' }] })]);
    spell.targeting.spatialDetails = { forms: [{ shape: 'emanation', sizeUnit: 'feet', size: 15 }] };
    expect(getPersistentSpellZoneArea(spell, zone.areaOfEffect, { ...params, size: 0 })).toEqual({ shape: 'sphere', size: 15 });
    expect(getPersistentSpellZoneArea(spell, zone.areaOfEffect, params)).toEqual({ shape: 'Sphere', size: 10 });
    expect(hasRecurringSpellTurnTiming(spell)).toBe(false);
    expect(planTerrainSpellZone(spell, createMockCombatCharacter(), zone)).toBeUndefined();
  });
});
