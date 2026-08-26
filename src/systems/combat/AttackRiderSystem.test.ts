import { describe, expect, it } from 'vitest';
import {
  AttackRiderSystem,
  isRiderHitEligible,
  isRiderTargetMatch,
  isRiderTurnAvailable,
  isRiderAttackFilterMatch,
} from './AttackRiderSystem';
import type { ActiveRider, CombatState } from '../../types/combat';
import type { AttackContext, RiderMatchResult } from './AttackRiderSystem';

/**
 * This file proves the shared attack-rider matching system used by next-attack spells.
 *
 * It has two sections:
 * 1. Focused predicate tests — each extracted predicate function is tested in isolation
 *    so the matching contract is documented and regressions are caught at the exact
 *    boundary that broke.
 * 2. Composed integration tests — the original test suite that proves the full
 *    getMatchingRiders() pipeline and consumption behavior.
 *
 * G32 refactor (2026-08-26): Added the predicate tests. All original integration tests
 * are preserved unchanged.
 *
 * Called by: focused Vitest checks for combat rider matching.
 * Depends on: AttackRiderSystem, the extracted predicate functions, and ActiveRider type.
 */

// ============================================================================
// Shared Fixtures
// ============================================================================
// These helpers build minimal rider and state objects focused on the dimension
// being tested. The payload details are intentionally minimal because these
// tests are about matching predicates, not about resolving damage.
// ============================================================================

/** Builds a minimal ActiveRider with sensible defaults, overridable per-test. */
const createMinimalRider = (overrides: Partial<ActiveRider> = {}): ActiveRider => ({
  id: 'test-rider',
  spellId: 'test-spell',
  casterId: 'attacker',
  sourceName: 'Test Rider',
  effect: {
    type: 'DAMAGE',
    damage: { dice: '1d6', type: 'radiant' },
    trigger: { type: 'on_attack_hit', attackFilter: {} },
    condition: { type: 'always' }
  } as unknown as ActiveRider['effect'],
  consumption: 'first_hit',
  attackFilter: {},
  usedThisTurn: false,
  duration: { type: 'rounds', value: 1 },
  ...overrides,
});

/** Builds a minimal AttackContext with sensible defaults, overridable per-test. */
const createMinimalContext = (overrides: Partial<AttackContext> = {}): AttackContext => ({
  attackerId: 'attacker',
  targetId: 'target',
  attackType: 'weapon',
  weaponType: 'melee',
  isHit: true,
  ...overrides,
});

// ============================================================================
// Original Fixture Helpers (preserved from pre-refactor tests)
// ============================================================================
// These are the exact same helpers used by the original integration tests.
// They build richer fixtures for the composed matching + consumption proofs.
// ============================================================================

const createMeleeWeaponRider = (): ActiveRider => ({
  id: 'melee-rider',
  spellId: 'weapon-rider',
  casterId: 'attacker',
  sourceName: 'Melee Weapon Rider',
  effect: {
    type: 'DAMAGE',
    damage: {
      dice: '1d6',
      type: 'radiant'
    },
    trigger: {
      type: 'on_attack_hit',
      attackFilter: {
        attackType: 'weapon',
        weaponType: 'melee'
      }
    },
    condition: {
      type: 'always'
    }
    } as unknown as ActiveRider['effect'],
  consumption: 'first_hit',
  attackFilter: {
    attackType: 'weapon',
    weaponType: 'melee'
  },
  usedThisTurn: false,
  duration: {
    type: 'rounds',
    value: 1
  }
});

