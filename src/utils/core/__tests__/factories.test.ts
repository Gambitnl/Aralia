import { describe, it, expect, vi } from 'vitest';
import {
  createMockSpell,
  createMockItem,
  createMockQuest,
  createMockMonster,
  createMockGameMessage
} from '../factories';
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
    });
