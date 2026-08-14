import { describe, it, expect, beforeEach } from 'vitest';
import { OpportunityAttackSystem } from '../reactions/OpportunityAttackSystem';
import { createMockCombatCharacter, createMockItem } from '@/utils/core';
import { canTakeReaction } from '@/utils/combat';
import type { Ability, BattleMapData, BattleMapTile, CombatCharacter } from '@/types/combat';

/**
 * This file protects the production Opportunity Attack boundary and its rule gates.
 *
 * Small and Large fixtures cross normal and extended reach using complete
 * occupied footprints. The rejection cases keep voluntary movement distinct
 * from forced movement and teleportation while preserving reaction, condition,
 * ownership, and visibility rules used by the mounted combat executor.
 *
 * Called by: the focused combat-system Vitest gate.
 * Depends on: OpportunityAttackSystem and canonical combat test factories.
 */

describe('OpportunityAttackSystem and Reaction Rules', () => {
  let oaSystem: OpportunityAttackSystem;

  beforeEach(() => {
    oaSystem = new OpportunityAttackSystem();
  });

  const createReachWeaponAttack = (id: string, range: 1 | 2): Ability => ({
    id,
    name: id,
    description: range === 2 ? 'A 10ft reach weapon.' : 'A 5ft melee weapon.',
    type: 'attack',
    targeting: 'single_enemy',
    range,
    weapon: createMockItem({
      id: `${id}_weapon`,
      name: id,
      description: range === 2 ? 'A reach weapon' : 'A melee weapon',
      type: 'weapon',
      properties: range === 2 ? ['reach'] : []
    }),
    isProficient: true,
    effects: [{ type: 'damage', value: 1, damageType: 'slashing' }],
    cost: { type: 'action' }
  });

  // Every geometry case starts with an explicitly sized actor and a ready
  // Reaction. Keeping this setup shared makes the footprint transition the
  // only variable under test.
  const createSizedActor = (
    id: string,
    position: { x: number; y: number },
    team: CombatCharacter['team'],
    size: NonNullable<CombatCharacter['stats']['size']>,
  ): CombatCharacter => {
    const actor = createMockCombatCharacter({ id, position, team });
    return {
      ...actor,
      stats: { ...actor.stats, size },
      actionEconomy: {
        ...actor.actionEconomy,
        reaction: { ...actor.actionEconomy.reaction, used: false, remaining: 1 },
      },
    };
  };

  // This narrow lane places an opaque square between attacker and mover. The
  // map contains every endpoint used by the visibility resolver.
  const createBlockedSightMap = (): BattleMapData => {
    const tiles = new Map<string, BattleMapTile>();
    for (let y = 0; y <= 3; y += 1) {
      const id = `0-${y}`;
      tiles.set(id, {
        id,
        coordinates: { x: 0, y },
        terrain: y === 1 ? 'wall' : 'floor',
        elevation: 0,
        movementCost: 5,
        blocksLoS: y === 1,
        blocksMovement: y === 1,
        decoration: null,
        effects: [],
      });
    }
    return {
      dimensions: { width: 1, height: 4 },
      tiles,
      theme: 'dungeon',
      seed: 52,
    };
  };

  it('prevents reactions if character has Reactions Suppressed condition', () => {
    const character = createMockCombatCharacter({ id: 'target' });
    character.statusEffects.push({
      id: 'reactions_suppressed',
      name: 'Reactions Suppressed',
      type: 'debuff',
      duration: 1
    });

    expect(canTakeReaction(character)).toBe(false);
  });

  it('prevents reactions if character has Confused condition', () => {
    const character = createMockCombatCharacter({ id: 'target' });
    character.statusEffects.push({
      id: 'confused',
      name: 'Confused',
      type: 'debuff',
      duration: 1
    });

    expect(canTakeReaction(character)).toBe(false);
  });

  it('prevents reactions if character has Slowed condition', () => {
    const character = createMockCombatCharacter({ id: 'target' });
    character.statusEffects.push({
      id: 'slowed',
      name: 'Slowed',
      type: 'debuff',
      duration: 1
    });

    expect(canTakeReaction(character)).toBe(false);
  });

  it('prevents opportunity attacks specifically if character has Opportunity Attacks Suppressed condition', () => {
    const mover = createMockCombatCharacter({ id: 'mover', position: { x: 2, y: 0 }, team: 'enemy' });

    // Attacker has a melee weapon (reach 1) and the OA suppressed condition.
    const attacker = createMockCombatCharacter({ id: 'attacker', position: { x: 0, y: 0 }, team: 'player' });
    attacker.abilities.push({
      id: 'melee_attack', name: 'Melee', description: 'A melee opportunity attack fixture.', type: 'attack', targeting: 'single_enemy', range: 1, weapon: createMockItem({
        id: 'melee_weapon',
        name: 'Melee Weapon',
        description: 'A simple melee weapon',
        type: 'weapon'
      }), isProficient: true,
      // This fixture uses the combat Ability TargetingType string; spell target-filter objects do not type-check here.
      effects: [{ type: 'damage', value: 1, damageType: 'slashing' }],
      cost: { type: 'action' }
    });
    attacker.statusEffects.push({
      id: 'oa_suppressed',
      name: 'Opportunity Attacks Suppressed',
      type: 'debuff',
      duration: 1
    });

    // Mover leaves reach (1 -> 2)
    const fromPos = { x: 1, y: 0 };
    const toPos = { x: 2, y: 0 };

    const results = oaSystem.checkOpportunityAttacks(mover, fromPos, toPos, [attacker]);

    expect(results.length).toBe(0); // OA prevented
    // Note: canTakeReaction should still be true because it's only OA that is suppressed
    expect(canTakeReaction(attacker)).toBe(true);
  });

  it('flags must_attack reason if attacker has Enemies Abound', () => {
    const mover = createMockCombatCharacter({ id: 'mover', position: { x: 2, y: 0 }, team: 'enemy' });

    const attacker = createMockCombatCharacter({ id: 'attacker', position: { x: 0, y: 0 }, team: 'player' });
    attacker.abilities.push({
      id: 'melee_attack', name: 'Melee', description: 'A melee opportunity attack fixture.', type: 'attack', targeting: 'single_enemy', range: 1, weapon: createMockItem({
        id: 'melee_weapon',
        name: 'Melee Weapon',
        description: 'A simple melee weapon',
        type: 'weapon'
      }), isProficient: true,
      // This fixture uses the combat Ability TargetingType string; spell target-filter objects do not type-check here.
      effects: [{ type: 'damage', value: 1, damageType: 'slashing' }],
      cost: { type: 'action' }
    });
    attacker.statusEffects.push({
      id: 'enemies_abound',
      name: 'Enemies Abound',
      type: 'debuff',
      duration: 1
    });

    const fromPos = { x: 1, y: 0 };
    const toPos = { x: 2, y: 0 };

    const results = oaSystem.checkOpportunityAttacks(mover, fromPos, toPos, [attacker]);

    expect(results.length).toBe(1);
    expect(results[0].canAttack).toBe(true);
    expect(results[0].reason).toBe('enemies_abound_must_attack');
  });

  it('detects OA at 5ft even when the attacker also wields a 10ft reach weapon', () => {
    const mover = createMockCombatCharacter({ id: 'mover', position: { x: 0, y: 1 }, team: 'enemy' });

    const attacker = createMockCombatCharacter({ id: 'attacker', position: { x: 0, y: 0 }, team: 'player' });
    attacker.abilities.push(createReachWeaponAttack('shortsword', 1));
    attacker.abilities.push(createReachWeaponAttack('glaive', 2));

    const results = oaSystem.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);

    expect(results).toHaveLength(1);
    expect(results[0].attackerId).toBe('attacker');
    expect(results[0].triggerReach).toBe(1);
  });

  it('detects OA at 10ft when the mover leaves the longer reach boundary', () => {
    const mover = createMockCombatCharacter({ id: 'mover', position: { x: 0, y: 2 }, team: 'enemy' });

    const attacker = createMockCombatCharacter({ id: 'attacker', position: { x: 0, y: 0 }, team: 'player' });
    attacker.abilities.push(createReachWeaponAttack('shortsword', 1));
    attacker.abilities.push(createReachWeaponAttack('glaive', 2));

    const results = oaSystem.checkOpportunityAttacks(mover, { x: 0, y: 2 }, { x: 0, y: 3 }, [attacker]);

    expect(results).toHaveLength(1);
    expect(results[0].attackerId).toBe('attacker');
    expect(results[0].triggerReach).toBe(2);
  });

  // ============================================================================
  // Complete-Footprint Reach Regression (GG-52)
  // ============================================================================
  // These anchors begin outside the threatened radius under the old shortcut.
  // Their nearest occupied squares begin inside it, so each outward step must
  // produce the same answer as canonical melee targeting.
  // ============================================================================

  it('detects a normal-reach exit from the edge of a Large attacker footprint', () => {
    const attacker = createSizedActor('large-attacker', { x: 0, y: 0 }, 'player', 'Large');
    attacker.abilities = [createReachWeaponAttack('sword', 1)];
    const mover = createSizedActor('medium-mover', { x: 2, y: 0 }, 'enemy', 'Medium');

    const results = oaSystem.checkOpportunityAttacks(
      mover,
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      [attacker],
    );

    expect(results).toHaveLength(1);
    expect(results[0].triggerReach).toBe(1);
  });

  it('detects a normal-reach exit made by a Large mover footprint', () => {
    const attacker = createSizedActor('medium-attacker', { x: 4, y: 0 }, 'player', 'Medium');
    attacker.abilities = [createReachWeaponAttack('sword', 1)];
    const mover = createSizedActor('large-mover', { x: 2, y: 0 }, 'enemy', 'Large');

    const results = oaSystem.checkOpportunityAttacks(
      mover,
      { x: 2, y: 0 },
      { x: 1, y: 0 },
      [attacker],
    );

    expect(results).toHaveLength(1);
    expect(results[0].triggerReach).toBe(1);
  });

  it('detects an extended-reach exit between two Large footprints', () => {
    const attacker = createSizedActor('large-reach-attacker', { x: 0, y: 0 }, 'player', 'Large');
    attacker.abilities = [createReachWeaponAttack('glaive', 2)];
    const mover = createSizedActor('large-reach-mover', { x: 3, y: 0 }, 'enemy', 'Large');

    const results = oaSystem.checkOpportunityAttacks(
      mover,
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      [attacker],
    );

    expect(results).toHaveLength(1);
    expect(results[0].triggerReach).toBe(2);
  });

  it('does not trigger when a Large mover stays along a Large attacker reach edge', () => {
    const attacker = createSizedActor('large-edge-attacker', { x: 0, y: 0 }, 'player', 'Large');
    attacker.abilities = [createReachWeaponAttack('sword', 1)];
    const mover = createSizedActor('large-edge-mover', { x: 2, y: 0 }, 'enemy', 'Large');

    const results = oaSystem.checkOpportunityAttacks(
      mover,
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      [attacker],
    );

    expect(results).toHaveLength(0);
  });

  // ============================================================================
  // Voluntary-Movement And Attacker Eligibility Gates
  // ============================================================================
  // Geometry may discover a boundary only after these canonical rule gates
  // allow an Opportunity Attack window to exist.
  // ============================================================================

  it.each(['forced', 'teleport'] as const)(
    'rejects %s movement even when the footprints cross reach',
    movementKind => {
      const attacker = createSizedActor('movement-kind-attacker', { x: 0, y: 0 }, 'player', 'Large');
      attacker.abilities = [createReachWeaponAttack('sword', 1)];
      const mover = createSizedActor('movement-kind-mover', { x: 2, y: 0 }, 'enemy', 'Large');

      expect(oaSystem.checkOpportunityAttacks(
        mover,
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        [attacker],
        null,
        { movementKind },
      )).toHaveLength(0);
    },
  );

  it('rejects Disengage, spent Reaction, incapacitation, allied ownership, and blocked sight', () => {
    const baseAttacker = createSizedActor('eligibility-attacker', { x: 0, y: 0 }, 'player', 'Medium');
    baseAttacker.abilities = [createReachWeaponAttack('glaive', 2)];
    const baseMover = createSizedActor('eligibility-mover', { x: 0, y: 2 }, 'enemy', 'Medium');
    const detect = (mover: CombatCharacter, attacker: CombatCharacter, mapData?: BattleMapData) => (
      oaSystem.checkOpportunityAttacks(
        mover,
        { x: 0, y: 2 },
        { x: 0, y: 3 },
        [attacker],
        mapData,
        { movementKind: 'voluntary' },
      )
    );

    const disengagedMover = {
      ...baseMover,
      statusEffects: [...baseMover.statusEffects, {
        id: 'disengage', name: 'Disengage', type: 'buff' as const, duration: 1,
      }],
    };
    expect(detect(disengagedMover, baseAttacker)).toHaveLength(0);

    const spentAttacker = {
      ...baseAttacker,
      actionEconomy: {
        ...baseAttacker.actionEconomy,
        reaction: { ...baseAttacker.actionEconomy.reaction, used: true, remaining: 0 },
      },
    };
    expect(detect(baseMover, spentAttacker)).toHaveLength(0);

    const incapacitatedAttacker = {
      ...baseAttacker,
      statusEffects: [...baseAttacker.statusEffects, {
        id: 'incapacitated', name: 'Incapacitated', type: 'debuff' as const, duration: 1,
      }],
    };
    expect(detect(baseMover, incapacitatedAttacker)).toHaveLength(0);
    expect(detect(baseMover, { ...baseAttacker, team: 'enemy' })).toHaveLength(0);
    expect(detect(baseMover, baseAttacker, createBlockedSightMap())).toHaveLength(0);
  });

  it('rejects Hidden and Invisible movers before opening a reaction window', () => {
    const attacker = createSizedActor('visibility-attacker', { x: 0, y: 0 }, 'player', 'Medium');
    attacker.abilities = [createReachWeaponAttack('sword', 1)];
    const mover = createSizedActor('visibility-mover', { x: 0, y: 1 }, 'enemy', 'Medium');

    // A clear geometric line is not enough when the mover is explicitly unseen.
    // Both legacy status effects and the structured condition mirror must close
    // the window before any prompt or Reaction payment can occur.
    const hiddenMover = {
      ...mover,
      statusEffects: [...mover.statusEffects, {
        id: 'hidden', name: 'Hidden', type: 'buff' as const, duration: 1,
      }],
    };
    const invisibleMover = {
      ...mover,
      conditions: [...(mover.conditions ?? []), {
        name: 'Invisible',
        duration: { type: 'rounds' as const, value: 1 },
        appliedTurn: 1,
        source: 'Invisibility',
      }],
    };

    expect(oaSystem.checkOpportunityAttacks(
      hiddenMover,
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      [attacker],
    )).toHaveLength(0);
    expect(oaSystem.checkOpportunityAttacks(
      invisibleMover,
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      [attacker],
    )).toHaveLength(0);
  });

  it('orders multiple eligible responders by turn order and then stable actor id', () => {
    const mover = createSizedActor('ordered-mover', { x: 0, y: 1 }, 'enemy', 'Medium');
    const alpha = createSizedActor('alpha-responder', { x: 1, y: 0 }, 'player', 'Medium');
    const beta = createSizedActor('beta-responder', { x: 0, y: 0 }, 'player', 'Medium');
    const unlisted = createSizedActor('aardvark-unlisted', { x: -1, y: 0 }, 'player', 'Medium');
    alpha.abilities = [createReachWeaponAttack('alpha-sword', 1)];
    beta.abilities = [createReachWeaponAttack('beta-sword', 1)];
    unlisted.abilities = [createReachWeaponAttack('unlisted-sword', 1)];

    // The roster is deliberately scrambled. The active initiative sequence is
    // authoritative, and responders absent from it fall back to their stable ids.
    const results = oaSystem.checkOpportunityAttacks(
      mover,
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      [unlisted, alpha, beta],
      null,
      {
        movementKind: 'voluntary',
        turnOrder: [beta.id, alpha.id],
      },
    );

    expect(results.map(result => result.attackerId)).toEqual([
      beta.id,
      alpha.id,
      unlisted.id,
    ]);
  });
});