const createLegacyRangedWeaponRider = (): ActiveRider => ({
  id: 'legacy-ranged-rider',
  spellId: 'lightning-arrow-like',
  casterId: 'attacker',
  sourceName: 'Legacy Ranged Rider',
  effect: {
    type: 'DAMAGE',
    damage: {
      dice: '4d8',
      type: 'lightning'
    },
    trigger: {
      type: 'on_attack_hit',
      attackFilter: {
        attackType: 'weapon',
        weaponType: 'ranged_weapon'
      }
    },
    condition: {
      type: 'always'
    }
  } as unknown as ActiveRider['effect'],
  consumption: 'per_instance_hit_or_miss',
  // Fixture keeps the legacy `ranged_weapon` label while canonical migration is
  // ongoing in rider JSON producers and consumers.
  attackFilter: {
    attackType: 'weapon',
    weaponType: 'ranged_weapon'
  } as unknown as ActiveRider['attackFilter'],
  usedThisTurn: false,
  duration: {
    type: 'minutes',
    value: 1
  }
});

const createStateWithRider = (rider: ActiveRider): CombatState => ({
  isActive: true,
  characters: [{
    id: 'attacker',
    name: 'Attacker',
    currentHP: 10,
    maxHP: 10,
    position: { x: 0, y: 0 },
    riders: [rider]
  } as unknown as CombatState['characters'][number]],
  currentTurn: 1,
  round: 1,
  turnOrder: ['attacker'],
  activeCharacterId: 'attacker',
  combatLog: [],
  reactiveTriggers: [],
  activeLightSources: []
} as unknown as CombatState);

// ============================================================================
// PART 1: Focused Predicate Tests
// ============================================================================
// Each extracted predicate is tested in isolation. These tests document the
// exact matching contract for each dimension and catch regressions at the
// specific boundary that broke, rather than surfacing failures through the
// composed pipeline.
// ============================================================================

// ---- isRiderHitEligible ----
// Tests the hit/miss gate: most riders only fire on hits, but hit-or-miss
// riders (like Lightning Arrow) fire regardless of the attack outcome.

describe('isRiderHitEligible', () => {
  it('accepts a hit for a first_hit rider', () => {
    const rider = createMinimalRider({ consumption: 'first_hit' });
    const context = createMinimalContext({ isHit: true });
    expect(isRiderHitEligible(rider, context)).toBe(true);
  });

  it('rejects a miss for a first_hit rider', () => {
    const rider = createMinimalRider({ consumption: 'first_hit' });
    const context = createMinimalContext({ isHit: false });
    expect(isRiderHitEligible(rider, context)).toBe(false);
  });

  it('accepts a miss for a per_instance_hit_or_miss rider (Lightning Arrow pattern)', () => {
    const rider = createMinimalRider({ consumption: 'per_instance_hit_or_miss' });
    const context = createMinimalContext({ isHit: false });
    expect(isRiderHitEligible(rider, context)).toBe(true);
  });

  it('accepts a hit for a per_instance_hit_or_miss rider', () => {
    const rider = createMinimalRider({ consumption: 'per_instance_hit_or_miss' });
    const context = createMinimalContext({ isHit: true });
    expect(isRiderHitEligible(rider, context)).toBe(true);
  });

  it('rejects a miss for a per_turn rider', () => {
    const rider = createMinimalRider({ consumption: 'per_turn' });
    const context = createMinimalContext({ isHit: false });
    expect(isRiderHitEligible(rider, context)).toBe(false);
  });

  it('rejects a miss for an unlimited rider', () => {
    const rider = createMinimalRider({ consumption: 'unlimited' });
    const context = createMinimalContext({ isHit: false });
    expect(isRiderHitEligible(rider, context)).toBe(false);
  });
});

// ---- isRiderTargetMatch ----
// Tests target-specificity: Hex/Hunter's Mark lock to a specific target,
// while Divine Favor matches attacks against anyone.

