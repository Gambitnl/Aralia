import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasSpellInterruptionLineOfSight, hasSpellInterruptionVisibility } from '../useAbilitySystem';
import * as lineOfSightUtils from '../../utils/lineOfSight';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../types/combat';
import counterspell from '../../../public/data/spells/level-3/counterspell.json';

/**
 * This file proves the Counterspell visibility boundary that sits inside the
 * shared spell-interruption gate.
 *
 * Counterspell is not a normal target picker: it fires while another creature
 * is casting. The hook helper covered here decides whether the reacting
 * creature can actually see that caster on a populated battle map, while still
 * preserving older range-only behavior for mapless encounters.
 *
 * Called by: useAbilitySystem.ts before it offers Counterspell as a reaction.
 * Depends on: the shared line-of-sight helper used by map targeting.
 */

vi.mock('../../utils/lineOfSight', () => ({
  hasLineOfSight: vi.fn(() => true)
}));

// ============================================================================
// Test Fixtures
// ============================================================================
// These helpers build only the pieces the visibility gate reads. Keeping the
// fixtures small protects the test from unrelated combat-sheet details while
// still using the real public combat types at the helper boundary.
// ============================================================================

const makeCharacterAt = (id: string, x: number, y: number): CombatCharacter => ({
  id,
  name: id,
  position: { x, y },
  currentHP: 10,
  maxHP: 10
} as unknown as CombatCharacter);

const makeTile = (x: number, y: number, blocksLoS = false): BattleMapTile => ({
  id: `${x}-${y}`,
  coordinates: { x, y },
  terrain: blocksLoS ? 'wall' : 'floor',
  elevation: 0,
  movementCost: blocksLoS ? 0 : 1,
  blocksLoS,
  blocksMovement: blocksLoS,
  decoration: null,
  effects: []
});

const makeMap = (tiles: BattleMapTile[]): BattleMapData => ({
  dimensions: { width: 5, height: 5 },
  tiles: new Map(tiles.map(tile => [tile.id, tile])),
  theme: 'dungeon',
  seed: 1
});

// ============================================================================
// Counterspell Visibility Boundary
// ============================================================================
// These checks cover the shared helper instead of a one-off Counterspell branch.
// The full hook prompt flow still needs to run before the tracker row can close.
// ============================================================================

describe('hasSpellInterruptionLineOfSight', () => {
  beforeEach(() => {
    // Each case starts with ordinary visibility allowed. Individual blocked-map
    // cases override this so the test describes exactly which boundary changed.
    vi.clearAllMocks();
    vi.mocked(lineOfSightUtils.hasLineOfSight).mockReturnValue(true);
  });

  it('uses map line of sight to reject a blocked Counterspell reaction', () => {
    const reactor = makeCharacterAt('reactor', 0, 0);
    const caster = makeCharacterAt('caster', 2, 0);
    const mapData = makeMap([makeTile(0, 0), makeTile(1, 0, true), makeTile(2, 0)]);

    // A wall or other opaque obstacle should prevent the reaction prompt when
    // the grid has enough data to answer visibility authoritatively.
    vi.mocked(lineOfSightUtils.hasLineOfSight).mockReturnValue(false);

    expect(hasSpellInterruptionLineOfSight(reactor, caster, mapData)).toBe(false);
    expect(lineOfSightUtils.hasLineOfSight).toHaveBeenCalledWith(
      mapData.tiles.get('0-0'),
      mapData.tiles.get('2-0'),
      mapData
    );
  });

  it('allows Counterspell visibility when the populated map path is clear', () => {
    const reactor = makeCharacterAt('reactor', 0, 0);
    const caster = makeCharacterAt('caster', 2, 0);
    const mapData = makeMap([makeTile(0, 0), makeTile(1, 0), makeTile(2, 0)]);

    // Clear map visibility keeps Counterspell eligible; range and resource
    // checks happen in the surrounding shared interruption gate.
    expect(hasSpellInterruptionLineOfSight(reactor, caster, mapData)).toBe(true);
  });

  it('preserves range-only behavior when no map authority exists', () => {
    const reactor = makeCharacterAt('reactor', 0, 0);
    const caster = makeCharacterAt('caster', 2, 0);

    // Theater-of-the-mind encounters do not have obstacle data, so this helper
    // must not silently disable every Counterspell prompt.
    expect(hasSpellInterruptionLineOfSight(reactor, caster, null)).toBe(true);
    expect(lineOfSightUtils.hasLineOfSight).not.toHaveBeenCalled();
  });

  it('preserves range-only behavior when either combatant tile is missing', () => {
    const reactor = makeCharacterAt('reactor', 0, 0);
    const caster = makeCharacterAt('caster', 2, 0);
    const mapData = makeMap([makeTile(0, 0)]);

    // Some tests and partially migrated encounters have positions before their
    // tile map is fully populated. The helper keeps those legacy cases playable
    // instead of treating missing data as a blocked spell reaction.
    expect(hasSpellInterruptionLineOfSight(reactor, caster, mapData)).toBe(true);
    expect(lineOfSightUtils.hasLineOfSight).not.toHaveBeenCalled();
  });
});

