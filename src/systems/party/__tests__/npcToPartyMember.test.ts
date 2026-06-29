/**
 * Unit tests for the NPC → party-member converter (Packet P4).
 *
 * Validates that:
 *   - npcToPartyMember turns a RichNPC into a { character, companion, source }
 *     payload whose two halves SHARE one id (the PartyPane join invariant).
 *   - The character half adopts the NPC's real ability scores / stats / id and
 *     lands the biography in the documented `richNpcData` slot.
 *   - The companion half seeds `relationships.player` (stranger / approval 0),
 *     loyalty derived from disposition, and `inParty: true`.
 *   - promoteCompanionToMember keeps the authored Companion (inParty:true) and
 *     synthesizes a PlayerCharacter sharing its id.
 *
 * Runs on: vitest.
 * Depends on: real building blocks generateNPC + createMockCompanion (imported,
 * not mocked) so the converter is exercised against genuine fixtures.
 */

import { describe, it, expect } from 'vitest';
import type { RichNPC } from '../../../types/world';
import type { Companion } from '../../../types/companions';
import { generateNPC } from '../../../services/npcGenerator';
import { createMockCompanion } from '../../../utils/character/companionFactories';
import { npcToPartyMember, promoteCompanionToMember } from '../npcToPartyMember';
import { isInParty } from '../recruitTypes';

/** Build a deterministic-id RichNPC via the real generator. */
function makeRichNpc(overrides?: Partial<Parameters<typeof generateNPC>[0]>): RichNPC {
  return generateNPC({
    id: 'npc-test-1',
    name: 'Test Recruit',
    role: 'civilian',
    classId: 'fighter',
    level: 3,
    backgroundId: 'soldier',
    initialDisposition: 70,
    ...overrides,
  });
}

describe('npcToPartyMember', () => {
  it('produces a payload whose character and companion share one id', () => {
    const npc = makeRichNpc();
    const payload = npcToPartyMember(npc);

    expect(payload.character.id).toBe(npc.id);
    expect(payload.companion.id).toBe(npc.id);
    expect(payload.character.id).toBe(payload.companion.id);
  });

  it('defaults the source to dialogue and honours an explicit source', () => {
    const npc = makeRichNpc();
    expect(npcToPartyMember(npc).source).toBe('dialogue');
    expect(npcToPartyMember(npc, 'tavern').source).toBe('tavern');
    expect(npcToPartyMember(npc, 'rescue').source).toBe('rescue');
  });

  describe('character half', () => {
    it('carries the NPC name, level and class id', () => {
      const npc = makeRichNpc();
      const { character } = npcToPartyMember(npc);
      expect(character.name).toBe('Test Recruit');
      expect(character.level).toBe(3);
      expect(character.class.id).toBe('fighter');
    });

    it('adopts the NPC ability scores rather than the temp 10/10/10 base', () => {
      const npc = makeRichNpc();
      const { character } = npcToPartyMember(npc);
      expect(character.abilityScores).toEqual(npc.biography.abilityScores);
      expect(character.finalAbilityScores).toEqual(npc.biography.abilityScores);
    });

    it('adopts the NPC derived combat stats', () => {
      const npc = makeRichNpc();
      const { character } = npcToPartyMember(npc);
      expect(character.hp).toBe(npc.stats.hp);
      expect(character.maxHp).toBe(npc.stats.maxHp);
      expect(character.armorClass).toBe(npc.stats.armorClass);
      expect(character.speed).toBe(npc.stats.speed);
      expect(character.proficiencyBonus).toBe(npc.stats.proficiencyBonus);
    });

    it('lands the biography in the richNpcData slot', () => {
      const npc = makeRichNpc();
      const { character } = npcToPartyMember(npc);
      expect(character.richNpcData).toBeDefined();
      expect(character.richNpcData?.age).toBe(npc.biography.age);
      expect(character.richNpcData?.family).toEqual(npc.biography.family);
      expect(character.richNpcData?.backgroundId).toBe(npc.biography.backgroundId);
    });
  });

  describe('companion half', () => {
    it('seeds a fresh stranger / approval-0 relationship with the player', () => {
      const npc = makeRichNpc();
      const { companion } = npcToPartyMember(npc);
      const rel = companion.relationships.player;
      expect(rel).toBeDefined();
      expect(rel.targetId).toBe('player');
      expect(rel.level).toBe('stranger');
      expect(rel.approval).toBe(0);
    });

    it('marks the companion as in the party', () => {
      const npc = makeRichNpc();
      const { companion } = npcToPartyMember(npc);
      expect(companion.inParty).toBe(true);
      expect(isInParty(companion)).toBe(true);
    });

    it('derives loyalty from the NPC disposition (clamped 0–100)', () => {
      const friendly = npcToPartyMember(makeRichNpc({ initialDisposition: 70 }));
      expect(friendly.companion.loyalty).toBe(70);

      const hostile = npcToPartyMember(makeRichNpc({ initialDisposition: 5 }));
      expect(hostile.companion.loyalty).toBe(5);

      const overcap = npcToPartyMember(makeRichNpc({ initialDisposition: 999 }));
      expect(overcap.companion.loyalty).toBe(100);
    });

    it('carries the NPC identity onto the companion', () => {
      const npc = makeRichNpc();
      const { companion } = npcToPartyMember(npc);
      expect(companion.identity.id).toBe(npc.id);
      expect(companion.identity.name).toBe('Test Recruit');
      expect(companion.identity.age).toBe(npc.biography.age);
      expect(companion.identity.background).toBe(npc.biography.backgroundId);
    });
  });
});

