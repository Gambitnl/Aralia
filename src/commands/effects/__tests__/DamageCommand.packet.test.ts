/**
 * Proves that a native typed weapon hit keeps separate defenses while paying
 * for one reaction, one HP transition, and one concentration/post-HP boundary.
 * Uses the same command entry point as the real Ghoul Bite, not a lab resolver.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '@/types/combat';
import type { DamageEffect } from '@/types/spells';
import { createMockCombatCharacter, createMockCombatState, createMockCommandContext } from '@/utils/core';
import { resetEconomy } from '@/utils/combat/actionEconomyUtils';
import { checkConcentration } from '@/utils/character';
import { extractPostHpDamageEvents } from '@/systems/combat/reactions/postDamageReactionQueue';
import { DamageCommand } from '../DamageCommand';

vi.mock('@/utils/character', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/utils/character')>(),
  checkConcentration: vi.fn(() => ({ success: true, dc: 10, roll: 18 })),
}));

function floor(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < 12; x += 1) for (let y = 0; y < 12; y += 1) {
    tiles.set(`${x}-${y}`, { id: `${x}-${y}`, coordinates: { x, y }, terrain: 'floor', elevation: 0,
      movementCost: 5, blocksMovement: false, blocksLoS: false, decoration: null, effects: [] });
  }
  return { dimensions: { width: 12, height: 12 }, tiles, theme: 'dungeon', seed: 48 };
}

function actors(wardOverrides: Partial<CombatCharacter> = {}, withProtector = false) {
  const attacker = resetEconomy(createMockCombatCharacter({ id: 'attacker', team: 'enemy', position: { x: 7, y: 5 } }));
  const ward = resetEconomy(createMockCombatCharacter({
    id: 'ward', name: 'Ward', team: 'player', position: { x: 6, y: 5 }, currentHP: 30, maxHP: 30,
    ...wardOverrides,
  }));
  const owner = resetEconomy(createMockCombatCharacter({ id: 'owner', team: 'player', position: { x: 2, y: 2 } }));
  const protector = resetEconomy(createMockCombatCharacter({
    id: 'protector', team: 'player', position: { x: 6, y: 4 }, level: 5,
    isSummon: true, summonMetadata: { casterId: owner.id, spellId: 'primal-companion', initiativePolicy: 'shared' },
    feats: ['interception_style'],
    equipment: { shield: { itemId: 'shield', itemName: 'Shield', slot: 'OffHand', magicStatus: 'nonmagical', properties: ['shield'] } },
  }));
  const characters = withProtector ? [attacker, ward, owner, protector] : [attacker, ward];
  const state = createMockCombatState({ characters, mapData: floor(), combatLog: [],
    turnState: { currentTurn: 1, turnOrder: characters.map(character => character.id), currentCharacterId: attacker.id, phase: 'resolution', actionsThisTurn: [] } });
  return { attacker, ward, protector, state };
}

const part = (dice: string, type: DamageEffect['damage']['type']): DamageEffect => ({
  type: 'DAMAGE', damage: { dice, type }, trigger: { type: 'immediate' }, condition: { type: 'always' },
});

describe('native one-hit typed damage packets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies typed resistance/immunity before sharing temporary HP and publishing one accurate receipt', async () => {
    const fixture = actors({ currentHP: 20, maxHP: 20, tempHP: 3, resistances: ['fire'], immunities: ['cold'] });
    const context = createMockCommandContext({ caster: fixture.attacker, targets: [fixture.ward], damageRng: () => 0 });
    const result = await DamageCommand.forWeaponHit([part('9d1', 'fire'), part('7d1', 'cold')], context).execute(fixture.state);
    expect(result.characters.find(character => character.id === 'ward')).toMatchObject({ currentHP: 19, tempHP: 0 });
    const events = extractPostHpDamageEvents(result.combatLog);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ rawDamage: 16, finalDamage: 4, hpBefore: 20, hpAfter: 19,
      damageType: 'fire + cold', damageComponents: [
        { damageType: 'fire', rawDamage: 9, finalDamage: 4 },
        { damageType: 'cold', rawDamage: 7, finalDamage: 0 },
      ] });
    expect(fixture.ward.currentHP).toBe(20);
    expect(fixture.ward.tempHP).toBe(3);
  });

  it('offers Interception once for the complete hit and makes a stable replay a complete no-op', async () => {
    const fixture = actors({}, true);
    const requestReaction = vi.fn(async () => 'interception:protector');
    let draws = 0;
    const context = createMockCommandContext({ caster: fixture.attacker, targets: [fixture.ward],
      damageEventId: 'one-typed-hit', requestReaction, reactionRng: () => 0.55,
      damageRng: () => { draws += 1; return 0; } });
    const effects = [part('7d1', 'piercing'), part('6d1', 'necrotic')];
    const result = await DamageCommand.forWeaponHit(effects, context).execute(fixture.state);
    expect(requestReaction).toHaveBeenCalledTimes(1);
    expect(result.characters.find(character => character.id === 'ward')?.currentHP).toBe(26);
    expect(result.characters.find(character => character.id === 'protector')?.actionEconomy.reaction).toMatchObject({ used: true, remaining: 0 });
    expect(extractPostHpDamageEvents(result.combatLog)).toHaveLength(1);
    const priorDraws = draws;
    const duplicate = await DamageCommand.forWeaponHit(effects, context).execute(result);
    expect(duplicate).toBe(result);
    expect(draws).toBe(priorDraws);
    expect(requestReaction).toHaveBeenCalledTimes(1);
  });

  it('checks concentration once at the full delivered hit DC', async () => {
    const fixture = actors({ currentHP: 100, maxHP: 100,
      concentratingOn: { spellId: 'bless', spellName: 'Bless', spellLevel: 1,
        startedTurn: 1, effectIds: [], canDropAsFreeAction: true } });
    const context = createMockCommandContext({ caster: fixture.attacker, targets: [fixture.ward], damageRng: () => 0 });
    await DamageCommand.forWeaponHit([part('12d1', 'piercing'), part('14d1', 'necrotic')], context).execute(fixture.state);
    expect(checkConcentration).toHaveBeenCalledTimes(1);
    expect(checkConcentration).toHaveBeenCalledWith(expect.objectContaining({ id: 'ward' }), 26, expect.anything());
  });
});
