/** Reaction candidates and Sentinel state can be checked without prompting or rolling. */
import { describe, expect, it } from 'vitest';
import type { Ability } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import { applySentinelStop, selectOpportunityAttackOptions } from '../opportunityAttackPlanning';
import { INGESTED_MONSTERS } from '../../../data/monsters.generated';

const ability = (id: string, patch: Partial<Ability> = {}): Ability => ({
  id, name: id, description: id, type: 'utility', cost: { type: 'free' },
  targeting: 'self', range: 0, effects: [], ...patch,
});

describe('opportunity reaction planning', () => {
  it('preserves melee and unarmed order while excluding ranged weapons', () => {
    const sword = ability('sword', { type: 'attack', range: 1, weapon: {} as Ability['weapon'] });
    const bow = ability('bow', { type: 'attack', range: 12, weapon: {} as Ability['weapon'] });
    const fist = ability('unarmed_strike', { type: 'attack', range: 1 });
    const actor = createMockCombatCharacter({ abilities: [bow, sword, fist] });
    expect(selectOpportunityAttackOptions(actor, false).reactionWeapons).toEqual([sword, fist]);
    expect(actor.abilities).toEqual([bow, sword, fist]);
  });

  it('offers War Caster only when a spell executor is available and the cast is a single-target action', () => {
    const valid = ability('cast', { type: 'spell', cost: { type: 'action' }, targeting: 'single_enemy', spell: {} });
    const self = ability('self', { ...valid, id: 'self', targeting: 'self' });
    const reaction = ability('reaction', { ...valid, id: 'reaction', cost: { type: 'reaction' } });
    const actor = createMockCombatCharacter({ feats: ['War Caster'], abilities: [valid, self, reaction] });
    expect(selectOpportunityAttackOptions(actor, true).warCasterSpells).toEqual([valid]);
    expect(selectOpportunityAttackOptions(actor, false).warCasterSpells).toEqual([]);
  });

  it('does not substitute an unrelated first ability when no melee strike exists', () => {
    const first = ability('fallback');
    const actor = createMockCombatCharacter({ abilities: [first] });
    expect(selectOpportunityAttackOptions(actor, false).reactionWeapons).toEqual([]);
  });

  it('offers the source Ghoul single Bite and Claw, never its Multiattack action', () => {
    const abilities = INGESTED_MONSTERS.ghoul.abilities;
    const actor = createMockCombatCharacter({ abilities });
    expect(selectOpportunityAttackOptions(actor, false).reactionWeapons.map(option => option.id)).toEqual(['bite', 'claw']);
    expect(actor.abilities).toBe(abilities);
  });

  it('does not offer aggregate attacks even when a weapon reference is present', () => {
    const multi = ability('multiattack', { type: 'attack', range: 1,
      multiattackCount: 2, subAttackIds: ['bite'], weapon: {} as Ability['weapon'] });
    const actor = createMockCombatCharacter({ abilities: [multi] });
    expect(selectOpportunityAttackOptions(actor, false).reactionWeapons).toEqual([]);
  });

  it('stops remaining movement once and preserves the original actor', () => {
    const actor = createMockCombatCharacter();
    const stopped = applySentinelStop(actor);
    expect(stopped.actionEconomy.movement).toMatchObject({ used: 0, total: 0 });
    expect(actor.actionEconomy.movement.total).toBe(30);
    expect(stopped.statusEffects.filter(effect => effect.id === 'sentinel_stop')).toHaveLength(1);
    expect(applySentinelStop(stopped)).toBe(stopped);
  });
});