describe('isRiderTargetMatch', () => {
  it('matches when the rider has no target lock (applies to all targets)', () => {
    const rider = createMinimalRider({ targetId: undefined });
    const context = createMinimalContext({ targetId: 'any-enemy' });
    expect(isRiderTargetMatch(rider, context)).toBe(true);
  });

  it('matches when the rider target matches the attack target', () => {
    const rider = createMinimalRider({ targetId: 'marked-enemy' });
    const context = createMinimalContext({ targetId: 'marked-enemy' });
    expect(isRiderTargetMatch(rider, context)).toBe(true);
  });

  it('rejects when the rider target does not match the attack target', () => {
    const rider = createMinimalRider({ targetId: 'marked-enemy' });
    const context = createMinimalContext({ targetId: 'different-enemy' });
    expect(isRiderTargetMatch(rider, context)).toBe(false);
  });
});

// ---- isRiderTurnAvailable ----
// Tests per-turn usage: Sneak Attack-style riders can only fire once per turn.

describe('isRiderTurnAvailable', () => {
  it('allows a per_turn rider that has not been used yet', () => {
    const rider = createMinimalRider({ consumption: 'per_turn', usedThisTurn: false });
    expect(isRiderTurnAvailable(rider)).toBe(true);
  });

  it('rejects a per_turn rider that has already been used this turn', () => {
    const rider = createMinimalRider({ consumption: 'per_turn', usedThisTurn: true });
    expect(isRiderTurnAvailable(rider)).toBe(false);
  });

  it('allows a first_hit rider regardless of usedThisTurn flag', () => {
    // first_hit riders are removed entirely after firing, so usedThisTurn
    // is irrelevant — but if it were set by accident, it should not block.
    const rider = createMinimalRider({ consumption: 'first_hit', usedThisTurn: true });
    expect(isRiderTurnAvailable(rider)).toBe(true);
  });

  it('allows an unlimited rider regardless of usedThisTurn flag', () => {
    const rider = createMinimalRider({ consumption: 'unlimited', usedThisTurn: true });
    expect(isRiderTurnAvailable(rider)).toBe(true);
  });
});

// ---- isRiderAttackFilterMatch ----
// Tests weapon type and attack type filtering, including legacy label normalization
// and the unarmed boundary.

describe('isRiderAttackFilterMatch', () => {
  it('matches when the rider has no weapon or attack type filter (empty filter)', () => {
    const rider = createMinimalRider({ attackFilter: {} });
    const context = createMinimalContext({ attackType: 'weapon', weaponType: 'melee' });
    expect(isRiderAttackFilterMatch(rider, context)).toBe(true);
  });

  it('matches when weapon type filter is "any"', () => {
    const rider = createMinimalRider({ attackFilter: { weaponType: 'any' } });
    const context = createMinimalContext({ weaponType: 'ranged' });
    expect(isRiderAttackFilterMatch(rider, context)).toBe(true);
  });

  it('matches when attack type filter is "any"', () => {
    const rider = createMinimalRider({ attackFilter: { attackType: 'any' } });
    const context = createMinimalContext({ attackType: 'spell' });
    expect(isRiderAttackFilterMatch(rider, context)).toBe(true);
  });

  it('rejects when weapon type does not match', () => {
    const rider = createMinimalRider({ attackFilter: { weaponType: 'melee' } });
    const context = createMinimalContext({ weaponType: 'ranged' });
    expect(isRiderAttackFilterMatch(rider, context)).toBe(false);
  });

  it('rejects when attack type does not match', () => {
    const rider = createMinimalRider({ attackFilter: { attackType: 'weapon' } });
    const context = createMinimalContext({ attackType: 'spell' });
    expect(isRiderAttackFilterMatch(rider, context)).toBe(false);
  });

  it('rejects when context has no weapon type but rider requires one', () => {
    const rider = createMinimalRider({ attackFilter: { weaponType: 'melee' } });
    const context = createMinimalContext({ weaponType: undefined });
    expect(isRiderAttackFilterMatch(rider, context)).toBe(false);
  });

  it('normalizes legacy "melee_weapon" to "melee" for matching', () => {
    const rider = createMinimalRider({
      attackFilter: { weaponType: 'melee_weapon' } as unknown as ActiveRider['attackFilter']
    });
    const context = createMinimalContext({ weaponType: 'melee' });
    expect(isRiderAttackFilterMatch(rider, context)).toBe(true);
  });

  it('normalizes legacy "ranged_weapon" to "ranged" for matching', () => {
    const rider = createMinimalRider({
      attackFilter: { weaponType: 'ranged_weapon' } as unknown as ActiveRider['attackFilter']
    });
    const context = createMinimalContext({ weaponType: 'ranged' });
    expect(isRiderAttackFilterMatch(rider, context)).toBe(true);
  });

  it('rejects unarmed attacks against a melee weapon filter (unarmed boundary)', () => {
    // An unarmed strike is melee in ordinary table language, but it is NOT a
    // held melee weapon. Rider matching must keep these separate. Smite reaction
    // prompts handle unarmed opt-ins through separate castingTrigger metadata.
    const rider = createMinimalRider({ attackFilter: { attackType: 'weapon', weaponType: 'melee' } });
    const context = createMinimalContext({ attackType: 'unarmed', weaponType: 'unarmed' });
    expect(isRiderAttackFilterMatch(rider, context)).toBe(false);
  });
});

