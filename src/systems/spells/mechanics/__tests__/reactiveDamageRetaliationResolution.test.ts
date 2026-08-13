/**
 * This file proves the ordered Hellish Rebuke transaction against real combat state.
 *
 * It covers once-only event identity, triggering damage before reaction checks,
 * canonical Reaction and slot payment, save-before-defense damage, sight and
 * range rejection, spent or incapacitated reactions, and downing on either side.
 *
 * Exercises: reactiveDamageRetaliationResolution.
 * Depends on: shared mock characters and the real line-of-sight map contract.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../types/combat';
import type { SpellSlots } from '../../../../types';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import { createMockCombatCharacter } from '../../../../utils/core';
import {
  HELLISH_REBUKE_BASE_LEVEL,
  HELLISH_REBUKE_RANGE_FEET,
  resolveReactiveDamageRetaliation,
} from '../reactiveDamageRetaliationResolution';

// ============================================================================
// Complete Board And Actor Fixtures
// ============================================================================
// The sixteen-by-twelve board matches Tactical Sandbox dimensions. One optional
// wall, one distant attacker, and exact HP/resources isolate every eligibility
// boundary without mocking the production sight or action-economy helpers.
// ============================================================================

const ATTACKER_ID = 'reactive-test-attacker';
const RETALIATOR_ID = 'reactive-test-retaliator';
const EVENT_ID = 'reactive-test-event-1';

function makeTile(x: number, y: number, blocksLoS = false): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: blocksLoS ? 'wall' : 'floor',
    elevation: 0,
    movementCost: blocksLoS ? 0 : 5,
    blocksMovement: blocksLoS,
    blocksLoS,
    decoration: null,
    effects: [],
  };
}

function makeMap(blockingPosition?: { x: number; y: number }): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();

  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const blocksLoS = blockingPosition?.x === x && blockingPosition.y === y;
      const tile = makeTile(x, y, blocksLoS);
      tiles.set(tile.id, tile);
    }
  }

  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'dungeon',
    seed: 36,
  };
}

function makeActors(): { attacker: CombatCharacter; retaliator: CombatCharacter } {
  const attacker = resetEconomy(createMockCombatCharacter({
    id: ATTACKER_ID,
    name: 'Blade Initiate',
    position: { x: 7, y: 5 },
    team: 'player',
    currentHP: 30,
    maxHP: 30,
    resistances: [],
    immunities: [],
    vulnerabilities: [],
  }));
  attacker.stats.dexterity = 10;
  attacker.savingThrowProficiencies = [];

  const retaliator = resetEconomy(createMockCombatCharacter({
    id: RETALIATOR_ID,
    name: 'Infernal Adept',
    position: { x: 2, y: 5 },
    team: 'enemy',
    level: 5,
    currentHP: 36,
    maxHP: 36,
    spellcastingAbility: 'charisma',
    spellSlots: makeLevelOneSpellSlots(),
  }));
  retaliator.stats.charisma = 16;

  return { attacker, retaliator };
}

function makeLevelOneSpellSlots(): SpellSlots {
  // The resolver test needs one stocked level-1 row and no hidden fallback
  // inventory. Supplying every row follows the complete production contract.
  return {
    level_1: { current: 1, max: 1 },
    level_2: { current: 0, max: 0 },
    level_3: { current: 0, max: 0 },
    level_4: { current: 0, max: 0 },
    level_5: { current: 0, max: 0 },
    level_6: { current: 0, max: 0 },
    level_7: { current: 0, max: 0 },
    level_8: { current: 0, max: 0 },
    level_9: { current: 0, max: 0 },
  };
}

function fixedDie(face: number, sides: number): () => number {
  return () => (face - 0.5) / sides;
}

function resolve(
  overrides: Partial<Parameters<typeof resolveReactiveDamageRetaliation>[0]> = {},
) {
  const actors = makeActors();
  return resolveReactiveDamageRetaliation({
    ...actors,
    mapData: makeMap(),
    event: {
      id: EVENT_ID,
      isHit: true,
      damage: 8,
      damageType: 'Slashing',
    },
    damageRng: fixedDie(6, 10),
    saveRng: fixedDie(5, 20),
    ...overrides,
  });
}

// ============================================================================
// Successful Once-Only Retaliation
// ============================================================================
// One qualifying hit must apply its own damage before the response, spend the
// canonical resources exactly once, then route the retaliation to the attacker.
// ============================================================================

describe('reactive damage retaliation successful ordering', () => {
  it('reads the canonical Hellish Rebuke range and spell level', () => {
    expect(HELLISH_REBUKE_RANGE_FEET).toBe(60);
    expect(HELLISH_REBUKE_BASE_LEVEL).toBe(1);
  });

  it('applies triggering damage first, pays Reaction and slot, then damages the attacker once', () => {
    const result = resolve();

    expect(result).toMatchObject({
      outcome: 'resolved',
      reason: 'resolved',
      distanceFeet: 25,
      lineOfSight: true,
      triggeringDamage: { raw: 8, final: 8, hpBefore: 36, hpAfter: 28 },
      retaliation: {
        spellId: 'hellish-rebuke',
        dice: '2d10',
        rolledDamage: 12,
        saveSucceeded: false,
        damageAfterSave: 12,
        finalDamage: 12,
        defense: 'none',
        hpBefore: 30,
        hpAfter: 18,
        attackerDowned: false,
      },
    });
    expect(result.retaliator.actionEconomy.reaction.used).toBe(true);
    expect(result.retaliator.spellSlots?.level_1.current).toBe(0);
    expect(result.order[0]).toContain('Triggering hit');
    expect(result.order[1]).toContain('spends Reaction');

    // Replaying the same event id uses the returned actors and receipt ledger.
    // Neither side may take a second copy of its damage or resource payment.
    const duplicate = resolveReactiveDamageRetaliation({
      attacker: result.attacker,
      retaliator: result.retaliator,
      mapData: makeMap(),
      event: {
        id: EVENT_ID,
        isHit: true,
        damage: 8,
        damageType: 'Slashing',
      },
      resolvedEventIds: result.resolvedEventIds,
      damageRng: fixedDie(6, 10),
      saveRng: fixedDie(5, 20),
    });

    expect(duplicate.reason).toBe('duplicate_event');
    expect(duplicate.retaliator.currentHP).toBe(28);
    expect(duplicate.attacker.currentHP).toBe(18);
    expect(duplicate.retaliator.spellSlots?.level_1.current).toBe(0);
  });
});

// ============================================================================
// Trigger, Targeting, And Resource Rejections
// ============================================================================
// Every rejected response preserves the Reaction, slot, and attacker HP. A hit
// can still damage the retaliator before range or sight makes the response fail.
// ============================================================================

describe('reactive damage retaliation rejection boundaries', () => {
  it('rejects a miss and a hit that deals no final damage without any response effect', () => {
    const miss = resolve({
      event: { id: 'miss', isHit: false, damage: 8, damageType: 'Slashing' },
    });
    const actors = makeActors();
    const noDamage = resolve({
      retaliator: { ...actors.retaliator, immunities: ['Slashing'] },
      event: { id: 'immune-hit', isHit: true, damage: 8, damageType: 'Slashing' },
    });

    expect(miss).toMatchObject({
      reason: 'attack_missed',
      attacker: { currentHP: 30 },
      retaliator: { currentHP: 36 },
    });
    expect(noDamage).toMatchObject({
      reason: 'no_triggering_damage',
      attacker: { currentHP: 30 },
      retaliator: { currentHP: 36 },
    });
    expect(miss.retaliator.actionEconomy.reaction.used).toBe(false);
    expect(noDamage.retaliator.spellSlots?.level_1.current).toBe(1);
  });

  it('applies the hit but rejects out-of-range and blocked-sight responses before payment', () => {
    const actors = makeActors();
    const outOfRange = resolve({
      attacker: { ...actors.attacker, position: { x: 15, y: 5 } },
      retaliator: { ...actors.retaliator, position: { x: 2, y: 5 } },
      event: { id: 'far-hit', isHit: true, damage: 8, damageType: 'Slashing' },
    });
    const blocked = resolve({
      mapData: makeMap({ x: 4, y: 5 }),
      event: { id: 'blocked-hit', isHit: true, damage: 8, damageType: 'Slashing' },
    });

    expect(outOfRange).toMatchObject({
      reason: 'attacker_out_of_range',
      distanceFeet: 65,
      attacker: { currentHP: 30 },
      retaliator: { currentHP: 28 },
    });
    expect(blocked).toMatchObject({
      reason: 'attacker_not_visible',
      lineOfSight: false,
      attacker: { currentHP: 30 },
      retaliator: { currentHP: 28 },
    });
    expect(outOfRange.retaliator.actionEconomy.reaction.used).toBe(false);
    expect(blocked.retaliator.spellSlots?.level_1.current).toBe(1);
  });

  it('blocks a spent Reaction, an incapacitated retaliator, and one downed by the triggering hit', () => {
    const actors = makeActors();
    const spent = resolve({
      retaliator: {
        ...actors.retaliator,
        actionEconomy: {
          ...actors.retaliator.actionEconomy,
          reaction: { ...actors.retaliator.actionEconomy.reaction, used: true },
        },
      },
      event: { id: 'spent-hit', isHit: true, damage: 8, damageType: 'Slashing' },
    });
    const incapacitated = resolve({
      retaliator: {
        ...actors.retaliator,
        conditions: [{
          name: 'Incapacitated',
          duration: { type: 'rounds', value: 1 },
          appliedTurn: 1,
          source: 'test',
        }],
      },
      event: { id: 'incapacitated-hit', isHit: true, damage: 8, damageType: 'Slashing' },
    });
    const downed = resolve({
      retaliator: { ...actors.retaliator, currentHP: 6 },
      event: { id: 'downing-hit', isHit: true, damage: 8, damageType: 'Slashing' },
    });

    expect(spent.reason).toBe('reaction_or_slot_unavailable');
    expect(incapacitated.reason).toBe('retaliator_incapacitated');
    expect(downed).toMatchObject({
      reason: 'retaliator_downed',
      retaliator: { currentHP: 0 },
      attacker: { currentHP: 30 },
    });
    expect(spent.attacker.currentHP).toBe(30);
    expect(incapacitated.retaliator.spellSlots?.level_1.current).toBe(1);
    expect(downed.retaliator.actionEconomy.reaction.used).toBe(false);
  });

  it.each([0, -1, 1.5, 10])(
    'rejects invalid cast level %s after the triggering hit without spending response resources',
    (castAtLevel) => {
      const result = resolve({ castAtLevel });

      // The attack and its once-only event receipt remain committed because
      // cast-level validation belongs to the response, not the triggering hit.
      expect(result).toMatchObject({
        outcome: 'rejected',
        reason: 'invalid_cast_level',
        attacker: { currentHP: 30 },
        retaliator: { currentHP: 28 },
        resolvedEventIds: [EVENT_ID],
        triggeringDamage: { raw: 8, final: 8, hpBefore: 36, hpAfter: 28 },
      });
      expect(result.retaliator.actionEconomy.reaction.used).toBe(false);
      expect(result.retaliator.spellSlots?.level_1.current).toBe(1);
      expect(result.retaliation).toBeUndefined();
    },
  );

  it('does not let the Dev Player unlimited-slot marker legalize cast level 0', () => {
    const actors = makeActors();
    const unlimitedRetaliator = {
      ...actors.retaliator,
      devPlaytest: { unlimitedSpellSlots: true },
    } as CombatCharacter;
    const result = resolve({ retaliator: unlimitedRetaliator, castAtLevel: 0 });

    expect(result.reason).toBe('invalid_cast_level');
    expect(result.retaliator.currentHP).toBe(28);
    expect(result.attacker.currentHP).toBe(30);
    expect(result.retaliator.actionEconomy.reaction.used).toBe(false);
    expect(result.retaliator.spellSlots?.level_1.current).toBe(1);
  });

  it('accepts the canonical level 1 and pays its Reaction and slot', () => {
    const result = resolve({ castAtLevel: HELLISH_REBUKE_BASE_LEVEL });

    expect(result.reason).toBe('resolved');
    expect(result.retaliator.actionEconomy.reaction.used).toBe(true);
    expect(result.retaliator.spellSlots?.level_1.current).toBe(0);
  });
});

// ============================================================================
// Save, Defense, And Attacker Downing
// ============================================================================
// Save reduction happens before resistance or immunity. A fragile player actor
// also proves that final reactive damage travels through the shared downing path.
// ============================================================================

describe('reactive damage retaliation damage pipeline', () => {
  it('applies resistance and immunity after the failed save damage total', () => {
    const actors = makeActors();
    const resistant = resolve({
      attacker: { ...actors.attacker, resistances: ['Fire'] },
      event: { id: 'resistant-hit', isHit: true, damage: 8, damageType: 'Slashing' },
    });
    const immune = resolve({
      attacker: { ...actors.attacker, immunities: ['Fire'] },
      event: { id: 'immune-retaliation-hit', isHit: true, damage: 8, damageType: 'Slashing' },
    });

    expect(resistant.retaliation).toMatchObject({
      rolledDamage: 12,
      damageAfterSave: 12,
      finalDamage: 6,
      defense: 'resistance',
      hpAfter: 24,
    });
    expect(immune.retaliation).toMatchObject({
      rolledDamage: 12,
      damageAfterSave: 12,
      finalDamage: 0,
      defense: 'immunity',
      hpAfter: 30,
    });
  });

  it('halves on a successful save before resistance and can down a fragile attacker', () => {
    const actors = makeActors();
    const savedAndResisted = resolve({
      attacker: { ...actors.attacker, resistances: ['Fire'] },
      event: { id: 'saved-hit', isHit: true, damage: 8, damageType: 'Slashing' },
      saveRng: fixedDie(18, 20),
    });
    const fragile = resolve({
      attacker: { ...actors.attacker, currentHP: 10, maxHP: 30 },
      event: { id: 'fragile-hit', isHit: true, damage: 8, damageType: 'Slashing' },
    });

    expect(savedAndResisted.retaliation).toMatchObject({
      saveSucceeded: true,
      rolledDamage: 12,
      damageAfterSave: 6,
      finalDamage: 3,
      defense: 'resistance',
    });
    expect(fragile.retaliation).toMatchObject({
      finalDamage: 12,
      hpBefore: 10,
      hpAfter: 0,
      attackerDowned: true,
    });
    expect(fragile.attacker.conditions?.map(condition => condition.name)).toContain('Unconscious');
  });
});
