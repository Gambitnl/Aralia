import { describe, expect, it } from 'vitest';
import { AttackRiderSystem } from './AttackRiderSystem';
import type { ActiveRider, CombatState } from '../../types/combat';

/**
 * This file proves the shared attack-rider matcher used by next-attack spells.
 *
 * Lightning Arrow-style riders and future weapon riders depend on the same
 * matcher to decide which pending spell effects wake up after an attack. The
 * important boundary here is that an Unarmed Strike is not automatically a
 * held melee weapon: smite reaction prompts may opt into unarmed hits, but
 * ordinary weapon-only riders should not leak onto punches.
 *
 * Called by: focused Vitest checks for combat rider matching.
 * Depends on: AttackRiderSystem and the shared ActiveRider combat type.
 */

// ============================================================================
// Rider Fixtures
// ============================================================================
// These helpers keep the test focused on attack-family matching. The payload is
// intentionally minimal because this proof is about whether the rider wakes up,
// not about resolving damage after it matches.
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
  // TODO(lint-intent): Replace this broad payload cast when compact spell-effect fixtures expose every required default.
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
  // TODO(lint-intent): Replace this broad payload cast when compact spell-effect fixtures expose every required default.
  } as unknown as ActiveRider['effect'],
  consumption: 'per_instance_hit_or_miss',
  // TODO(lint-intent): Older spell adapters emitted `ranged_weapon`; keep this
  // fixture intentionally legacy-shaped until all rider JSON has one canonical
  // weapon-type label.
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
  // TODO(lint-intent): Replace this broad character cast when a minimal combat-state fixture exists for rider tests.
  } as unknown as CombatState['characters'][number]],
  currentTurn: 1,
  round: 1,
  turnOrder: ['attacker'],
  activeCharacterId: 'attacker',
  combatLog: [],
  reactiveTriggers: [],
  activeLightSources: []
// TODO(lint-intent): Replace this broad combat-state cast when test builders cover every optional combat field.
} as unknown as CombatState);

// ============================================================================
// Unarmed Strike Boundary
// ============================================================================
// The matcher should keep weapon riders narrow while the after-hit smite hook
// handles spell-specific Unarmed Strike opt-ins through castingTrigger metadata.
// ============================================================================

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

// ============================================================================
// Legacy Weapon-Type Filter Compatibility
// ============================================================================
// Next-attack riders have lived through multiple data shapes. The runtime
// context now reports compact `ranged` / `melee` labels, while older rider data
// may still carry `ranged_weapon` / `melee_weapon`. This proof keeps the shared
// matcher tolerant so Lightning Arrow-style riders do not miss their trigger.
// ============================================================================

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

// ============================================================================
// Hit-Or-Miss Rider Consumption
// ============================================================================
// Lightning Arrow spends its stored spell payload on the next matching ranged
// weapon attack whether that attack hits or misses. These checks prove the
// shared rider system removes that rider after matching, so a later attack
// cannot reuse the same spell payload.
// ============================================================================

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
