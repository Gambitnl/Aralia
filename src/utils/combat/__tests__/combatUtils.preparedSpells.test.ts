/** Prepared defenses must reach real attack resolution without another cast or restored resources. */
import { describe, expect, it } from 'vitest';
import bladeWardData from '../../../../public/data/spells/level-0/blade-ward.json';
import blessData from '../../../../public/data/spells/level-1/bless.json';
import type { Spell } from '../../../types';
import type { Ability } from '../../../types/combat';
import { createMockPlayerCharacter, createMockCombatCharacter, createMockCombatState, createMockGameState } from '../../core/factories';
import { buildOutOfCombatStatusEffect } from '../../spells/outOfCombatCasting';
import { carryPreparedSpellEffects, endedPreparedConcentrationIds } from '../../spells/preparedCombatEffects';
import { AbilityCommandFactory } from '../../../commands/factory/AbilityCommandFactory';
import { BreakConcentrationCommand } from '../../../commands/effects/ConcentrationCommands';

const spell = bladeWardData as unknown as Spell;
const at = new Date('0351-01-06T15:15:08Z');
function preparation(legacy = false) {
  const saved = buildOutOfCombatStatusEffect(spell, 'ilan', at, 0)!;
  if (legacy) {
    delete saved.sourceSpellId;
    delete saved.sourceCastLevel;
    delete saved.requiresConcentration;
  }
  const player = createMockPlayerCharacter({ id: 'ilan', hp: 14, maxHp: 14, statusEffects: [saved] });
  const actor = createMockCombatCharacter({ id: 'ilan', currentHP: 14, maxHP: 14, armorClass: 16,
    position: { x: 1, y: 0 }, statusEffects: [], activeEffects: [] });
  return { saved, player, actor };
}
const catalog = { [spell.id]: spell };