describe('promoteCompanionToMember', () => {
  const makeAuthored = (overrides?: Partial<Companion>): Companion =>
    createMockCompanion({
      id: 'kaelen_thorne',
      identity: {
        id: 'kaelen_thorne',
        name: 'Kaelen Thorne',
        race: 'Human',
        class: 'Rogue',
        background: 'criminal',
        sex: 'Male',
        age: 32,
        physicalDescription: 'A wiry drifter with quick hands.',
      },
      loyalty: 50,
      relationships: {
        player: {
          targetId: 'player',
          level: 'acquaintance',
          approval: 120,
          history: [],
          unlocks: [],
        },
      },
      ...overrides,
    });

  it('keeps the authored companion and shares its id with the character', () => {
    const companion = makeAuthored();
    const payload = promoteCompanionToMember(companion);
    expect(payload.character.id).toBe(companion.id);
    expect(payload.companion.id).toBe(companion.id);
    expect(payload.source).toBe('promote');
  });

  it('preserves the existing relationship history (does not reset it)', () => {
    const companion = makeAuthored();
    const { companion: promoted } = promoteCompanionToMember(companion);
    expect(promoted.relationships.player.level).toBe('acquaintance');
    expect(promoted.relationships.player.approval).toBe(120);
    expect(promoted.loyalty).toBe(50);
  });

  it('marks the promoted companion as in the party', () => {
    const companion = makeAuthored();
    const { companion: promoted } = promoteCompanionToMember(companion);
    expect(promoted.inParty).toBe(true);
    expect(isInParty(promoted)).toBe(true);
  });

  it('synthesizes a character from identity with the given class and level', () => {
    const companion = makeAuthored();
    const { character } = promoteCompanionToMember(companion, 'rogue', 4);
    expect(character.name).toBe('Kaelen Thorne');
    expect(character.class.id).toBe('rogue');
    expect(character.level).toBe(4);
    expect(character.richNpcData?.physicalDescription).toBe(
      'A wiry drifter with quick hands.',
    );
  });

  it('defaults to fighter / level 1 when class and level are omitted', () => {
    const companion = makeAuthored();
    const { character } = promoteCompanionToMember(companion);
    expect(character.class.id).toBe('fighter');
    expect(character.level).toBe(1);
  });
});
