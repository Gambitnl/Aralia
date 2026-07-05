import { describe, expect, it } from 'vitest';
import { appReducer } from '../appState';
import { GamePhase } from '../../types';
import { createMockGameState } from '../../utils/core/factories';
import type { PlayerCharacter } from '../../types/character';

/**
 * WS2 — Fights that stick: combat runs on transient CombatCharacter copies, so
 * before this change HP/spell-slots/ability-uses spent in a battle silently reset
 * the moment it ended. END_BATTLE now carries a finalPartyState snapshot that maps
 * each survivor's post-combat resources back onto the persistent party member.
 */

function partyMember(overrides: Partial<PlayerCharacter> = {}): PlayerCharacter {
  return {
    id: 'pc1',
    name: 'Hero',
    level: 1,
    xp: 0,
    hp: 12,
    maxHp: 12,
    race: {} as PlayerCharacter['race'],
    class: { id: 'fighter' } as PlayerCharacter['class'],
    finalAbilityScores: { Strength: 14, Dexterity: 12, Constitution: 14, Intelligence: 10, Wisdom: 10, Charisma: 10 },
    equippedItems: {},
    spellSlots: { level_1: { current: 2, max: 2 } } as unknown as PlayerCharacter['spellSlots'],
    ...overrides,
  } as PlayerCharacter;
}

const stateWithParty = (party: PlayerCharacter[]) =>
  createMockGameState({ phase: GamePhase.COMBAT, party });

describe('END_BATTLE combat attrition persistence', () => {
  it('persists post-combat HP back to the party member', () => {
    const next = appReducer(stateWithParty([partyMember()]), {
      type: 'END_BATTLE',
      payload: { rewards: { gold: 0, items: [], xp: 0 }, finalPartyState: [{ id: 'pc1', currentHP: 5 }] },
    });
    expect(next.party[0].hp).toBe(5);
  });

  it('stabilizes a downed survivor to 1 HP rather than leaving them at 0', () => {
    const next = appReducer(stateWithParty([partyMember()]), {
      type: 'END_BATTLE',
      payload: { rewards: { gold: 0, items: [], xp: 0 }, finalPartyState: [{ id: 'pc1', currentHP: 0 }] },
    });
    expect(next.party[0].hp).toBe(1);
  });

  it('persists spent spell slots and limited uses', () => {
    const next = appReducer(stateWithParty([partyMember()]), {
      type: 'END_BATTLE',
      payload: {
        rewards: { gold: 0, items: [], xp: 0 },
        finalPartyState: [{
          id: 'pc1',
          currentHP: 8,
          spellSlots: { level_1: { current: 0, max: 2 } } as unknown as PlayerCharacter['spellSlots'],
          limitedUses: { second_wind: { current: 0, max: 1 } } as unknown as PlayerCharacter['limitedUses'],
        }],
      },
    });
    expect((next.party[0].spellSlots as Record<string, { current: number }>).level_1.current).toBe(0);
    expect((next.party[0].limitedUses as Record<string, { current: number }>).second_wind.current).toBe(0);
  });

  it('leaves a party member without a snapshot untouched', () => {
    const next = appReducer(
      stateWithParty([partyMember({ id: 'pc1' }), partyMember({ id: 'pc2', hp: 10, maxHp: 10 })]),
      {
        type: 'END_BATTLE',
        payload: { rewards: { gold: 0, items: [], xp: 0 }, finalPartyState: [{ id: 'pc1', currentHP: 3 }] },
      },
    );
    expect(next.party.find(p => p.id === 'pc1')?.hp).toBe(3);
    expect(next.party.find(p => p.id === 'pc2')?.hp).toBe(10);
  });

  it('does not let persisted HP exceed the member\'s maxHp', () => {
    const next = appReducer(stateWithParty([partyMember({ hp: 12, maxHp: 12 })]), {
      type: 'END_BATTLE',
      payload: { rewards: { gold: 0, items: [], xp: 0 }, finalPartyState: [{ id: 'pc1', currentHP: 999 }] },
    });
    expect(next.party[0].hp).toBe(12);
  });
});