// ============================================================================
// PART 2: Composed Integration Tests (Original Suite — Preserved Unchanged)
// ============================================================================
// These tests prove the full getMatchingRiders() pipeline and consumption
// behavior. They existed before the G32 predicate extraction and validate that
// the refactored composition produces identical results.
// ============================================================================

// ---- Unarmed Strike Boundary ----
// The matcher should keep weapon riders narrow while the after-hit smite hook
// handles spell-specific Unarmed Strike opt-ins through castingTrigger metadata.

describe('AttackRiderSystem unarmed attack matching', () => {
  it('does not match a melee weapon rider against an Unarmed Strike context', () => {
    const riderSystem = new AttackRiderSystem();
    const rider = createMeleeWeaponRider();
    const state = createStateWithRider(rider);

    // An Unarmed Strike is melee in ordinary table language, but it is not a
    // held melee weapon for rider matching. This prevents pending weapon riders
    // from firing unless their own data explicitly grows an unarmed contract.
    const matches = riderSystem.getMatchingRiders(state, {
      attackerId: 'attacker',
      targetId: 'target',
      attackType: 'unarmed',
      weaponType: 'unarmed',
      isHit: true
    });

    expect(matches).toEqual([]);
  });

  it('still matches the same rider against an ordinary melee weapon context', () => {
    const riderSystem = new AttackRiderSystem();
    const rider = createMeleeWeaponRider();
    const state = createStateWithRider(rider);

    // The unarmed guard must not break the existing melee weapon path used by
    // active smite/rider spells that really are waiting for a held melee weapon.
    const matches = riderSystem.getMatchingRiders(state, {
      attackerId: 'attacker',
      targetId: 'target',
      attackType: 'weapon',
      weaponType: 'melee',
      isHit: true
    });

    expect(matches).toEqual([rider]);
  });
});

// ---- Legacy Weapon-Type Filter Compatibility ----
// Next-attack riders have lived through multiple data shapes. The runtime
// context now reports compact `ranged` / `melee` labels, while older rider data
// may still carry `ranged_weapon` / `melee_weapon`. This proof keeps the shared
// matcher tolerant so Lightning Arrow-style riders do not miss their trigger.

