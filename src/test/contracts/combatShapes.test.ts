import { describe, it, expect, expectTypeOf } from 'vitest';
import { BattleMapTile, BattleMapData, CombatCharacter, ActionEconomyState } from '@/types/combat';

describe('contract: combat shapes', () => {
  it('BattleMapTile has required navigation fields', () => {
    const tile: BattleMapTile = {
      id: '0-0',
      coordinates: { x: 0, y: 0 },
      terrain: 'floor',
      elevation: 0,
      movementCost: 1,
      blocksLoS: false,
      blocksMovement: false,
      decoration: null,
      effects: [],
    };
    expect(tile.id).toBe('0-0');
    expectTypeOf(tile).toMatchTypeOf<BattleMapTile>();
  });

  it('BattleMapData carries theme/seed and tile map', () => {
    const map: BattleMapData = {
      dimensions: { width: 1, height: 1 },
      tiles: new Map<string, BattleMapTile>(),
      theme: 'forest',
      seed: 1,
    };
    expect(map.tiles instanceof Map).toBe(true);
    expectTypeOf(map).toMatchTypeOf<BattleMapData>();
  });

  it('CombatCharacter tracks action economy counters', () => {
    const economy: ActionEconomyState = {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      movement: { used: 0, total: 30 },
      freeActions: 1,
    };

    const combatant: CombatCharacter = {
      id: 'contract-char',
      name: 'Contractor',
      level: 1,
      team: 'player',
      currentHP: 1,
      maxHP: 1,
      initiative: 0,
      position: { x: 0, y: 0 },
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        baseInitiative: 0,
        speed: 30,
        cr: '0',
      },
      abilities: [],
      actionEconomy: economy,
      statusEffects: [],
      class: {
        id: 'fighter',
        name: 'Fighter',
        description: '',
        hitDie: 10,
        primaryAbility: ['Strength'],
        savingThrowProficiencies: [],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 0,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: [],
      },
    };

    expectTypeOf(combatant.actionEconomy).toMatchTypeOf<ActionEconomyState>();
    expect(combatant.actionEconomy.movement.total).toBeGreaterThan(0);
  });
});
