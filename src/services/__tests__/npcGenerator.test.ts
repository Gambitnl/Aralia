import { describe, it, expect } from 'vitest';
import { generateNPC, NPCGenerationConfig } from '../npcGenerator';
import { NPC } from '../../types/world';
import { RACE_NAMES } from '../../data/names/raceNames';

/**
 * Unit tests for the NPC Generator service.
 * Verifies that the generator produces valid data structures, respects configuration overrides,
 * and correctly implements logic for race, class, level scaling, and family trees.
 */
describe('NPC Generator', () => {
  
  /**
   * Test the most basic usage: generating an NPC with only a role.
   * Ensures essential fields like ID, name, role, memory, and disposition are populated.
   */
  it('should generate a valid NPC with minimal config', () => {
    const config: NPCGenerationConfig = {
      role: 'guard'
    };

    const npc = generateNPC(config);

    expect(npc).toBeDefined();
    expect(npc.id).toBeDefined();
    expect(npc.name).toBeDefined();
    expect(npc.role).toBe('guard');
    expect(npc.initialPersonalityPrompt).toContain('guard');
    expect(npc.memory).toBeDefined();
    expect(npc.memory?.disposition).toBe(50);
  });

  /**
   * Verifies that manual overrides in the config (name, faction, disposition)
   * take precedence over generated values.
   */
  it('should respect overrides', () => {
    const config: NPCGenerationConfig = {
      role: 'merchant',
      name: 'Test Merchant',
      initialDisposition: 80,
      faction: 'Merchants Guild'
    };

    const npc = generateNPC(config);

    expect(npc.name).toBe('Test Merchant');
    expect(npc.memory?.disposition).toBe(80);
    expect(npc.faction).toBe('Merchants Guild');
    expect(npc.role).toBe('merchant');
  });

  /**
   * Checks if specific roles (like merchant) trigger the creation of
   * role-appropriate default goals (e.g. 'make_profit').
   */
  it('should assign goals based on role', () => {
     const config: NPCGenerationConfig = {
      role: 'merchant'
    };
    const npc = generateNPC(config);
    expect(npc.goals).toBeDefined();
    expect(npc.goals!.length).toBeGreaterThan(0);
    expect(npc.goals![0].id).toBe('make_profit');
  });

  /**
   * Verifies that race selection influences the name generation logic.
   * Checks generated names against the Dwarf name list as a sample case.
   */
  it('should generate race-specific names', () => {
    const config: NPCGenerationConfig = {
      role: 'civilian',
      raceId: 'dwarf'
    };
    const npc = generateNPC(config);
    const firstName = npc.name.split(' ')[0];
    const lastName = npc.name.split(' ')[1];

    const isDwarfName = RACE_NAMES.dwarf.male.includes(firstName) || RACE_NAMES.dwarf.female.includes(firstName);
    const isDwarfSurname = RACE_NAMES.dwarf.surnames.includes(lastName);

    // Note: There's a tiny chance of collision if names overlap between lists, but with current data it's safe.
    // Or we just check that the name comes from one of the lists.
    expect(isDwarfName).toBe(true);
    expect(isDwarfSurname).toBe(true);
  });

  /**
   * Checks if the 'occupation' field correctly modifies the descriptive text
   * and AI personality prompt, distinguishing it from the mechanical 'role'.
   */
  it('should include occupation in description and personality', () => {
    const config: NPCGenerationConfig = {
      role: 'merchant',
      occupation: 'Blacksmith'
    };
    const npc = generateNPC(config);

    expect(npc.baseDescription).toContain('Blacksmith');
    expect(npc.initialPersonalityPrompt).toContain('Blacksmith');
  });

  /**
   * Validates the inclusion of generated physical traits (Height, Weight, Hair, Eyes)
   * in the description string.
   */
  it('should generate detailed physical descriptions', () => {
    const config: NPCGenerationConfig = {
      role: 'civilian',
      raceId: 'human'
    };
    const npc = generateNPC(config);
    
    // Check for physical attributes in the description
    expect(npc.baseDescription).toMatch(/\d+'\d+"/); // Height format like 5'8"
    expect(npc.baseDescription).toMatch(/\d+ lbs/); // Weight
    expect(npc.baseDescription).toMatch(/hair/);
    expect(npc.baseDescription).toMatch(/eyes/);
  });

  /**
   * Verifies the generation of the Biography and Family Tree.
   * Ensures age is appropriate for the race (Elf > 100) and that family members
   * are created with valid relations and ages.
   */
  it('should generate biography and family tree', () => {
     const config: NPCGenerationConfig = {
      role: 'unique',
      raceId: 'elf', // Elves live long, good for testing family
      level: 5,
      classId: 'wizard'
    };
    const npc = generateNPC(config);

    expect(npc.biography).toBeDefined();
    expect(npc.biography.age).toBeGreaterThan(100); // Elf maturity
    expect(npc.biography.classId).toBe('wizard');
    expect(npc.biography.level).toBe(5);
    expect(npc.biography.backgroundId).toBeDefined();
    expect(npc.biography.family).toBeDefined();
    expect(Array.isArray(npc.biography.family)).toBe(true);
    
    // Check for parents
    const parents = npc.biography.family.filter(m => m.relation === 'parent');
    expect(parents.length).toBeGreaterThan(0);
    expect(parents[0].age).toBeGreaterThan(npc.biography.age);
  });

  /**
   * Checks that ability scores are optimized for the requested class.
   * Example: Barbarians should have high Strength and Constitution.
   */
  it('should generate class-appropriate ability scores', () => {
    const config: NPCGenerationConfig = {
      role: 'guard',
      classId: 'barbarian'
    };
    const npc = generateNPC(config);

    expect(npc.biography.abilityScores).toBeDefined();
    // Barbarians prioritize Strength and Constitution
    expect(npc.biography.abilityScores.Strength).toBeGreaterThanOrEqual(14);
    expect(npc.biography.abilityScores.Constitution).toBeGreaterThanOrEqual(12);
    // Intelligence is usually lower priority
    expect(npc.biography.abilityScores.Intelligence).toBeLessThan(14);
  });

  /**
   * Verifies the calculation of derived stats like HP, AC, Speed, and Proficiency.
   * Ensures they align with D&D 5e formulas based on level and stats.
   */
  it('should calculate derived stats (HP, AC, Speed)', () => {
    const config: NPCGenerationConfig = {
      role: 'guard',
      classId: 'fighter',
      level: 1,
      raceId: 'human'
    };
    const npc = generateNPC(config);

    expect(npc.stats).toBeDefined();
    // Fighter L1 HP: 10 + Con Mod. Con is likely 12-14 (+1 or +2) -> 11 or 12.
    expect(npc.stats.hp).toBeGreaterThan(10);
    expect(npc.stats.maxHp).toBe(npc.stats.hp);
    
    // AC: 10 + Dex. Dex is likely 12-14 (+1 or +2) -> 11 or 12. 
    // (Note: Default generation doesn't equip armor yet, so it's unarmored)
    expect(npc.stats.armorClass).toBeGreaterThanOrEqual(10);
    
    expect(npc.stats.speed).toBe(30); // Human speed
    expect(npc.stats.proficiencyBonus).toBe(2); // Level 1
  });

  /**
   * Tests the equipment generation logic.
   * Ensures that high-level characters receive better gear (e.g. Plate Armor)
   * and class-appropriate weapons.
   */
  it('should generate class and level appropriate equipment', () => {
    // High level fighter should have better armor (AC)
    const config: NPCGenerationConfig = {
      role: 'guard',
      classId: 'fighter',
      level: 10,
      raceId: 'human'
    };
    const npc = generateNPC(config);

    expect(npc.equippedItems).toBeDefined();
    expect(npc.equippedItems?.Torso).toBeDefined();
    // Level 10 Fighter -> Plate Armor (AC 18)
    expect(npc.stats.armorClass).toBeGreaterThanOrEqual(18); 
    expect(npc.equippedItems?.Torso?.name).toBe('Plate Armor');
    
    // Weapon check
    expect(npc.equippedItems?.MainHand).toBeDefined();
  });
});