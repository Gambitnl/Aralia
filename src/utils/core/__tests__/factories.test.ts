import { createMockSpellSlots } from '@/utils/core/factories';
import { describe, it, expect, vi } from 'vitest';
import {
  createMockSpell,
  createMockCombatCharacter,
  createMockItem,
  createMockQuest,
  createMockLegacyQuest,
  createMockMonster,
  createMockGameMessage,
  createMockGameState
} from '../factories';
import { initialGameState } from '@/state/initialState';
import { isSpell, SpellTargeting } from '@/types/spells';
import { SpellValidator } from '../../../systems/spells/validation/spellValidator';
import { ItemType , QuestStatus } from '@/types/index';


describe('Mimic Factories', () => {
  describe('createMockSpell', () => {
    it('should create a valid Spell object with defaults', () => {
      const spell = createMockSpell();

      expect(isSpell(spell)).toBe(true);
      expect(spell.name).toBe("Mock Spell");
      expect(spell.level).toBe(1);
      expect(spell.effects).toHaveLength(1);
    });

    it('should allow overriding properties', () => {
      const spell = createMockSpell({
        name: "Fireball",
        level: 3,
        range: { type: "ranged", distance: 150 }
      });

      expect(spell.name).toBe("Fireball");
      expect(spell.level).toBe(3);
      expect(spell.range.distance).toBe(150);
      expect(isSpell(spell)).toBe(true);
    });

    it('should handle nested overrides', () => {
      // Overriding targeting
            const spell = createMockSpell({
              targeting: {
                type: "area",
                range: 150,
                areaOfEffect: { shape: "Sphere", size: 20, height: 20 },
          validTargets: ["creatures"],
          // Need to provide full object for valid SpellValidator, or update createMockSpell to merge deeply (it shallow merges)
          // createMockSpell uses ...overrides, so top level keys replace completely.
          // So I need to provide all required fields of 'targeting' if I override it, OR the factory should support deep merge.
          // The current factory implementation is shallow spread: ...overrides.
          // So I must provide a complete targeting object here or the test will fail validation if I check validation.
          // But here we are just checking properties.
          maxTargets: 1,
          lineOfSight: true,
                filter: {
                  creatureTypes: [],
                  excludeCreatureTypes: [],
                  sizes: [],
                  alignments: [],
                  hasCondition: [],
                  isNativeToPlane: false
                }
              } as SpellTargeting
            });

      expect(spell.targeting.type).toBe("area");

      // Type narrowing
      if (spell.targeting.type === 'area') {
         expect(spell.targeting.areaOfEffect.shape).toBe("Sphere");
      } else {
         throw new Error("Targeting type mismatch");
      }
    });

    it('should return a valid spell according to SpellValidator', () => {
      const spell = createMockSpell();
      const result = SpellValidator.safeParse(spell);
      if (!result.success) {
        // console.error(JSON.stringify(result.error, null, 2));
      }
      expect(result.success).toBe(true);
    });

    it('should return a safe fallback spell if an error occurs during creation', () => {
       // Mock safeUuid (internal helper) or uuidv4 to throw
       // Since safeUuid is internal, we can mock uuid from 'uuid' module which is imported
       vi.mock('uuid', () => ({
         v4: () => { throw new Error('UUID Generation Failed'); }
       }));

       // Re-import to apply mock? Vitest mocks are hoisted but we need to reset modules if we want to change behavior mid-suite.
       // However, `safeUuid` catches the error.
       // If `safeUuid` works, then `createMockSpell` continues.
       // To force `createMockSpell` to fail, we need something else to throw inside it,
       // like checking if overrides spread throws (getter)

            const badOverride = {
              // Intentionally throw on access to force fallback path
              get name() { throw new Error('Explosive Getter'); return 'Boom'; }
            } as unknown as Parameters<typeof createMockSpell>[0];

            const spell = createMockSpell(badOverride);

       expect(spell.id).toBe('error-spell');
       expect(spell.name).toBe('Error Spell');
    });
  });

  describe('createMockItem', () => {
    it('creates a default item', () => {
      const item = createMockItem();
      expect(item).toBeDefined();
      expect(item.name).toBe('Mock Item');
      expect(item.type).toBe(ItemType.Treasure);
    });

    it('accepts overrides', () => {
      const item = createMockItem({ name: 'Sword', type: ItemType.Weapon });
      expect(item.name).toBe('Sword');
      expect(item.type).toBe(ItemType.Weapon);
    });
  });

  describe('createMockQuest', () => {
    it('creates a default quest', () => {
      const quest = createMockQuest();
      expect(quest).toBeDefined();
      expect(quest.title).toBe('Mock Quest');
      expect(quest.status).toBe(QuestStatus.Active);
    });

    it('accepts overrides', () => {
      const quest = createMockQuest({ title: 'Save the King', status: QuestStatus.Completed });
      expect(quest.title).toBe('Save the King');
      expect(quest.status).toBe(QuestStatus.Completed);
    });
  });

  // COV-1: `createMockLegacyQuest` is the fixture reducer/handler tests consume.
  // It runs the QuestDefinition through the runtime adapter, so these checks pin
  // the adapted legacy shape (flat objectives, questType, rewards) that
  // questReducer and QuestManager read.
  describe('createMockLegacyQuest', () => {
    it('adapts the definition into a valid legacy Quest', () => {
      const quest = createMockLegacyQuest();
      expect(quest.id).toMatch(/^quest-/);
      expect(quest.title).toBe('Mock Quest');
      expect(quest.status).toBe(QuestStatus.Active);
      expect(quest.questType).toBe('Side');
      // The adapter flattens the active stage into a legacy objective list.
      expect(Array.isArray(quest.objectives)).toBe(true);
      expect(typeof quest.dateStarted).toBe('number');
      // The stage journal entry becomes the runtime description.
      expect(quest.description).toBe('Begin the mock adventure.');
    });

    it('applies definition overrides and then legacy overrides', () => {
      const quest = createMockLegacyQuest(
        { id: 'quest-1', title: 'Courier Run', status: QuestStatus.Completed },
        {
          description: 'Deliver the sealed letter.',
          objectives: [
            { id: 'objective-1', description: 'Carry the letter to the harbor', isCompleted: false }
          ],
          rewards: { gold: 250, xp: 400, items: ['torch'] }
        }
      );
      expect(quest.id).toBe('quest-1');
      expect(quest.title).toBe('Courier Run');
      expect(quest.status).toBe(QuestStatus.Completed);
      expect(quest.description).toBe('Deliver the sealed letter.');
      expect(quest.objectives).toHaveLength(1);
      expect(quest.objectives[0].id).toBe('objective-1');
      expect(quest.rewards?.gold).toBe(250);
    });
  });

  describe('createMockMonster', () => {
    it('creates a default monster', () => {
          const monster = createMockMonster();
          expect(monster).toBeDefined();
          expect(monster.name).toBe('Mock Monster');
          expect(monster.quantity).toBeGreaterThanOrEqual(1);
        });

        it('accepts overrides', () => {
          const monster = createMockMonster({ name: 'Dragon', quantity: 2 });
          expect(monster.name).toBe('Dragon');
          expect(monster.quantity).toBe(2);
        });
      });

  describe('createMockGameMessage', () => {
    it('creates a default message', () => {
      const msg = createMockGameMessage();
      expect(msg).toBeDefined();
      expect(msg.text).toBe('This is a mock message.');
      expect(msg.sender).toBe('system');
    });

        it('accepts overrides', () => {
          const msg = createMockGameMessage({ text: 'Updated!', sender: 'npc' });
          expect(msg.text).toBe('Updated!');
          expect(msg.sender).toBe('npc');
        });
      });

  // ============================================================================
  // createMockCombatCharacter Tests
  // ============================================================================
  // Verifies that mock combatants are created with safe default collections
  // (arrays, maps) and sensible baselines (level 1 humanoid player) so tests
  // don't fail unexpectedly on missing fields. Also tests override handling.
  // ============================================================================
  describe('createMockCombatCharacter', () => {
    // Check that all required standard defaults are properly set
    it('should create a valid CombatCharacter with standard defaults', () => {
      const character = createMockCombatCharacter();

      expect(character).toBeDefined();
      expect(character.id).toMatch(/^combat-char-/);
      expect(character.name).toBe('Mock Combatant');
      expect(character.level).toBe(1);
      expect(character.team).toBe('player');
      expect(character.creatureTypes).toEqual(['Humanoid']);
      expect(character.statusEffects).toEqual([]);
      expect(character.conditions).toEqual([]);
      expect(character.spellSlots).toEqual(createMockSpellSlots());
      expect(character.currentHP).toBe(10);
      expect(character.maxHP).toBe(10);
      expect(character.position).toEqual({ x: 0, y: 0 });
      expect(character.stats.strength).toBe(10);
      expect(character.stats.speed).toBe(30);
      expect(character.actionEconomy.action.remaining).toBe(1);
    });

    // Check top-level property overrides
    it('should allow overriding top-level properties', () => {
      const character = createMockCombatCharacter({
        name: 'Goblin Scout',
        team: 'enemy',
        level: 3,
        creatureTypes: ['Humanoid', 'Goblinoid'],
        spellSlots: createMockSpellSlots({ level_1: { max: 4, current: 2 } }),
      });

      expect(character.name).toBe('Goblin Scout');
      expect(character.team).toBe('enemy');
      expect(character.level).toBe(3);
      expect(character.creatureTypes).toEqual(['Humanoid', 'Goblinoid']);
      expect(character.spellSlots).toEqual(createMockSpellSlots({ level_1: { max: 4, current: 2 } }));
      // Unspecified collections still retain default empty arrays
      expect(character.statusEffects).toEqual([]);
      expect(character.conditions).toEqual([]);
    });

    // Check deep nested object overrides (e.g., partial stats or actionEconomy)
    it('should deeply preserve nested defaults when partial sub-objects are provided', () => {
      const character = createMockCombatCharacter({
        stats: {
          strength: 18,
          dexterity: 14,
        } as any,
        actionEconomy: {
          movement: { used: 15, total: 30 },
        } as any,
      });

      // Overridden stat values are applied
      expect(character.stats.strength).toBe(18);
      expect(character.stats.dexterity).toBe(14);
      // Non-overridden stat defaults are preserved
      expect(character.stats.constitution).toBe(10);
      expect(character.stats.intelligence).toBe(10);
      expect(character.stats.speed).toBe(30);

      // Overridden action economy movement is applied
      expect(character.actionEconomy.movement.used).toBe(15);
      expect(character.actionEconomy.movement.total).toBe(30);
      // Non-overridden action economy structures are preserved
      expect(character.actionEconomy.action.remaining).toBe(1);
      expect(character.actionEconomy.bonusAction.remaining).toBe(1);
      expect(character.actionEconomy.reaction.remaining).toBe(1);
      expect(character.actionEconomy.freeActions).toBe(1);
    });

    // Check fallback behavior if creation throws an error
    it('should return a safe fallback character if an error occurs during creation', () => {
      const badOverride = {
        get name() {
          throw new Error('Explosive Character Getter');
          return 'Boom';
        },
      } as unknown as Parameters<typeof createMockCombatCharacter>[0];

      const character = createMockCombatCharacter(badOverride);

      expect(character.id).toBe('error-combat-char');
      expect(character.name).toBe('Error Combatant');
      expect(character.team).toBe('player');
      expect(character.level).toBe(1);
      expect(character.creatureTypes).toEqual(['Humanoid']);
      expect(character.statusEffects).toEqual([]);
      expect(character.conditions).toEqual([]);
      expect(character.spellSlots).toEqual(createMockSpellSlots());
    });
  });

  describe('createMockGameState parity with initialGameState', () => {
    // Regression guard for factory drift: createMockGameState() must initialize every
    // field that a real fresh state (initialGameState) does, or tests run against a
    // GameState shape the app never produces. See src/state/initialState.ts.
    it('initializes every field present in initialGameState', () => {
      const mock = createMockGameState();
      const missing = Object.keys(initialGameState).filter(
        (key) => !Object.prototype.hasOwnProperty.call(mock, key)
      );

      expect(missing).toEqual([]);
    });
  });
});
