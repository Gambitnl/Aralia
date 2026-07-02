
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateCombatTurn } from '../combatAI';
import {
  createMockCombatCharacter,
  // TODO(lint-intent): 'createMockSpell' is unused in this test; use it in the assertion path or remove it.
  createMockSpell as _createMockSpell
} from '../../factories';
import {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  Ability
} from '../../../types/combat';

// Mock logger to suppress output during tests
vi.mock('../../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper to create a simple flat map
function createSimpleMap(width: number, height: number): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const id = `${x}-${y}`;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: 'floor',
        movementCost: 1,
        blocksMovement: false,
        blocksLoS: false,
        elevation: 0,
        decoration: null,
        effects: []
      });
    }
  }
  return {
    dimensions: { width, height },
    tiles,
    theme: 'dungeon',
    seed: 12345
  };
}

describe('combatAI', () => {
  let mapData: BattleMapData;
  let hero: CombatCharacter;
  let enemy: CombatCharacter;
  let basicAttack: Ability;

  beforeEach(() => {
    mapData = createSimpleMap(10, 10);

    // Create a basic attack ability using an object literal that satisfies the Ability interface
    basicAttack = {
      id: 'attack-1',
      name: 'Fire Bolt',
      description: 'Deals 10 damage',
      type: 'attack',
      range: 6, // 30ft / 5 = 6 tiles
      targeting: 'single_enemy',
      cost: { type: 'action' },
      effects: [
        {
          type: 'damage',
          damageType: 'fire',
          value: 10,
          dice: '1d10'
        }
      ],
      // Required Ability fields that might be optional in factory but needed here to satisfy strict type
      icon: 'fire-icon',
      tags: [],
    };
  });

  it('should end turn if no enemies are present', () => {
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 }
    });

    const result = evaluateCombatTurn(hero, [hero], mapData);

    expect(result.type).toBe('end_turn');
  });

  it('should move towards enemy if out of range', () => {
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [basicAttack]
    });

    // Enemy at 9,9 (approx 9 tiles away Chebyshev), Range is 6
    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 9, y: 9 }
    });

    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    expect(result.type).toBe('move');
    // Should move towards 9,9
    expect(result.targetPosition?.x).toBeGreaterThan(0);
    expect(result.targetPosition?.y).toBeGreaterThan(0);
    expect(result.movementPath?.[0]).toEqual(hero.position);
    expect(result.movementPath?.[result.movementPath.length - 1]).toEqual(result.targetPosition);
  });

  it('should not plan movement onto an occupied enemy tile', () => {
    const meleeAttack: Ability = {
      ...basicAttack,
      range: 1
    };
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [meleeAttack]
    });

    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 3, y: 0 }
    });

    // The AI should approach the enemy, but it must choose a legal nearby tile
    // instead of stepping directly onto the enemy's occupied square.
    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    expect(result.type).toBe('move');
    expect(result.targetPosition).not.toEqual(enemy.position);
  });

  it('should attack enemy if in range', () => {
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [basicAttack]
    });

    // Enemy at 0,2 (Distance 2, Range 6)
    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 0, y: 2 }
    });

    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    expect(result.type).toBe('ability');
    expect(result.abilityId).toBe(basicAttack.id);
    expect(result.targetCharacterIds).toContain(enemy.id);
  });

  it('should use top-level creatureTypes when filtering restricted AI targets', () => {
    const humanoidOnlyAttack: Ability = {
      ...basicAttack,
      id: 'hold-person-like-strike',
      name: 'Humanoid Lock',
      validCreatureTypes: ['Humanoid']
    };
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [humanoidOnlyAttack]
    });

    // Player-facing spell targeting reads top-level creatureTypes. The AI must
    // read the same canonical field so a Humanoid-only spell does not skip a
    // legal target just because legacy stats.creatureTypes is absent.
    enemy = createMockCombatCharacter({
      id: 'bandit',
      team: 'enemy',
      position: { x: 0, y: 2 },
      creatureTypes: ['Humanoid'],
      stats: {
        ...createMockCombatCharacter({ id: 'stats-template' }).stats,
        creatureTypes: undefined
      }
    });

    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    expect(result.type).toBe('ability');
    expect(result.abilityId).toBe(humanoidOnlyAttack.id);
    expect(result.targetCharacterIds).toContain(enemy.id);
  });

  it('should use the shared creature-type path for Beast-restricted AI targets', () => {
    const beastOnlyAttack: Ability = {
      ...basicAttack,
      id: 'dominate-beast-like-strike',
      name: 'Beast Lock',
      validCreatureTypes: ['Beast']
    };
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [beastOnlyAttack]
    });

    // Dominate Beast-style targeting uses the same taxonomy path as Humanoid
    // spells. This protects the second restricted family named by the tracker
    // without claiming full enum normalization.
    enemy = createMockCombatCharacter({
      id: 'wolf',
      team: 'enemy',
      position: { x: 0, y: 2 },
      creatureTypes: ['Beast'],
      stats: {
        ...createMockCombatCharacter({ id: 'stats-template' }).stats,
        creatureTypes: undefined
      }
    });

    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    expect(result.type).toBe('ability');
    expect(result.abilityId).toBe(beastOnlyAttack.id);
    expect(result.targetCharacterIds).toContain(enemy.id);
  });

  it('should prioritize killing blow', () => {
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [basicAttack]
    });

    // Enemy 1: Full health
    const enemyFull = createMockCombatCharacter({
      id: 'e1',
      team: 'enemy',
      position: { x: 0, y: 2 },
      currentHP: 20,
      maxHP: 20
    });

    // Enemy 2: 1 HP (Killable)
    const enemyLow = createMockCombatCharacter({
      id: 'e2',
      team: 'enemy',
      position: { x: 2, y: 0 },
      currentHP: 1,
      maxHP: 20
    });

    const result = evaluateCombatTurn(hero, [hero, enemyFull, enemyLow], mapData);

    expect(result.type).toBe('ability');
    expect(result.targetCharacterIds).toContain(enemyLow.id);
  });

  it('should retreat when health is low', () => {
    // Create a hero with a very weak attack so retreat is more attractive
    const weakAttack: Ability = {
      ...basicAttack,
      effects: [{ type: 'damage', value: 1, damageType: 'physical' }]
    };

    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 5, y: 5 },
      currentHP: 2, // 10% HP (Low)
      maxHP: 20,
      abilities: [weakAttack]
    });

    // Actually, force retreat by removing abilities entirely, ensuring "Self Preservation" is the only score source
    hero.abilities = [];

    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 4, y: 5 } // Adjacent
    });

    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    expect(result.type).toBe('move');
    const dist = Math.sqrt(
      Math.pow((result.targetPosition!.x - enemy.position.x), 2) +
      Math.pow((result.targetPosition!.y - enemy.position.y), 2)
    );
    expect(dist).toBeGreaterThan(1);
  });

  it('should use AoE to hit multiple enemies', () => {
    const fireball: Ability = {
      id: 'fireball',
      name: 'Fireball',
      description: 'Boom',
      type: 'spell',
      range: 20,
      targeting: 'area',
      areaShape: 'circle', // Matches Combat type
      areaSize: 2,        // Matches Combat type
      areaOfEffect: { shape: 'circle', size: 2 }, // Explicitly set for AI helper compatibility
      cost: { type: 'action' },
      effects: [{
        type: 'damage',
        value: 20,
        dice: '8d6',
        damageType: 'fire'
      }]
    };

    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [fireball]
    });
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [basicAttack]
    });

    // Enemy at 0,2 (Distance 2, Range 6)
    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 0, y: 2 }
    });

    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    expect(result.type).toBe('ability');
    expect(result.abilityId).toBe(basicAttack.id);
    expect(result.targetCharacterIds).toContain(enemy.id);
  });

  it('should end the turn instead of attacking while under Command: Halt', () => {
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [basicAttack],
      statusEffects: [{
        id: 'command-halt-status',
        name: 'Command: Halt',
        type: 'debuff',
        duration: 1,
        source: 'Command',
        sourceCasterId: 'cleric-command-caster',
        description: 'The target must halt and take no action.',
        effect: { type: 'skip_turn' }
      }]
    });

    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 0, y: 2 }
    });

    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    // Command: Halt is a control directive, not a normal tactical preference.
    // The planner should obey it before scoring attacks or movement.
    expect(result.type).toBe('end_turn');
  });

  it('should stay prone and end the turn instead of attacking while under Command: Grovel', () => {
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [basicAttack],
      statusEffects: [{
        id: 'command-grovel-status',
        name: 'Command: Grovel',
        type: 'debuff',
        duration: 1,
        source: 'Command',
        sourceCasterId: 'cleric-command-caster',
        description: 'The target must grovel and end its turn.',
        effect: { type: 'skip_turn' }
      }]
    });

    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 0, y: 2 }
    });

    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    // Command: Grovel should keep the affected creature from picking a normal
    // attack after it has been forced prone.
    expect(result.type).toBe('end_turn');
  });

  it('should move away from the command caster while under Command: Flee', () => {
    const commandCaster = createMockCombatCharacter({
      id: 'cleric-command-caster',
      team: 'enemy',
      position: { x: 4, y: 5 }
    });
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 5, y: 5 },
      abilities: [basicAttack],
      statusEffects: [{
        id: 'command-flee-status',
        name: 'Command: Flee',
        type: 'debuff',
        duration: 1,
        source: 'Command',
        sourceCasterId: commandCaster.id,
        description: 'The target must move away from the command caster.',
        effect: { type: 'condition' }
      }]
    });

    const result = evaluateCombatTurn(hero, [hero, commandCaster], mapData);

    // Flee is a movement directive tied to the command caster, not a normal AI
    // preference. The chosen move should increase distance from that caster.
    expect(result.type).toBe('move');
    expect(result.targetPosition?.x).toBeGreaterThan(hero.position.x);
    expect(result.movementPath?.[0]).toEqual(hero.position);
  });

  it('should move toward the command caster while under Command: Approach', () => {
    const commandCaster = createMockCombatCharacter({
      id: 'cleric-command-caster',
      team: 'enemy',
      position: { x: 4, y: 5 }
    });
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 8, y: 5 },
      abilities: [basicAttack],
      statusEffects: [{
        id: 'command-approach-status',
        name: 'Command: Approach',
        type: 'debuff',
        duration: 1,
        source: 'Command',
        sourceCasterId: commandCaster.id,
        description: 'The target must move toward the command caster.',
        effect: { type: 'condition' }
      }]
    });

    const result = evaluateCombatTurn(hero, [hero, commandCaster], mapData);

    // Approach is caster-relative and should override a normal in-range attack.
    // The target should spend movement closing distance to the command caster.
    expect(result.type).toBe('move');
    expect(result.targetPosition?.x).toBeLessThan(hero.position.x);
    expect(result.movementPath?.[0]).toEqual(hero.position);
  });

  it('should end the turn instead of attacking while under Command: Drop', () => {
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [basicAttack],
      statusEffects: [{
        id: 'command-drop-status',
        name: 'Command: Drop',
        type: 'debuff',
        duration: 1,
        source: 'Command',
        sourceCasterId: 'cleric-command-caster',
        description: 'The target must drop what it is holding and end its turn.',
        effect: { type: 'skip_turn' }
      }]
    });

    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 0, y: 2 }
    });

    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    // Drop should consume the commanded turn just like Halt/Grovel. Held-item
    // mutation is still separate; this proves AI obedience.
    expect(result.type).toBe('end_turn');
  });

  it('should make an uncontrolled Summon Greater Demon target the nearest non-demon', () => {
    const uncontrolledDemon = createMockCombatCharacter({
      id: 'greater-demon',
      name: 'Summoned Barlgura',
      team: 'enemy',
      position: { x: 0, y: 0 },
      abilities: [basicAttack],
      isSummon: true,
      creatureTypes: ['Fiend', 'Demon'],
      summonMetadata: {
        casterId: 'wizard-caster',
        spellId: 'summon-greater-demon',
        entityType: 'chosen_demon',
        sourceName: 'Summon Greater Demon',
        control: {
          entityType: 'chosen_demon',
          allegiance: 'uncontrolled_hostile',
          obedience: 'pursues_and_attacks_nearest_non_demons'
        }
      }
    });
    const caster = createMockCombatCharacter({
      id: 'wizard-caster',
      team: 'player',
      position: { x: 0, y: 2 },
      currentHP: 20
    });
    const otherDemon = createMockCombatCharacter({
      id: 'other-demon',
      team: 'enemy',
      position: { x: 0, y: 1 },
      currentHP: 20,
      creatureTypes: ['Demon']
    });

    const result = evaluateCombatTurn(uncontrolledDemon, [uncontrolledDemon, caster, otherDemon], mapData);

    // After control breaks, team allegiance no longer makes the caster safe,
    // and other demons are not valid targets for this spell behavior.
    expect(result.type).toBe('ability');
    expect(result.targetCharacterIds).toEqual([caster.id]);
  });

  it('should prioritize killing blow', () => {
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [basicAttack]
    });

    // Enemy 1: Full health
    const enemyFull = createMockCombatCharacter({
      id: 'e1',
      team: 'enemy',
      position: { x: 0, y: 2 },
      currentHP: 20,
      maxHP: 20
    });

    // Enemy 2: 1 HP (Killable)
    const enemyLow = createMockCombatCharacter({
      id: 'e2',
      team: 'enemy',
      position: { x: 2, y: 0 },
      currentHP: 1,
      maxHP: 20
    });

    const result = evaluateCombatTurn(hero, [hero, enemyFull, enemyLow], mapData);

    expect(result.type).toBe('ability');
    expect(result.targetCharacterIds).toContain(enemyLow.id);
  });

  it('should retreat when health is low', () => {
    // Create a hero with a very weak attack so retreat is more attractive
    const weakAttack: Ability = {
      ...basicAttack,
      effects: [{ type: 'damage', value: 1, damageType: 'physical' }]
    };

    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 5, y: 5 },
      currentHP: 2, // 10% HP (Low)
      maxHP: 20,
      abilities: [weakAttack]
    });

    // Actually, force retreat by removing abilities entirely, ensuring "Self Preservation" is the only score source
    hero.abilities = [];

    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 4, y: 5 } // Adjacent
    });

    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    expect(result.type).toBe('move');
    const dist = Math.sqrt(
      Math.pow((result.targetPosition!.x - enemy.position.x), 2) +
      Math.pow((result.targetPosition!.y - enemy.position.y), 2)
    );
    expect(dist).toBeGreaterThan(1);
  });

  it('should use AoE to hit multiple enemies', () => {
    const fireball: Ability = {
      id: 'fireball',
      name: 'Fireball',
      description: 'Boom',
      type: 'spell',
      range: 20,
      targeting: 'area',
      areaShape: 'circle', // Matches Combat type
      areaSize: 2,        // Matches Combat type
      areaOfEffect: { shape: 'circle', size: 2 }, // Explicitly set for AI helper compatibility
      cost: { type: 'action' },
      effects: [{
        type: 'damage',
        value: 20,
        dice: '8d6',
        damageType: 'fire'
      }]
    };

    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [fireball]
    });

    // Cluster of enemies
    const e1 = createMockCombatCharacter({ id: 'e1', team: 'enemy', position: { x: 5, y: 5 } });
    const e2 = createMockCombatCharacter({ id: 'e2', team: 'enemy', position: { x: 6, y: 5 } });

    const result = evaluateCombatTurn(hero, [hero, e1, e2], mapData);

    expect(result.type).toBe('ability');
    expect(result.abilityId).toBe('fireball');
    expect(result.targetCharacterIds).toContain(e1.id);
    expect(result.targetCharacterIds).toContain(e2.id);
  });

  // ----------------------------------------------------
  // DOWNED CHARACTER & HEALING AI HEURISTICS TESTS
  // ----------------------------------------------------

  it('should prioritize reviving/healing downed allies over slightly damaged allies', () => {
    const cureWounds: Ability = {
      id: 'cure-wounds',
      name: 'Cure Wounds',
      description: 'Heals 10 HP',
      type: 'spell',
      range: 6,
      targeting: 'single_ally',
      cost: { type: 'action' },
      effects: [{
        type: 'heal',
        value: 10
      }],
      icon: 'heal-icon',
      tags: [],
    };

    // Hero (Caster ally)
    hero = createMockCombatCharacter({
      id: 'cleric',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [cureWounds]
    });

    // Slightly damaged active ally (HP 15/20)
    const slightlyDamagedAlly = createMockCombatCharacter({
      id: 'fighter',
      team: 'player',
      position: { x: 0, y: 2 },
      currentHP: 15,
      maxHP: 20
    });

    // Downed dying ally (HP 0, deathSaves defined)
    const downedAlly = createMockCombatCharacter({
      id: 'rogue',
      team: 'player',
      position: { x: 2, y: 0 },
      currentHP: 0,
      maxHP: 20,
      deathSaves: { successes: 0, failures: 0, isStable: false }
    });

    // Active enemy so combat is valid and evaluates single-ally healing options
    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 5, y: 5 }
    });

    const result = evaluateCombatTurn(hero, [hero, slightlyDamagedAlly, downedAlly, enemy], mapData);

    expect(result.type).toBe('ability');
    expect(result.abilityId).toBe('cure-wounds');
    // Cleric must prioritize reviving the downed Rogue over healing the Fighter
    expect(result.targetCharacterIds).toContain(downedAlly.id);
  });

  it('should ignore downed player characters and attack active player threats', () => {
    // Enemy with basic bolt attack
    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 5, y: 5 },
      abilities: [basicAttack]
    });

    // Downed player character (unconscious, not active threat)
    const downedPlayer = createMockCombatCharacter({
      id: 'rogue',
      team: 'player',
      position: { x: 4, y: 5 }, // Adjacent to goblin
      currentHP: 0,
      maxHP: 20,
      deathSaves: { successes: 0, failures: 0, isStable: false }
    });

    // Active player character (active threat)
    const activePlayer = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 5, y: 2 }, // 3 cells away, within range
      currentHP: 20,
      maxHP: 20
    });

    const result = evaluateCombatTurn(enemy, [enemy, downedPlayer, activePlayer], mapData);

    expect(result.type).toBe('ability');
    // Goblin must target the active threat, not waste its action executing the downed player
    expect(result.targetCharacterIds).toContain(activePlayer.id);
  });

  it('should treat downed characters as blocking grid tiles', () => {
    // Hero with 1-range melee attack
    const meleeAttack: Ability = {
      ...basicAttack,
      range: 1
    };

    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [meleeAttack]
    });

    // Downed player character lying in cell (2, 0)
    const downedPlayer = createMockCombatCharacter({
      id: 'rogue',
      team: 'player',
      position: { x: 2, y: 0 },
      currentHP: 0,
      maxHP: 20,
      deathSaves: { successes: 0, failures: 0, isStable: false }
    });

    // Active enemy at (3, 0)
    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 3, y: 0 }
    });

    const result = evaluateCombatTurn(hero, [hero, downedPlayer, enemy], mapData);

    expect(result.type).toBe('move');
    // The hero wants to approach the goblin at (3, 0), but cannot move to (2, 0) because the downed Rogue blocks it!
    expect(result.targetPosition).not.toEqual({ x: 2, y: 0 });
  });
});