describe('prepared spell entry', () => {
  it.each([false, true])('carries the paid cast and its actual remaining clock lifetime (legacy=%s)', legacy => {
    const { player, actor } = preparation(legacy);
    const before = structuredClone(player);
    const [result] = carryPreparedSpellEffects([actor], [player], catalog, new Date(at.getTime() + 12000));
    expect(result.statusEffects).toEqual(expect.arrayContaining([expect.objectContaining({
      sourceSpellId: spell.id, sourceCasterId: 'ilan', duration: 8,
    })]));
    expect(result.activeEffects).toEqual([expect.objectContaining({
      spellId: spell.id, casterId: 'ilan', duration: { type: 'rounds', value: 8 },
      mechanics: expect.objectContaining({ attackRollDirection: 'incoming', attackRollModifier: 'penalty', attackRollDice: '1d4' }),
    })]);
    expect(result.concentratingOn).toMatchObject({ spellId: spell.id, spellLevel: 0 });
    expect(result.concentratingOn?.effectIds).toContain(result.activeEffects![0].id);
    expect(result.currentHP).toBe(14);
    expect(result.position).toEqual(actor.position);
    expect(player).toEqual(before);
    expect(carryPreparedSpellEffects([result], [player], catalog, new Date(at.getTime() + 12000))).toEqual([result]);
  });

  it.each(['expired', 'future', 'invalid clock', 'unknown caster', 'forged identity'] as const)('rejects %s without inventing an effect', kind => {
    const { player, actor, saved } = preparation();
    let now = new Date(at);
    if (kind === 'expired') now = new Date(at.getTime() + 60000);
    if (kind === 'future') now = new Date(at.getTime() - 1);
    if (kind === 'invalid clock') saved.worldTime!.expiresAtMs = NaN;
    if (kind === 'unknown caster') saved.sourceCasterId = 'absent';
    if (kind === 'forged identity') saved.id = 'custom-ward';
    expect(carryPreparedSpellEffects([actor], [player], catalog, now)).toEqual([actor]);
  });

  it('does not refresh the final partial round or guess another spell family\'s mechanics', () => {
    const { player, actor } = preparation();
    const [lastRound] = carryPreparedSpellEffects([actor], [player], catalog, new Date(at.getTime() + 59000));
    expect(lastRound.activeEffects![0].duration).toEqual({ type: 'rounds', value: 1 });
    const otherFamily = { ...spell, effects: [{ type: 'UTILITY', utilityType: 'light',
      trigger: { type: 'immediate' }, condition: { type: 'always' } }] } as unknown as Spell;
    expect(carryPreparedSpellEffects([actor], [player], { [spell.id]: otherFamily }, at)).toEqual([actor]);
    expect(endedPreparedConcentrationIds(player, [actor], { [spell.id]: otherFamily })).toEqual([]);
  });

  it('keeps the real higher slot level and original caster when another member carries Bless', () => {
    const bless = blessData as unknown as Spell;
    const caster = createMockPlayerCharacter({ id: 'cleric', statusEffects: [] });
    const holder = createMockPlayerCharacter({ id: 'ally', statusEffects: [buildOutOfCombatStatusEffect(bless, caster.id, at, 3)!] });
    const actors = [caster, holder].map(p => createMockCombatCharacter({ id: p.id, statusEffects: [], activeEffects: [] }));
    const result = carryPreparedSpellEffects(actors, [caster, holder], { [bless.id]: bless }, at);
    expect(result[0].concentratingOn).toMatchObject({ spellId: bless.id, spellLevel: 3 });
    expect(result[1].activeEffects![0]).toMatchObject({ spellId: bless.id, casterId: caster.id });
    expect(result[0].concentratingOn!.effectIds).toContain(result[1].activeEffects![0].id);
    expect(result[1].concentratingOn).toBeUndefined();
  });

  it('applies the prepared d4 in actual weapon resolution and explains its source in the roll', async () => {
    const { player, actor } = preparation();
    const [warded] = carryPreparedSpellEffects([actor], [player], catalog, at);
    const attacker = createMockCombatCharacter({ id: 'ghoul', position: { x: 0, y: 0 }, activeEffects: [], statusEffects: [] });
    const attack: Ability = { id: 'bite', name: 'Bite', description: '', type: 'attack',
      cost: { type: 'action' }, targeting: 'single_enemy', range: 1, attackBonus: 4,
      effects: [{ type: 'damage', value: 4, damageType: 'piercing' }] };
    async function resolve(target: typeof actor) {
      const [command] = AbilityCommandFactory.createCommands(attack, attacker, [target], createMockGameState(), undefined, undefined,
        // Every d20 is 13 and every d4 is 3: 17 hits AC16; Ward reduces it to14.
        { attackRollRng: () => 0.625, damageRng: () => 0 });
      return command.execute(createMockCombatState({ characters: [attacker, target] }));
    }
    const plain = await resolve(actor);
    const protectedResult = await resolve(warded);
    expect(plain.characters.find(c => c.id === 'ilan')!.currentHP).toBe(10);
    expect(protectedResult.characters.find(c => c.id === 'ilan')!.currentHP).toBe(14);
    expect(protectedResult.combatLog.map(entry => entry.message).join('\n')).toMatch(/Mods: -3 \[Blade Ward\]/);
  });

  it('removes the prepared mechanics when concentration breaks, preserving another caster', () => {
    const first = preparation();
    const other = createMockPlayerCharacter({ id: 'other', statusEffects: [buildOutOfCombatStatusEffect(spell, 'other', at, 0)!] });
    const actors = carryPreparedSpellEffects([first.actor, createMockCombatCharacter({ id: 'other', statusEffects: [], activeEffects: [] })],
      [first.player, other], catalog, at);
    const result = new BreakConcentrationCommand({ spellId: spell.id, spellName: spell.name, castAtLevel: 0,
      caster: actors[0], targets: [], gameState: createMockGameState() }).execute(createMockCombatState({ characters: actors }));
    expect(result.characters[0].activeEffects).toHaveLength(0);
    expect(result.characters[0].statusEffects).toHaveLength(0);
    expect(result.characters[0].concentratingOn).toBeUndefined();
    expect(result.characters[1]).toEqual(actors[1]);
    expect(endedPreparedConcentrationIds(first.player, result.characters, catalog)).toEqual([first.saved.id]);
    expect(endedPreparedConcentrationIds(other, result.characters, catalog)).toEqual([]);
    expect(endedPreparedConcentrationIds(undefined, result.characters, catalog)).toEqual([]);
  });
});
