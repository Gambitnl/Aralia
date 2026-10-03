import { describe, it, expect } from 'vitest';
import { generateNPC, NPCGenerationConfig, TownProfile, townRaceId, levelForTownWealth } from '../npcGenerator';
import type { NpcMemory } from '../../types/world';
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
    // `NPC.memory` is the canonical `NpcMemory` (types/world.ts); annotated, not cast,
    // so the compiler checks the shape the assertions below rely on.
    const memory: NpcMemory | undefined = npc.memory;
    expect(memory?.disposition).toBe(50);
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
    // `NPC.memory` is the canonical `NpcMemory` (types/world.ts); annotated, not cast,
    // so the compiler checks the shape the assertions below rely on.
    const memory: NpcMemory | undefined = npc.memory;
    expect(memory?.disposition).toBe(80);
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

  /**
   * Every generated NPC must carry a deterministic BackgroundBrief, and it must
   * reach the dialogue layer (the personality prompt), not just the data model.
   */
  describe('background brief wiring', () => {
    it('gives every generated NPC a background brief', () => {
      for (const role of ['merchant', 'quest_giver', 'guard', 'civilian', 'unique'] as const) {
        const npc = generateNPC({ role });
        const background = npc.biography.background;
        expect(background, role).toBeDefined();
        expect(background.history.length).toBeGreaterThan(20);
        expect(background.motivation.length).toBeGreaterThan(10);
        expect(background.secret.length).toBeGreaterThan(10);
        expect(background.relationshipHook.length).toBeGreaterThan(10);
      }
    });

    it('is deterministic for the same id, world seed, and context', () => {
      const config: NPCGenerationConfig = {
        id: 'npc_test_determinism',
        name: 'Doran Halvek',
        role: 'merchant',
        raceId: 'human',
        gender: 'male',
        worldSeed: 1337,
        biomeId: 'coastal',
        cultureId: 'stoic',
        level: 3,
      };

      const a = generateNPC(config).biography.background;
      const b = generateNPC(config).biography.background;

      // generateNPC is intentionally random per call (age, family tree), and
      // those feed the brief's age band and relationship hook. Everything drawn
      // from the caller's stable context is pinned to the world seed.
      expect(b.seedPath).toBe(a.seedPath);
      expect(b.sourcePackId).toBe('coastal:merchant');
      expect(b.motivation).toBe(a.motivation);
      expect(b.secret).toBe(a.secret);
      // The history's second sentence (the turning point) is seed-driven too;
      // only its age lead follows the generator's randomized age.
      const turningPointOf = (history: string) => history.split(/(?<=\.)\s+/)[1];
      expect(turningPointOf(b.history)).toBe(turningPointOf(a.history));
    });

    it('changes with the world seed', () => {
      const base: NPCGenerationConfig = {
        id: 'npc_test_seed',
        role: 'guard',
        biomeId: 'highland',
        cultureId: 'martial',
        worldSeed: 1,
      };
      const a = generateNPC(base).biography.background;
      const b = generateNPC({ ...base, worldSeed: 2 }).biography.background;
      expect(b.seedPath).not.toBe(a.seedPath);
    });

    it('coerces the free-form biome/culture tags the speech profile also uses', () => {
      const npc = generateNPC({
        id: 'npc_test_coerce',
        role: 'merchant',
        biomeId: 'burg_harbor_district',
        cultureId: 'culture_stoic_highlanders',
        worldSeed: 42,
      });
      expect(npc.biography.background.sourcePackId).toBe('coastal:merchant');
      expect(npc.biography.background.motivation).toContain('will not be the one to bring it up');
    });

    it('falls back to a role pack when there is no usable biome tag', () => {
      const npc = generateNPC({ id: 'npc_test_fallback', role: 'civilian', biomeId: 'zzz_unknown' });
      expect(npc.biography.background.sourcePackId).toBe('role:civilian');
    });

    it('puts the background into the personality prompt so dialogue can use it', () => {
      const npc = generateNPC({ id: 'npc_test_prompt', role: 'merchant', worldSeed: 9 });
      const background = npc.biography.background;
      expect(npc.initialPersonalityPrompt).toContain(background.history);
      expect(npc.initialPersonalityPrompt).toContain(background.motivation);
      expect(npc.initialPersonalityPrompt).toContain(background.secret);
    });

    it('points the relationship hook at a generated family member when one lives', () => {
      const npc = generateNPC({ id: 'npc_test_kin', role: 'guard', raceId: 'human', worldSeed: 5 });
      const living = npc.biography.family.filter(m => m.isAlive);
      if (living.length > 0) {
        const named = living.some(m => npc.biography.background.relationshipHook.includes(m.name));
        expect(named).toBe(true);
      }
    });
  });

  /**
   * agora-13a9.2: merchant generation reads town data. Race comes from the
   * town roster's race mix, level from the town's prosperity meter.
   */
  describe('town-derived race and level', () => {
    const poorTown: TownProfile = { wealth: 10, raceWeights: { Human: 30 }, burgId: 1 };
    const richTown: TownProfile = { wealth: 90, raceWeights: { Human: 30 }, burgId: 1 };

    it('gives a poor and a rich town different merchant level bands', () => {
      const poor = generateNPC({ id: 'npc_shop_1', role: 'merchant', town: poorTown, worldSeed: 11 });
      const rich = generateNPC({ id: 'npc_shop_1', role: 'merchant', town: richTown, worldSeed: 11 });

      expect(poor.biography.level).toBeLessThanOrEqual(2);
      expect(rich.biography.level).toBeGreaterThanOrEqual(6);
      expect(rich.biography.level).toBeGreaterThan(poor.biography.level);
    });

    it('is deterministic for the same town, seed and npc id', () => {
      const a = generateNPC({ id: 'npc_shop_2', role: 'merchant', town: richTown, worldSeed: 3 });
      const b = generateNPC({ id: 'npc_shop_2', role: 'merchant', town: richTown, worldSeed: 3 });
      expect(a.biography.level).toBe(b.biography.level);
    });

    it('draws the merchant race from the town roster weights', () => {
      const dwarfTown: TownProfile = { wealth: 50, raceWeights: { Dwarf: 40 }, burgId: 4 };
      const npc = generateNPC({ id: 'npc_shop_3', role: 'merchant', town: dwarfTown, worldSeed: 7 });
      // The resolved race id is what the portrait prompt is written from.
      expect(npc.visual?.portraitPrompt).toContain('dwarf');
    });

    it('an explicit raceId/level still overrides the town', () => {
      const npc = generateNPC({
        id: 'npc_shop_4',
        role: 'merchant',
        town: richTown,
        raceId: 'elf',
        level: 2,
        worldSeed: 7,
      });
      expect(npc.biography.level).toBe(2);
      expect(npc.visual?.portraitPrompt).toContain('elf');
    });

    it('townRaceId normalizes roster labels to race ids and honours weights', () => {
      const weights = { 'Half-Elf': 9, Human: 1 };
      expect(townRaceId(weights, 0)).toBe('half_elf');
      expect(townRaceId(weights, 0.99)).toBe('human');
      expect(townRaceId({}, 0.5)).toBeUndefined();
    });

    it('levelForTownWealth bands are ordered and clamped', () => {
      expect(levelForTownWealth(0, 0)).toBe(1);
      expect(levelForTownWealth(34, 0.99)).toBe(2);
      expect(levelForTownWealth(50, 0)).toBe(3);
      expect(levelForTownWealth(65, 0.99)).toBe(5);
      expect(levelForTownWealth(100, 0.99)).toBe(9);
    });
  });
  // agora-f821.7: height and weight used to come off a module RNG seeded from
  // Date.now(), through this file's own private dice parser. Both are now
  // contract rolls keyed to (worldSeed, burg, npc id).
  describe('body reproducibility', () => {
    const bodyConfig: NPCGenerationConfig = {
      id: 'npc_body_repro',
      name: 'Ilse Marrow',
      role: 'merchant',
      raceId: 'human',
      gender: 'female',
      worldSeed: 4242,
    };

    const bodyOf = (npc: { visual?: { description?: string } }) =>
      npc.visual?.description?.match(/\(([^)]*lbs)\)/)?.[1];

    it('gives the same npc the same height and weight across runs', () => {
      const a = bodyOf(generateNPC(bodyConfig));
      const b = bodyOf(generateNPC(bodyConfig));
      expect(a).toBeDefined();
      expect(b).toBe(a);
    });

    it('gives a different npc id a different body seed', () => {
      const a = bodyOf(generateNPC(bodyConfig));
      const b = bodyOf(generateNPC({ ...bodyConfig, id: 'npc_body_repro_other' }));
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      // Not a guarantee of inequality for every pair, but these two ids differ.
      expect(b).not.toBe(a);
    });

    it('moves the body when the world seed moves', () => {
      const a = bodyOf(generateNPC(bodyConfig));
      const b = bodyOf(generateNPC({ ...bodyConfig, worldSeed: 9001 }));
      expect(b).not.toBe(a);
    });
  });
});
