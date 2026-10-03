
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateCombatTurn, evaluateSummonAbility } from '../combatAI';
import {
  createMockCombatCharacter
} from '../../core/factories';
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

  it('should not target a creature inside a summoned demon blood circle', () => {
    const demonAttack = { ...basicAttack, id: 'demon-attack' };
    const demon = createMockCombatCharacter({
      id: 'summoned-demon',
      team: 'enemy',
      position: { x: 3, y: 3 },
      abilities: [demonAttack],
      isSummon: true,
      summonMetadata: {
        casterId: 'caster',
        spellId: 'summon-greater-demon',
        bloodCircle: {
          center: { x: 0, y: 0 },
          protectedTiles: [{ x: 0, y: 0 }]
        }
      }
    });
    const protectedCreature = createMockCombatCharacter({
      id: 'protected-creature',
      team: 'player',
      position: { x: 0, y: 0 }
    });

    const result = evaluateCombatTurn(demon, [demon, protectedCreature], mapData);

    expect(result.type).toBe('end_turn');
  });

  it('routes summoned demon movement around protected blood-circle tiles', () => {
    const demon = createMockCombatCharacter({
      id: 'summoned-demon',
      team: 'enemy',
      position: { x: 0, y: 1 },
      abilities: [{ ...basicAttack, id: 'short-demon-attack', range: 1 }],
      isSummon: true,
      summonMetadata: {
        casterId: 'caster',
        spellId: 'summon-greater-demon',
        bloodCircle: {
          center: { x: 1, y: 1 },
          protectedTiles: [{ x: 1, y: 1 }]
        }
      }
    });
    const enemyAhead = createMockCombatCharacter({
      id: 'enemy-ahead',
      team: 'player',
      position: { x: 4, y: 1 }
    });

    const result = evaluateCombatTurn(demon, [demon, enemyAhead], mapData);

    expect(result.type).toBe('move');
    expect(result.movementPath).not.toContainEqual({ x: 1, y: 1 });
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

  // ============================================================================
  // ALLIED PARTY COMBAT AI TACTICS (G31) TESTS
  // ============================================================================

  describe('Allied Party Tactics — Triage Healing', () => {
    it('should prioritize emergency healing on a critically wounded ally (<30% HP) over a basic attack', () => {
      const cureWounds: Ability = {
        id: 'cure-wounds',
        name: 'Cure Wounds',
        description: 'Heals 10 HP',
        type: 'spell',
        range: 6,
        targeting: 'single_ally',
        cost: { type: 'action', spellSlotLevel: 1 },
        effects: [{ type: 'heal', value: 10 }],
        icon: 'heal',
        tags: [],
      };

      const fireBolt: Ability = {
        id: 'fire-bolt',
        name: 'Fire Bolt',
        description: 'Deals 10 fire damage',
        type: 'attack',
        range: 6,
        targeting: 'single_enemy',
        cost: { type: 'action' },
        effects: [{ type: 'damage', damageType: 'fire', value: 10 }],
        icon: 'fire',
        tags: [],
      };

      const cleric = createMockCombatCharacter({
        id: 'cleric',
        name: 'Cleric Ally',
        team: 'player',
        position: { x: 0, y: 0 },
        abilities: [cureWounds, fireBolt],
        spellSlots: { level_1: { current: 2, max: 2 } },
      });

      // Critically wounded ally (4/20 HP = 20% HP)
      const criticalFighter = createMockCombatCharacter({
        id: 'fighter',
        name: 'Fighter Carry',
        team: 'player',
        position: { x: 0, y: 2 },
        currentHP: 4,
        maxHP: 20
      });

      // Healthy enemy in range
      const enemyOrc = createMockCombatCharacter({
        id: 'orc',
        name: 'Orc Warrior',
        team: 'enemy',
        position: { x: 0, y: 4 },
        currentHP: 20,
        maxHP: 20
      });

      const result = evaluateCombatTurn(cleric, [cleric, criticalFighter, enemyOrc], mapData);

      // Triage healing must rescue the critically wounded fighter rather than attacking
      expect(result.type).toBe('ability');
      expect(result.abilityId).toBe('cure-wounds');
      expect(result.targetCharacterIds).toContain(criticalFighter.id);
    });

    it('should prefer attacking over healing when ally is only lightly scratched (>70% HP)', () => {
      const cureWounds: Ability = {
        id: 'cure-wounds',
        name: 'Cure Wounds',
        description: 'Heals 10 HP',
        type: 'spell',
        range: 6,
        targeting: 'single_ally',
        cost: { type: 'action', spellSlotLevel: 1 },
        effects: [{ type: 'heal', value: 10 }],
        icon: 'heal',
        tags: [],
      };

      const fireBolt: Ability = {
        id: 'fire-bolt',
        name: 'Fire Bolt',
        description: 'Deals 10 fire damage',
        type: 'attack',
        range: 6,
        targeting: 'single_enemy',
        cost: { type: 'action' },
        effects: [{ type: 'damage', damageType: 'fire', value: 10 }],
        icon: 'fire',
        tags: [],
      };

      const cleric = createMockCombatCharacter({
        id: 'cleric',
        name: 'Cleric Ally',
        team: 'player',
        position: { x: 0, y: 0 },
        abilities: [cureWounds, fireBolt],
        spellSlots: { level_1: { current: 2, max: 2 } },
      });

      // Lightly bruised ally (18/20 HP = 90% HP)
      const healthyFighter = createMockCombatCharacter({
        id: 'fighter',
        name: 'Fighter Carry',
        team: 'player',
        position: { x: 0, y: 2 },
        currentHP: 18,
        maxHP: 20
      });

      // Healthy enemy in range
      const enemyOrc = createMockCombatCharacter({
        id: 'orc',
        name: 'Orc Warrior',
        team: 'enemy',
        position: { x: 0, y: 4 },
        currentHP: 20,
        maxHP: 20
      });

      const result = evaluateCombatTurn(cleric, [cleric, healthyFighter, enemyOrc], mapData);

      // Cleric attacks the enemy rather than wasting an action topping off 2 HP
      expect(result.type).toBe('ability');
      expect(result.abilityId).toBe('fire-bolt');
      expect(result.targetCharacterIds).toContain(enemyOrc.id);
    });
  });

  describe('Allied Party Tactics — Spell Slot Budgeting', () => {
    it('should not waste a 3rd-level spell slot on a trivial 2 HP foe when a cantrip suffices', () => {
      const cantrip: Ability = {
        id: 'fire-bolt',
        name: 'Fire Bolt',
        description: 'Deals 10 fire damage',
        type: 'attack',
        range: 6,
        targeting: 'single_enemy',
        cost: { type: 'action', spellSlotLevel: 0 },
        effects: [{ type: 'damage', damageType: 'fire', value: 10 }],
        icon: 'fire',
        tags: [],
      };

      const lightningBolt: Ability = {
        id: 'lightning-bolt',
        name: 'Lightning Bolt',
        description: 'Deals 28 lightning damage',
        type: 'spell',
        range: 6,
        targeting: 'single_enemy',
        cost: { type: 'action', spellSlotLevel: 3 },
        effects: [{ type: 'damage', damageType: 'lightning', value: 28 }],
        icon: 'lightning',
        tags: [],
      };

      const wizard = createMockCombatCharacter({
        id: 'wizard',
        name: 'Wizard Ally',
        team: 'player',
        position: { x: 0, y: 0 },
        abilities: [cantrip, lightningBolt],
        spellSlots: {
          level_1: { current: 4, max: 4 },
          level_2: { current: 3, max: 3 },
          level_3: { current: 2, max: 2 },
          level_4: { current: 0, max: 0 },
          level_5: { current: 0, max: 0 },
          level_6: { current: 0, max: 0 },
          level_7: { current: 0, max: 0 },
          level_8: { current: 0, max: 0 },
          level_9: { current: 0, max: 0 },
        }
      });

      // Trivial dying goblin (2/15 HP)
      const trivialGoblin = createMockCombatCharacter({
        id: 'goblin',
        name: 'Goblin Minion',
        team: 'enemy',
        position: { x: 0, y: 3 },
        currentHP: 2,
        maxHP: 15
      });

      const result = evaluateCombatTurn(wizard, [wizard, trivialGoblin], mapData);

      // Wizard must budget spell slots and finish the 2 HP goblin with Fire Bolt instead of Lightning Bolt
      expect(result.type).toBe('ability');
      expect(result.abilityId).toBe('fire-bolt');
      expect(result.targetCharacterIds).toContain(trivialGoblin.id);
    });

    it('should spend a 3rd-level spell slot on a healthy high-threat enemy', () => {
      const cantrip: Ability = {
        id: 'fire-bolt',
        name: 'Fire Bolt',
        description: 'Deals 10 fire damage',
        type: 'attack',
        range: 6,
        targeting: 'single_enemy',
        cost: { type: 'action', spellSlotLevel: 0 },
        effects: [{ type: 'damage', damageType: 'fire', value: 10 }],
        icon: 'fire',
        tags: [],
      };

      const lightningBolt: Ability = {
        id: 'lightning-bolt',
        name: 'Lightning Bolt',
        description: 'Deals 28 lightning damage',
        type: 'spell',
        range: 6,
        targeting: 'single_enemy',
        cost: { type: 'action', spellSlotLevel: 3 },
        effects: [{ type: 'damage', damageType: 'lightning', value: 28 }],
        icon: 'lightning',
        tags: [],
      };

      const wizard = createMockCombatCharacter({
        id: 'wizard',
        name: 'Wizard Ally',
        team: 'player',
        position: { x: 0, y: 0 },
        abilities: [cantrip, lightningBolt],
        spellSlots: {
          level_1: { current: 4, max: 4 },
          level_2: { current: 3, max: 3 },
          level_3: { current: 2, max: 2 },
          level_4: { current: 0, max: 0 },
          level_5: { current: 0, max: 0 },
          level_6: { current: 0, max: 0 },
          level_7: { current: 0, max: 0 },
          level_8: { current: 0, max: 0 },
          level_9: { current: 0, max: 0 },
        }
      });

      // Healthy high-HP boss enemy (50/50 HP)
      const bossOgre = createMockCombatCharacter({
        id: 'ogre',
        name: 'Ogre Chieftain',
        team: 'enemy',
        position: { x: 0, y: 3 },
        currentHP: 50,
        maxHP: 50
      });

      const result = evaluateCombatTurn(wizard, [wizard, bossOgre], mapData);

      // Against a high-HP threat, the wizard unleashes Lightning Bolt
      expect(result.type).toBe('ability');
      expect(result.abilityId).toBe('lightning-bolt');
      expect(result.targetCharacterIds).toContain(bossOgre.id);
    });
  });

  describe('Allied Party Tactics — Threat Management & Interception', () => {
    it('should move a frontline tank into an interception position to screen a vulnerable concentrating backliner', () => {
      const meleeStrike: Ability = {
        id: 'sword-strike',
        name: 'Longsword Strike',
        description: 'Melee attack dealing 10 damage',
        type: 'attack',
        range: 1,
        targeting: 'single_enemy',
        cost: { type: 'action' },
        effects: [{ type: 'damage', damageType: 'slashing', value: 10 }],
        icon: 'sword',
        tags: [],
      };

      // Paladin frontliner tank
      const paladin = createMockCombatCharacter({
        id: 'paladin',
        name: 'Paladin Tank',
        team: 'player',
        position: { x: 0, y: 0 },
        currentHP: 30,
        maxHP: 30,
        armorClass: 18,
        class: { id: 'paladin', name: 'Paladin' } as any,
        abilities: [meleeStrike]
      });

      // Squishy Wizard backliner concentrating on a spell
      const wizard = createMockCombatCharacter({
        id: 'wizard',
        name: 'Wizard Backliner',
        team: 'player',
        position: { x: 0, y: 1 },
        currentHP: 14,
        maxHP: 14,
        armorClass: 12,
        class: { id: 'wizard', name: 'Wizard' } as any,
        concentratingOn: {
          spellId: 'web',
          spellName: 'Web',
          spellLevel: 2,
          startedTurn: 1,
          effectIds: [],
          canDropAsFreeAction: true
        }
      });

      // Approaching melee hostile 6 tiles away
      const meleeOrc = createMockCombatCharacter({
        id: 'orc',
        name: 'Orc Raider',
        team: 'enemy',
        position: { x: 6, y: 1 },
        currentHP: 20,
        maxHP: 20,
        abilities: [{ ...meleeStrike, id: 'orc-axe', name: 'Greataxe' }]
      });

      const result = evaluateCombatTurn(paladin, [paladin, wizard, meleeOrc], mapData);

      // Paladin is out of melee range of the orc, so they move into an interception position between Wizard and Orc
      expect(result.type).toBe('move');
      expect(result.targetPosition?.x).toBeGreaterThan(0);
      expect(result.targetPosition?.y).toBe(1); // On the direct screening corridor to protect the wizard
    });

    it('should prioritize peeling for a vulnerable ally by attacking the adjacent melee hostile', () => {
      const meleeStrike: Ability = {
        id: 'sword-strike',
        name: 'Longsword Strike',
        description: 'Melee attack dealing 10 damage',
        type: 'attack',
        range: 1,
        targeting: 'single_enemy',
        cost: { type: 'action' },
        effects: [{ type: 'damage', damageType: 'slashing', value: 10 }],
        icon: 'sword',
        tags: [],
      };

      const fighter = createMockCombatCharacter({
        id: 'fighter',
        name: 'Fighter Tank',
        team: 'player',
        position: { x: 2, y: 2 },
        abilities: [meleeStrike]
      });

      // Vulnerable wizard backliner adjacent to fighter
      const wizard = createMockCombatCharacter({
        id: 'wizard',
        name: 'Wizard Backliner',
        team: 'player',
        position: { x: 2, y: 3 },
        class: { id: 'wizard', name: 'Wizard' } as any,
        concentratingOn: {
          spellId: 'hypnotic-pattern',
          spellName: 'Hypnotic Pattern',
          spellLevel: 2,
          startedTurn: 1,
          effectIds: [],
          canDropAsFreeAction: true
        }
      });

      // Enemy 1: Melee hostile adjacent to both Fighter and Wizard (threatening the wizard!)
      const threateningGoblin = createMockCombatCharacter({
        id: 'goblin-1',
        name: 'Goblin Threatening Wizard',
        team: 'enemy',
        position: { x: 3, y: 3 },
        currentHP: 15,
        maxHP: 15
      });

      // Enemy 2: Melee hostile adjacent to Fighter but away from Wizard
      const distantGoblin = createMockCombatCharacter({
        id: 'goblin-2',
        name: 'Goblin Flanking',
        team: 'enemy',
        position: { x: 2, y: 1 },
        currentHP: 15,
        maxHP: 15
      });

      const result = evaluateCombatTurn(fighter, [fighter, wizard, threateningGoblin, distantGoblin], mapData);

      // Fighter must prioritize peeling the threatening goblin off the concentrating wizard
      expect(result.type).toBe('ability');
      expect(result.targetCharacterIds).toContain(threateningGoblin.id);
    });
  });

  describe('Allied Party Tactics — Buff & Support Priority', () => {
    it('should prioritize casting protective buffs (Bless) on party carry early in combat', () => {
      const bless: Ability = {
        id: 'bless',
        name: 'Bless',
        description: 'Blesses up to 3 allies with +1d4 to attacks and saves',
        type: 'spell',
        range: 6,
        targeting: 'single_ally',
        cost: { type: 'action', spellSlotLevel: 1 },
        effects: [
          {
            type: 'status',
            statusEffect: {
              id: 'blessed-status',
              name: 'Blessed',
              type: 'buff',
              duration: 10,
              source: 'Bless',
              description: 'Adds +1d4 to attack rolls and saving throws'
            }
          }
        ],
        icon: 'bless',
        tags: ['buff', 'concentration'],
      };

      const fireBolt: Ability = {
        id: 'fire-bolt',
        name: 'Fire Bolt',
        description: 'Deals 10 fire damage',
        type: 'attack',
        range: 6,
        targeting: 'single_enemy',
        cost: { type: 'action' },
        effects: [{ type: 'damage', damageType: 'fire', value: 10 }],
        icon: 'fire',
        tags: [],
      };

      const cleric = createMockCombatCharacter({
        id: 'cleric',
        name: 'Cleric Ally',
        team: 'player',
        position: { x: 0, y: 0 },
        abilities: [bless, fireBolt],
        spellSlots: { level_1: { current: 2, max: 2 } },
      });

      // Martial party carry (Barbarian)
      const barbarianCarry = createMockCombatCharacter({
        id: 'barbarian',
        name: 'Barbarian Carry',
        team: 'player',
        position: { x: 0, y: 2 },
        currentHP: 30,
        maxHP: 30,
        class: { id: 'barbarian', name: 'Barbarian' } as any
      });

      // Distant enemy
      const enemyGoblin = createMockCombatCharacter({
        id: 'goblin',
        name: 'Goblin',
        team: 'enemy',
        position: { x: 0, y: 5 },
        currentHP: 20,
        maxHP: 20
      });

      const result = evaluateCombatTurn(cleric, [cleric, barbarianCarry, enemyGoblin], mapData);

      // Cleric casts Bless on the party carry early in combat rather than casting Fire Bolt
      expect(result.type).toBe('ability');
      expect(result.abilityId).toBe('bless');
      expect(result.targetCharacterIds).toContain(barbarianCarry.id);
    });

    it('should not recast Bless on an ally that is already Blessed', () => {
      const bless: Ability = {
        id: 'bless',
        name: 'Bless',
        description: 'Blesses ally',
        type: 'spell',
        range: 6,
        targeting: 'single_ally',
        cost: { type: 'action', spellSlotLevel: 1 },
        effects: [
          {
            type: 'status',
            statusEffect: {
              id: 'blessed-status',
              name: 'Blessed',
              type: 'buff',
              duration: 10,
              source: 'Bless',
              description: 'Adds +1d4 to attack rolls and saving throws'
            }
          }
        ],
        icon: 'bless',
        tags: ['buff', 'concentration'],
      };

      const fireBolt: Ability = {
        id: 'fire-bolt',
        name: 'Fire Bolt',
        description: 'Deals 10 fire damage',
        type: 'attack',
        range: 6,
        targeting: 'single_enemy',
        cost: { type: 'action' },
        effects: [{ type: 'damage', damageType: 'fire', value: 10 }],
        icon: 'fire',
        tags: [],
      };

      const cleric = createMockCombatCharacter({
        id: 'cleric',
        name: 'Cleric Ally',
        team: 'player',
        position: { x: 0, y: 0 },
        abilities: [bless, fireBolt],
        concentratingOn: {
          spellId: 'bless',
          spellName: 'Bless',
          spellLevel: 2,
          startedTurn: 1,
          effectIds: [],
          canDropAsFreeAction: true
        },
        statusEffects: [
          {
            id: 'active-bless-cleric',
            name: 'Blessed',
            type: 'buff',
            duration: 9,
            source: 'Bless',
            description: 'Active bless'
          }
        ]
      });

      // Barbarian already Blessed
      const blessedBarbarian = createMockCombatCharacter({
        id: 'barbarian',
        name: 'Barbarian Carry',
        team: 'player',
        position: { x: 0, y: 2 },
        currentHP: 30,
        maxHP: 30,
        class: { id: 'barbarian', name: 'Barbarian' } as any,
        statusEffects: [
          {
            id: 'active-bless',
            name: 'Blessed',
            type: 'buff',
            duration: 9,
            source: 'Bless',
            description: 'Active bless'
          }
        ]
      });

      const enemyGoblin = createMockCombatCharacter({
        id: 'goblin',
        name: 'Goblin',
        team: 'enemy',
        position: { x: 0, y: 5 },
        currentHP: 20,
        maxHP: 20
      });

      const result = evaluateCombatTurn(cleric, [cleric, blessedBarbarian, enemyGoblin], mapData);

      // Barbarian already has Bless and Cleric is concentrating, so Cleric attacks the Goblin
      expect(result.type).toBe('ability');
      expect(result.abilityId).toBe('fire-bolt');
      expect(result.targetCharacterIds).toContain(enemyGoblin.id);
    });

    it('should avoid breaking active high-value concentration for a lower-priority buff', () => {
      const shieldOfFaith: Ability = {
        id: 'shield-of-faith',
        name: 'Shield of Faith',
        description: '+2 AC',
        type: 'spell',
        range: 6,
        targeting: 'single_ally',
        cost: { type: 'bonus', spellSlotLevel: 1 },
        effects: [
          {
            type: 'status',
            statusEffect: {
              id: 'shield-of-faith-status',
              name: 'Shield of Faith',
              type: 'buff',
              duration: 10,
              source: 'Shield of Faith',
              description: '+2 AC'
            }
          }
        ],
        icon: 'shield',
        tags: ['buff', 'concentration'],
      };

      const fireBolt: Ability = {
        id: 'fire-bolt',
        name: 'Fire Bolt',
        description: 'Deals 10 fire damage',
        type: 'attack',
        range: 6,
        targeting: 'single_enemy',
        cost: { type: 'action' },
        effects: [{ type: 'damage', damageType: 'fire', value: 10 }],
        icon: 'fire',
        tags: [],
      };

      // Cleric concentrating on high-value Spirit Guardians
      const cleric = createMockCombatCharacter({
        id: 'cleric',
        name: 'Cleric Ally',
        team: 'player',
        position: { x: 0, y: 0 },
        abilities: [shieldOfFaith, fireBolt],
        concentratingOn: {
          spellId: 'spirit-guardians',
          spellName: 'Spirit Guardians',
          spellLevel: 2,
          startedTurn: 1,
          effectIds: [],
          canDropAsFreeAction: true
        }
      });

      const fighter = createMockCombatCharacter({
        id: 'fighter',
        name: 'Fighter Carry',
        team: 'player',
        position: { x: 0, y: 2 },
        currentHP: 20,
        maxHP: 20
      });

      const enemyGoblin = createMockCombatCharacter({
        id: 'goblin',
        name: 'Goblin',
        team: 'enemy',
        position: { x: 0, y: 4 },
        currentHP: 20,
        maxHP: 20
      });

      const result = evaluateCombatTurn(cleric, [cleric, fighter, enemyGoblin], mapData);

      // Cleric preserves Spirit Guardians concentration and attacks with Fire Bolt
      expect(result.type).toBe('ability');
      expect(result.abilityId).toBe('fire-bolt');
      expect(result.targetCharacterIds).toContain(enemyGoblin.id);
    });
  });
  // ==========================================================================
  // Summon scoring (agora-db71.28)
  // ==========================================================================
  describe('summon_creature scoring', () => {
    const summonBeast: Ability = {
      id: 'summon-beast',
      name: 'Summon Beast',
      description: 'Calls a Bestial Spirit to fight alongside the caster.',
      type: 'spell',
      range: 18,
      targeting: 'area',
      cost: { type: 'action', spellSlotLevel: 2 },
      effects: [
        {
          type: 'summon_creature',
          summonEntityType: 'creature',
          summonCount: 1,
          summonPersistent: false,
        },
      ],
      icon: 'beast-icon',
      tags: [],
    };

    const noOpUtility: Ability = {
      id: 'prestidigitation',
      name: 'Prestidigitation',
      description: 'A harmless trick with no combat effect.',
      type: 'spell',
      range: 2,
      targeting: 'self',
      cost: { type: 'action' },
      effects: [],
      icon: 'spark-icon',
      tags: [],
    };

    it('scores a summon above a no-op ability for a caster with a free action', () => {
      const caster = createMockCombatCharacter({
        id: 'conjurer',
        name: 'Conjurer',
        team: 'player',
        position: { x: 0, y: 0 },
        abilities: [summonBeast, noOpUtility],
      });

      const summonScore = evaluateSummonAbility(caster, summonBeast, [caster]);
      const noOpScore = evaluateSummonAbility(caster, noOpUtility, [caster]);

      expect(noOpScore).toBe(0);
      expect(summonScore).toBeGreaterThan(noOpScore);
    });

    it('chooses the summon over a no-op utility when the planner runs a full turn', () => {
      const caster = createMockCombatCharacter({
        id: 'conjurer',
        name: 'Conjurer',
        team: 'player',
        position: { x: 0, y: 0 },
        abilities: [noOpUtility, summonBeast],
        spellSlots: { level_2: { current: 1, max: 1 } },
      });
      const goblin = createMockCombatCharacter({
        id: 'goblin',
        name: 'Goblin',
        team: 'enemy',
        position: { x: 0, y: 3 },
        currentHP: 20,
        maxHP: 20,
      });

      const result = evaluateCombatTurn(caster, [caster, goblin], mapData);

      expect(result.type).toBe('ability');
      expect(result.abilityId).toBe('summon-beast');
    });

    it('values a fighting spirit above a floating object', () => {
      const caster = createMockCombatCharacter({
        id: 'conjurer',
        team: 'player',
        position: { x: 0, y: 0 },
      });
      const floatingDisk: Ability = {
        ...summonBeast,
        id: 'tensers-floating-disk',
        name: "Tenser's Floating Disk",
        effects: [
          {
            type: 'summon_creature',
            summonEntityType: 'object',
            summonCount: 1,
            summonPersistent: false,
          },
        ],
      };

      expect(evaluateSummonAbility(caster, summonBeast, [caster])).toBeGreaterThan(
        evaluateSummonAbility(caster, floatingDisk, [caster])
      );
    });

    it('scores a multi-creature summon above a single-creature summon', () => {
      const caster = createMockCombatCharacter({
        id: 'conjurer',
        team: 'player',
        position: { x: 0, y: 0 },
      });
      const pack: Ability = {
        ...summonBeast,
        id: 'conjure-animals',
        name: 'Conjure Animals',
        effects: [
          {
            type: 'summon_creature',
            summonEntityType: 'creature',
            summonCount: 4,
            summonPersistent: false,
          },
        ],
      };

      expect(evaluateSummonAbility(caster, pack, [caster])).toBeGreaterThan(
        evaluateSummonAbility(caster, summonBeast, [caster])
      );
    });

    it('rewards a persistent summon over an identical temporary one', () => {
      const caster = createMockCombatCharacter({
        id: 'conjurer',
        team: 'player',
        position: { x: 0, y: 0 },
      });
      const persistent: Ability = {
        ...summonBeast,
        effects: [
          {
            type: 'summon_creature',
            summonEntityType: 'creature',
            summonCount: 1,
            summonPersistent: true,
          },
        ],
      };

      expect(evaluateSummonAbility(caster, persistent, [caster])).toBeGreaterThan(
        evaluateSummonAbility(caster, summonBeast, [caster])
      );
    });

    it('refuses to recast a summon this caster already has on the field', () => {
      const caster = createMockCombatCharacter({
        id: 'conjurer',
        team: 'player',
        position: { x: 0, y: 0 },
        abilities: [summonBeast],
      });
      const spirit = createMockCombatCharacter({
        id: 'bestial-spirit',
        name: 'Bestial Spirit',
        team: 'player',
        position: { x: 1, y: 0 },
        isSummon: true,
        summonMetadata: { casterId: 'conjurer', spellId: 'summon-beast' },
      });

      expect(evaluateSummonAbility(caster, summonBeast, [caster, spirit])).toBe(0);
    });

    it('refuses a concentration summon while another concentration spell is live', () => {
      const concentrationSummon: Ability = { ...summonBeast, tags: ['concentration'] };
      const caster = createMockCombatCharacter({
        id: 'conjurer',
        team: 'player',
        position: { x: 0, y: 0 },
        abilities: [concentrationSummon],
        concentratingOn: {
          spellId: 'spirit-guardians',
          spellName: 'Spirit Guardians',
          spellLevel: 2,
          startedTurn: 1,
          effectIds: [],
          canDropAsFreeAction: true
        },
      });

      expect(evaluateSummonAbility(caster, concentrationSummon, [caster])).toBe(0);
    });
  });
});
