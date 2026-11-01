/** Tests prepayment refusal and disk-follow thresholds without React or event delivery. */
import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatAction, CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import { planTenserDiskFollow, prepareActionMovement } from '../actionMovementPlanning';

const move = (characterId: string): CombatAction => ({
  id: 'move-1', characterId, type: 'move', targetPosition: { x: 1, y: 0 },
  cost: { type: 'movement-only', movementCost: 5 }, timestamp: 1,
});
const sources = () => {
  const calls: string[] = [];
  return { calls, generateId: () => { calls.push('id'); return 'refusal'; }, now: () => { calls.push('clock'); return 100; } };
};
const disk = (weight: number): CombatCharacter => createMockCombatCharacter({
  id: 'disk', position: { x: 0, y: 0 },
  summonMetadata: { spellId: 'tensers-floating-disk', casterId: 'caster', carriedWeightPounds: weight } as CombatCharacter['summonMetadata'],
});

describe('action movement planning', () => {
  it('does not spend or move when a living occupant blocks the destination', () => {
    const actor = createMockCombatCharacter({ id: 'actor' });
    const blocker = createMockCombatCharacter({ id: 'blocker', position: { x: 1, y: 0 } });
    const before = structuredClone(actor);
    const receipts = sources();
    const action = move(actor.id);
    const plan = prepareActionMovement(actor, action, [actor, blocker], null, receipts);
    expect(plan.rejection).toMatchObject({ targetIds: ['blocker'], timestamp: 100 });
    expect(plan.resolvedAction).toBe(action);
    expect(actor).toEqual(before);
    expect(receipts.calls).toEqual(['id', 'clock']);
  });

  it('does not treat a downed occupant as a living blocker or consume a receipt', () => {
    const actor = createMockCombatCharacter({ id: 'actor' });
    const blocker = createMockCombatCharacter({ id: 'blocker', currentHP: 0, position: { x: 1, y: 0 } });
    const receipts = sources();
    expect(prepareActionMovement(actor, move(actor.id), [actor, blocker], null, receipts).rejection).toBeUndefined();
    expect(receipts.calls).toEqual([]);
  });

  it('rejects a route crossing its protective circle before occupancy checks', () => {
    const actor = createMockCombatCharacter({ id: 'actor' });
    actor.summonMetadata = { bloodCircle: { protectedTiles: [{ x: 1, y: 0 }] } } as CombatCharacter['summonMetadata'];
    const result = prepareActionMovement(actor, move(actor.id), [actor], null, sources());
    expect(result.rejection?.data).toMatchObject({ bloodCircle: 'movement_blocked' });
    expect(actor.position).toEqual({ x: 0, y: 0 });
  });

  it('keeps a disk at the exact load limit and removes it only above that limit', () => {
    const caster = createMockCombatCharacter({ id: 'caster' });
    expect(planTenserDiskFollow(disk(500), caster, { x: 0, y: 0 }, null)).toEqual({ kind: 'stay' });
    const removed = planTenserDiskFollow(disk(501), caster, { x: 0, y: 0 }, null);
    expect(removed).toMatchObject({ kind: 'remove', id: 'disk', log: { data: { carriedWeightPounds: 501, maxLoadPounds: 500 } } });
  });

  it('follows beyond the immobile radius and leaves the original disk untouched', () => {
    const original = disk(0);
    const caster = createMockCombatCharacter({ id: 'caster' });
    const result = planTenserDiskFollow(original, caster, { x: 10, y: 0 }, null);
    expect(result).toMatchObject({ kind: 'update', character: { position: { x: 6, y: 0 } } });
    expect(original.position).toEqual({ x: 0, y: 0 });
  });

  it('retains the inclusive elevation barrier and its existing boolean log payload', () => {
    const caster = createMockCombatCharacter({ id: 'caster' });
    const map = { tiles: new Map([
      ['origin', { coordinates: { x: 0, y: 0 }, elevation: 0 } as BattleMapTile],
      ['destination', { coordinates: { x: 10, y: 0 }, elevation: 10 } as BattleMapTile],
    ]) } as BattleMapData;
    expect(planTenserDiskFollow(disk(0), caster, { x: 10, y: 0 }, map)).toMatchObject({
      kind: 'remove', log: { data: { cannotCrossElevationChangeFeet: true } },
    });
  });
});