describe('hasSpellInterruptionVisibility', () => {
  beforeEach(() => {
    // Visibility checks include both creature status and map obstacles. Reset
    // the map helper so each case states which side of that boundary matters.
    vi.clearAllMocks();
    vi.mocked(lineOfSightUtils.hasLineOfSight).mockReturnValue(true);
  });

  it('rejects Counterspell when the caster is Invisible even if the map path is clear', () => {
    const reactor = makeCharacterAt('reactor', 0, 0);
    const caster = {
      ...makeCharacterAt('caster', 2, 0),
      statusEffects: [{
        id: 'invisible',
        name: 'Invisible',
        type: 'buff',
        duration: 10
      }]
    } as CombatCharacter;
    const mapData = makeMap([makeTile(0, 0), makeTile(1, 0), makeTile(2, 0)]);

    // This is the missing "visible creature" boundary: line of sight alone is
    // not enough when the caster has the Invisible status effect.
    expect(hasSpellInterruptionVisibility(reactor, caster, mapData)).toBe(false);
    expect(lineOfSightUtils.hasLineOfSight).not.toHaveBeenCalled();
  });

  it('rejects Counterspell when the caster is explicitly Hidden even if the map path is clear', () => {
    const reactor = makeCharacterAt('reactor', 0, 0);
    const caster = {
      ...makeCharacterAt('caster', 2, 0),
      statusEffects: [{
        id: 'hidden',
        name: 'Hidden',
        type: 'buff',
        duration: 1
      }]
    } as CombatCharacter;
    const mapData = makeMap([makeTile(0, 0), makeTile(1, 0), makeTile(2, 0)]);

    // Hidden is not the same condition as Invisible, but for this reaction
    // trigger it still means the reactor cannot see the spell being cast.
    expect(hasSpellInterruptionVisibility(reactor, caster, mapData)).toBe(false);
    expect(lineOfSightUtils.hasLineOfSight).not.toHaveBeenCalled();
  });

  it('rejects Counterspell when the caster is Invisible through the structured condition mirror', () => {
    const reactor = makeCharacterAt('reactor', 0, 0);
    const caster = {
      ...makeCharacterAt('caster', 2, 0),
      conditions: [{
        name: 'Invisible',
        duration: { type: 'rounds', value: 1 },
        appliedTurn: 1,
        source: 'Greater Invisibility'
      }]
    } as CombatCharacter;
    const mapData = makeMap([makeTile(0, 0), makeTile(1, 0), makeTile(2, 0)]);

    // Some spell commands write the newer structured condition record instead
    // of only the legacy statusEffects list. Counterspell's visibility rule
    // must treat either surface as proof that the caster cannot be seen.
    expect(hasSpellInterruptionVisibility(reactor, caster, mapData)).toBe(false);
    expect(lineOfSightUtils.hasLineOfSight).not.toHaveBeenCalled();
  });

  it('falls back to line-of-sight visibility when the caster is not Invisible', () => {
    const reactor = makeCharacterAt('reactor', 0, 0);
    const caster = makeCharacterAt('caster', 2, 0);
    const mapData = makeMap([makeTile(0, 0), makeTile(1, 0), makeTile(2, 0)]);

    // Ordinary visible casters still use the map line so Counterspell keeps the
    // blocked-wall behavior proved above.
    expect(hasSpellInterruptionVisibility(reactor, caster, mapData)).toBe(true);
    expect(lineOfSightUtils.hasLineOfSight).toHaveBeenCalledWith(
      mapData.tiles.get('0-0'),
      mapData.tiles.get('2-0'),
      mapData
    );
  });
});

// ============================================================================
// Counterspell Spell-Data Contract
// ============================================================================
// The runtime helper above only works if the live spell data keeps its reaction
// cost, trigger, range, visibility, and save policy aligned. This focused check
// protects the data contract without pretending to prove the full hook prompt
// and command-cancellation flow.
// ============================================================================

describe('Counterspell interruption data contract', () => {
  it('keeps reaction cost text aligned with the shared interruption trigger', () => {
    expect(counterspell.castingTime.combatCost).toEqual(expect.objectContaining({
      type: 'reaction',
      condition: 'when you see a creature within 60 feet of you casting a spell'
    }));
    expect(counterspell.castingTrigger).toEqual(expect.objectContaining({
      type: 'when_visible_creature_casts_spell',
      requiredCost: 'reaction',
      maxRangeFeet: 60,
      targetBinding: 'triggering_spell_caster'
    }));
    expect(counterspell.interruptionState).toEqual(expect.objectContaining({
      saveType: 'Constitution',
      failureOutcome: 'spell_has_no_effect',
      visibilityRequired: true,
      rangeFeet: 60,
      slotPolicy: 'interrupted_spell_slot_is_not_expended',
      preservesInterruptedSlot: true
    }));
    expect(counterspell.effects).toEqual([]);
  });
});