describe('AttackRiderSystem weapon-type filter compatibility', () => {
  it('matches a legacy ranged-weapon rider against the compact ranged attack context', () => {
    const riderSystem = new AttackRiderSystem();
    const rider = createLegacyRangedWeaponRider();
    const state = createStateWithRider(rider);

    // Lightning Arrow waits for the next ranged weapon attack. Older data may
    // name that filter `ranged_weapon`, while the attack classifier now sends
    // the compact `ranged` context. The shared matcher should treat those as
    // the same weapon family instead of leaving the rider pending forever.
    const matches = riderSystem.getMatchingRiders(state, {
      attackerId: 'attacker',
      targetId: 'target',
      attackType: 'weapon',
      weaponType: 'ranged',
      isHit: false
    });

    expect(matches).toEqual([rider]);
  });

  it('does not match a legacy ranged-weapon rider against a ranged spell attack', () => {
    const riderSystem = new AttackRiderSystem();
    const rider = createLegacyRangedWeaponRider();
    const state = createStateWithRider(rider);

    // Lightning Arrow waits for a ranged weapon attack, not any ranged attack.
    // Generated spell-attack buttons can also be ranged, so this guard proves
    // explicit spell-attack metadata keeps them from consuming weapon riders.
    const matches = riderSystem.getMatchingRiders(state, {
      attackerId: 'attacker',
      targetId: 'target',
      attackType: 'spell',
      weaponType: 'ranged',
      isHit: false
    });

    expect(matches).toEqual([]);
  });

  it('does not match a legacy ranged-weapon rider against a melee weapon attack', () => {
    const riderSystem = new AttackRiderSystem();
    const rider = createLegacyRangedWeaponRider();
    const state = createStateWithRider(rider);

    // A melee weapon hit or miss is still a weapon attack, but it is the wrong
    // weapon family for Lightning Arrow. The rider should stay pending until a
    // ranged weapon attack resolves.
    const matches = riderSystem.getMatchingRiders(state, {
      attackerId: 'attacker',
      targetId: 'target',
      attackType: 'weapon',
      weaponType: 'melee',
      isHit: false
    });

    expect(matches).toEqual([]);
  });
});

// ---- Hit-Or-Miss Rider Consumption ----
// Lightning Arrow spends its stored spell payload on the next matching ranged
// weapon attack whether that attack hits or misses. These checks prove the
// shared rider system removes that rider after matching, so a later attack
// cannot reuse the same spell payload.

describe('AttackRiderSystem hit-or-miss rider consumption', () => {
  it('removes a Lightning Arrow-style rider after a matching miss consumes it', () => {
    const riderSystem = new AttackRiderSystem();
    const rider = createLegacyRangedWeaponRider();
    const state = createStateWithRider(rider);
    const matches = riderSystem.getMatchingRiders(state, {
      attackerId: 'attacker',
      targetId: 'target',
      attackType: 'weapon',
      weaponType: 'ranged',
      isHit: false
    });

    // The same `per_instance_hit_or_miss` rider family handles Lightning
    // Arrow's miss case. Once the matching miss is found, consumption should
    // remove the rider entirely instead of marking it used for a later hit.
    const consumedState = riderSystem.consumeRiders(state, 'attacker', matches);
    const attackerAfterMiss = consumedState.characters.find(character => character.id === 'attacker');

    expect(matches).toEqual([rider]);
    expect(attackerAfterMiss?.riders).toEqual([]);
  });

  it('removes a Lightning Arrow-style rider after a matching hit consumes it', () => {
    const riderSystem = new AttackRiderSystem();
    const rider = createLegacyRangedWeaponRider();
    const state = createStateWithRider(rider);
    const matches = riderSystem.getMatchingRiders(state, {
      attackerId: 'attacker',
      targetId: 'target',
      attackType: 'weapon',
      weaponType: 'ranged',
      isHit: true
    });

    // A qualifying hit and a qualifying miss both spend this rider family.
    // This prevents Lightning Arrow from applying its transformed weapon
    // payload more than once after the first matching ranged weapon attack.
    const consumedState = riderSystem.consumeRiders(state, 'attacker', matches);
    const attackerAfterHit = consumedState.characters.find(character => character.id === 'attacker');

    expect(matches).toEqual([rider]);
    expect(attackerAfterHit?.riders).toEqual([]);
  });
});
