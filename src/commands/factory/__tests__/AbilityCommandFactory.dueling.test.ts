/** Native Ilan regression: saved Dueling, hand ownership, damage and flat critical terms agree. */
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '@/data/classes';
import { WEAPONS_DATA } from '@/data/items';
import { createMockCombatCharacter, createMockCombatState, createMockPlayerCharacter, createMockGameState } from '@/utils/core/factories';
import { createPlayerCombatCharacter } from '@/utils/combat/combatUtils';
import { AbilityCommandFactory } from '../AbilityCommandFactory';
import type { Ability, CombatCharacter } from '@/types/combat';
import type { Item, PlayerCharacter } from '@/types';

const dueling = CLASSES_DATA.fighter.fightingStyles!.find(style => style.id === 'dueling')!;
function player(weapon = WEAPONS_DATA.longsword, offHand?: Item, style = true): PlayerCharacter {
  return createMockPlayerCharacter({
    id: 'ilan', name: 'Ilan', class: CLASSES_DATA.fighter,
    finalAbilityScores: { Strength: 15, Dexterity: 13, Constitution: 14, Intelligence: 9, Wisdom: 12, Charisma: 10 },
    selectedFightingStyle: style ? dueling : undefined,
    equippedItems: { MainHand: weapon, ...(offHand ? { OffHand: offHand } : {}) },
    feats: [],
  });
}
async function hit(p: PlayerCharacter, critical = false, patch?: Partial<Ability>) {
  const actor = createPlayerCombatCharacter(p);
  const target = createMockCombatCharacter({ id: 'target', name: 'Target', armorClass: 1, currentHP: 100, maxHP: 100, position: { x: 1, y: 0 } });
  actor.position = { x: 0, y: 0 };
  const ability = { ...actor.abilities.find(a => a.id === 'attack_main')!, ...patch };
  const [command] = AbilityCommandFactory.createCommands(ability, actor, [target], createMockGameState(), undefined, undefined,
    { attackRollRng: () => critical ? 0.999 : 0.5, damageRng: () => 0 });
  const result = await command.execute(createMockCombatState({ characters: [actor, target] }));
  return { damage: 100 - result.characters.find(c => c.id === target.id)!.currentHP, actor, result };
}

describe('saved Dueling and normal weapon execution', () => {
  it('projects the selected style and a separate hand snapshot without mutating the save', () => {
    const p = player(), before = structuredClone(p);
    const actor = createPlayerCombatCharacter(p);
    expect(actor).toMatchObject({ selectedFightingStyle: dueling, equippedItems: { MainHand: WEAPONS_DATA.longsword } });
    expect(actor.equippedItems).not.toBe(p.equippedItems);
    expect(actor.equippedItems?.MainHand).not.toBe(p.equippedItems.MainHand);
    expect(p).toEqual(before);
  });
  it('adds the promised two damage to Ilan\'s one-handed longsword', async () => {
    expect((await hit(player())).damage).toBe(1 + 2 + 2);
    expect((await hit(player(WEAPONS_DATA.longsword, undefined, false))).damage).toBe(1 + 2);
  });
  it('does not double the flat style bonus on a critical hit', async () => {
    expect((await hit(player(), true)).damage).toBe(2 + 2 + 2);
  });
  it('does not treat a second weapon as an empty hand', async () => {
    expect((await hit(player(WEAPONS_DATA.longsword, WEAPONS_DATA.dagger))).damage).toBe(1 + 2);
  });
  it('allows a shield without treating it as another weapon', async () => {
    const shield = { id: 'shield', name: 'Shield', type: 'armor', armorCategory: 'Shield' } as Item;
    expect((await hit(player(WEAPONS_DATA.longsword, shield))).damage).toBe(1 + 2 + 2);
  });
  it('excludes ranged and two-handed weapons', async () => {
    expect((await hit(player(WEAPONS_DATA.longbow))).damage).toBe(1 + 1);
    expect((await hit(player(WEAPONS_DATA.greatsword))).damage).toBe(2 + 2);
  });
  it('applies the flat style term once across a mixed damage hit', async () => {
    const effects: Ability['effects'] = [
      { type: 'damage', dice: '1d8', value: 0, damageType: 'slashing' },
      { type: 'damage', dice: '1d4', value: 0, damageType: 'fire' },
    ];
    const withStyle = await hit(player(), false, { effects });
    const without = await hit(player(WEAPONS_DATA.longsword, undefined, false), false, { effects });
    expect(withStyle.damage - without.damage).toBe(2);
  });
  it('leaves fixed authored attack damage unchanged', async () => {
    const attack: Partial<Ability> = { attackBonus: 4, effects: [{ type: 'damage', dice: '1d8+2', value: 0, damageType: 'slashing' }] };
    expect((await hit(player(), false, attack)).damage).toBe(1 + 2);
  });
});
