/**
 * This file proves one complete save-based area spell transaction.
 *
 * Canonical Fireball and Burning Hands data drive shape, origin, dimensions,
 * saves, damage, and payment. The tests cover exact boundary membership,
 * occupied creature footprints, once-only target resolution, blockers,
 * defenses, temporary hit points, downing, invalid placement, and stable event
 * replay without substituting scenario-owned spell arithmetic.
 *
 * Called by: focused Vitest spell-mechanics acceptance.
 * Depends on: areaDamageSpellCastResolution and canonical spell JSON.
 */

import { describe, expect, it, vi } from 'vitest';
import burningHandsData from '../../../../data/spells/level-1/burning-hands.json';
import fireballData from '../../../../data/spells/level-3/fireball.json';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  TurnState,
} from '../../../../types/combat';
import type { Spell } from '../../../../types/spells';
import { createMockCombatCharacter } from '../../../../utils/core';
import {
  createAreaDamageSpellCastAction,
  resolveAreaDamageSpellCast,
} from '../areaDamageSpellCastResolution';

const FIREBALL = fireballData as unknown as Spell;
const BURNING_HANDS = burningHandsData as unknown as Spell;
const CASTER_ID = 'area-caster';
const INSIDE_ID = 'inside-target';
const BOUNDARY_ID = 'boundary-target';
const OUTSIDE_ID = 'outside-target';

// ============================================================================
// Deterministic Production-Shaped Board
// ============================================================================
// The board is wide enough for Fireball's exact 20-foot boundary and for the
// fifteen-foot cone in each cardinal direction used below.
// ============================================================================

function createTile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'floor',
    elevation: 0,
    movementCost: 1,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < 18; x += 1) {
    for (let y = 0; y < 12; y += 1) {
      tiles.set(`${x}-${y}`, createTile(x, y));
    }
  }
  return { dimensions: { width: 18, height: 12 }, tiles, theme: 'dungeon', seed: 8 };
}

function createTurn(): TurnState {
  return {
    currentTurn: 1,
    turnOrder: [CASTER_ID, INSIDE_ID, BOUNDARY_ID, OUTSIDE_ID],
    currentCharacterId: CASTER_ID,
    phase: 'action',
    actionsThisTurn: [],
  };
}

function createActors(spell: Spell = FIREBALL): CombatCharacter[] {
  const caster = createMockCombatCharacter({
    id: CASTER_ID,
    name: 'Area Caster',
    team: 'player',
    level: 7,
    position: { x: 3, y: 5 },
    facing: 'east',
    spellcastingAbility: 'intelligence',
    spellSlots: {
      level_1: { current: 1, max: 1 },
      level_3: { current: 1, max: 1 },
    },
  });
  caster.stats.intelligence = 18;
  caster.abilities = [createAreaDamageSpellCastAction(spell, caster, spell.level).ability];

  const makeTarget = (id: string, position: { x: number; y: number }) => {
    const target = createMockCombatCharacter({
      id,
      name: id,
      team: 'enemy',
      position,
      currentHP: 60,
      maxHP: 60,
    });
    target.stats.dexterity = 8;
    target.savingThrowProficiencies = [];
    return target;
  };

  return [
    caster,
    makeTarget(INSIDE_ID, { x: 8, y: 5 }),
    makeTarget(BOUNDARY_ID, { x: 12, y: 5 }),
    makeTarget(OUTSIDE_ID, { x: 13, y: 5 }),
  ];
}

function actor(characters: CombatCharacter[], id: string): CombatCharacter {
  const found = characters.find(character => character.id === id);
  if (!found) throw new Error(`Missing area spell actor ${id}.`);
  return found;
}

function fixedDie(face: number, sides: number): number {
  return (face - 0.5) / sides;
}

function createInput(
  characters = createActors(),
  spell: Spell = FIREBALL,
  eventId = 'area-event-1',
) {
  const caster = actor(characters, CASTER_ID);
  return {
    characters,
    mapData: createMap(),
    turnState: createTurn(),
    casterId: CASTER_ID,
    placement: spell.id === BURNING_HANDS.id ? caster.position : { x: 8, y: 5 },
    action: createAreaDamageSpellCastAction(spell, caster, spell.level),
    executionEventId: eventId,
    processedEventIds: new Set<string>(),
    damageRng: () => fixedDie(4, 6),
    saveRng: (target: CombatCharacter) => fixedDie(
      target.id === BOUNDARY_ID ? 18 : 5,
      20,
    ),
  };
}

// ============================================================================
// Exact Shape Membership And Once-Only Resolution
// ============================================================================
// Fireball includes the fourth tile from its center and excludes the fifth.
// One spell damage roll is shared, while each included creature saves once.
// ============================================================================

describe('resolveAreaDamageSpellCast membership and payment', () => {
  it('resolves exact sphere boundary cells and pays Action and slot once', () => {
    const characters = createActors();
    const damageRng = vi.fn(() => fixedDie(4, 6));
    const saveRng = vi.fn((target: CombatCharacter) => fixedDie(
      target.id === BOUNDARY_ID ? 18 : 5,
      20,
    ));
    const result = resolveAreaDamageSpellCast({
      ...createInput(characters),
      damageRng,
      saveRng,
    });

    expect(result).toMatchObject({
      status: 'resolved',
      reason: 'resolved',
      rolledDamage: 32,
      includedTargetIds: [INSIDE_ID, BOUNDARY_ID],
      excludedTargetIds: [OUTSIDE_ID],
      geometry: {
        shape: 'Sphere',
        origin: { x: 8, y: 5 },
        size: 20,
      },
    });
    expect(result.affectedTiles).toContainEqual({ x: 12, y: 5 });
    expect(result.affectedTiles).not.toContainEqual({ x: 13, y: 5 });
    expect(result.targetResults).toEqual([
      expect.objectContaining({ targetId: INSIDE_ID, saveSucceeded: false, finalDamage: 32 }),
      expect.objectContaining({ targetId: BOUNDARY_ID, saveSucceeded: true, finalDamage: 16 }),
    ]);
    expect(damageRng).toHaveBeenCalledTimes(8);
    expect(saveRng).toHaveBeenCalledTimes(2);
    expect(actor(result.characters, CASTER_ID).actionEconomy.action.used).toBe(true);
    expect(actor(result.characters, CASTER_ID).spellSlots?.level_3?.current).toBe(0);
    expect(actor(result.characters, INSIDE_ID).currentHP).toBe(28);
    expect(actor(result.characters, BOUNDARY_ID).currentHP).toBe(44);
    expect(actor(result.characters, OUTSIDE_ID).currentHP).toBe(60);
  });

  it('resolves a Large target once even when several occupied cells intersect the area', () => {
    const characters = createActors();
    const boundary = actor(characters, BOUNDARY_ID);
    boundary.stats.size = 'Large';
    const saveRng = vi.fn(() => fixedDie(5, 20));

    const result = resolveAreaDamageSpellCast({
      ...createInput(characters),
      saveRng,
    });

    expect(result.includedTargetIds).toEqual([INSIDE_ID, BOUNDARY_ID]);
    expect(result.targetResults.filter(entry => entry.targetId === BOUNDARY_ID)).toHaveLength(1);
    expect(saveRng).toHaveBeenCalledTimes(2);
    expect(actor(result.characters, BOUNDARY_ID).currentHP).toBe(28);
  });
});

// ============================================================================
// Origin, Orientation, And Blocker Policy
// ============================================================================
// Burning Hands originates on the caster and takes orientation from facing.
// Fireball needs sight to its chosen point; current rules do not propagate that
// sight blocker from the point outward to individual creatures in the sphere.
// ============================================================================

describe('resolveAreaDamageSpellCast origin and blockers', () => {
  it('rotates the same canonical cone from east to north with exact boundary cells', () => {
    const eastActors = createActors(BURNING_HANDS);
    actor(eastActors, INSIDE_ID).position = { x: 4, y: 5 };
    actor(eastActors, BOUNDARY_ID).position = { x: 6, y: 5 };
    actor(eastActors, OUTSIDE_ID).position = { x: 7, y: 5 };
    const east = resolveAreaDamageSpellCast(createInput(eastActors, BURNING_HANDS));

    expect(east.geometry).toMatchObject({
      shape: 'Cone',
      origin: { x: 3, y: 5 },
      direction: 90,
      size: 15,
    });
    expect(east.includedTargetIds).toEqual([INSIDE_ID, BOUNDARY_ID]);
    expect(east.excludedTargetIds).toEqual([OUTSIDE_ID]);

    const northActors = createActors(BURNING_HANDS);
    actor(northActors, CASTER_ID).facing = 'north';
    actor(northActors, INSIDE_ID).position = { x: 3, y: 4 };
    actor(northActors, BOUNDARY_ID).position = { x: 3, y: 2 };
    actor(northActors, OUTSIDE_ID).position = { x: 3, y: 1 };
    const north = resolveAreaDamageSpellCast(createInput(northActors, BURNING_HANDS));

    expect(north.geometry).toMatchObject({ direction: 0, origin: { x: 3, y: 5 } });
    expect(north.includedTargetIds).toEqual([INSIDE_ID, BOUNDARY_ID]);
    expect(north.excludedTargetIds).toEqual([OUTSIDE_ID]);
  });

  it('rejects a blocked Fireball placement but does not invent propagation cover beyond the origin', () => {
    const blockedInput = createInput();
    const blockedTile = blockedInput.mapData.tiles.get('6-5');
    if (!blockedTile) throw new Error('Missing placement blocker tile.');
    blockedTile.blocksLoS = true;
    const blockedDamage = vi.fn(() => fixedDie(4, 6));
    const blocked = resolveAreaDamageSpellCast({ ...blockedInput, damageRng: blockedDamage });

    expect(blocked).toMatchObject({ status: 'rejected', reason: 'invalid_placement:line_of_sight_blocked' });
    expect(blocked.characters).toBe(blockedInput.characters);
    expect(blockedDamage).not.toHaveBeenCalled();

    const openInput = createInput();
    const internalWall = openInput.mapData.tiles.get('10-5');
    if (!internalWall) throw new Error('Missing internal blocker tile.');
    internalWall.blocksLoS = true;
    const resolved = resolveAreaDamageSpellCast(openInput);

    expect(resolved.status).toBe('resolved');
    expect(resolved.includedTargetIds).toEqual([INSIDE_ID, BOUNDARY_ID]);
  });
});

// ============================================================================
// Saves, Defenses, Temporary HP, And Downing
// ============================================================================
// Save damage settles before defenses. The shared downing helper then absorbs
// temporary HP and owns the Unconscious transition at zero hit points.
// ============================================================================

describe('resolveAreaDamageSpellCast target outcomes', () => {
  it('applies resistance, immunity, temporary HP, and downing per target', () => {
    const characters = createActors();
    const inside = actor(characters, INSIDE_ID);
    inside.resistances = ['Fire'];
    const boundary = actor(characters, BOUNDARY_ID);
    boundary.immunities = ['Fire'];
    const outside = actor(characters, OUTSIDE_ID);
    outside.position = { x: 9, y: 5 };
    outside.team = 'player';
    outside.currentHP = 15;
    outside.tempHP = 10;

    const result = resolveAreaDamageSpellCast({
      ...createInput(characters),
      saveRng: () => fixedDie(5, 20),
    });

    expect(result.targetResults).toEqual([
      expect.objectContaining({ targetId: INSIDE_ID, damageAfterSave: 32, finalDamage: 16 }),
      expect.objectContaining({ targetId: BOUNDARY_ID, damageAfterSave: 32, finalDamage: 0 }),
      expect.objectContaining({ targetId: OUTSIDE_ID, damageAfterSave: 32, finalDamage: 32 }),
    ]);
    expect(actor(result.characters, INSIDE_ID).currentHP).toBe(44);
    expect(actor(result.characters, BOUNDARY_ID).currentHP).toBe(60);
    expect(actor(result.characters, OUTSIDE_ID)).toMatchObject({ currentHP: 0, tempHP: 0 });
    expect(actor(result.characters, OUTSIDE_ID).statusEffects.map(effect => effect.name)).toContain('Unconscious');
  });
});

// ============================================================================
// Atomic Invalid And Replayed Events
// ============================================================================
// Every validity gate runs before dice, payment, HP, or event-claim mutation.
// A successful event id is returned as claimed and cannot resolve a second time.
// ============================================================================

describe('resolveAreaDamageSpellCast atomic events', () => {
  it('rejects invalid placement and malformed event ids as identity-preserving no-ops', () => {
    const offBoardInput = createInput();
    offBoardInput.placement = { x: 99, y: 99 };
    const damageRng = vi.fn(() => fixedDie(4, 6));
    const saveRng = vi.fn(() => fixedDie(5, 20));
    const offBoard = resolveAreaDamageSpellCast({ ...offBoardInput, damageRng, saveRng });

    expect(offBoard).toMatchObject({ status: 'rejected', reason: 'invalid_placement:off_map' });
    expect(offBoard.characters).toBe(offBoardInput.characters);
    expect(offBoard.processedEventIds).toEqual([]);
    expect(damageRng).not.toHaveBeenCalled();
    expect(saveRng).not.toHaveBeenCalled();

    const invalidEventInput = createInput(createActors(), FIREBALL, '   ');
    const invalidEvent = resolveAreaDamageSpellCast(invalidEventInput);
    expect(invalidEvent).toMatchObject({ status: 'rejected', reason: 'invalid_event_id' });
    expect(invalidEvent.characters).toBe(invalidEventInput.characters);
  });

  it('claims one successful event and rejects its replay before another roll or payment', () => {
    const first = resolveAreaDamageSpellCast(createInput());
    const damageRng = vi.fn(() => fixedDie(4, 6));
    const saveRng = vi.fn(() => fixedDie(5, 20));
    const replay = resolveAreaDamageSpellCast({
      ...createInput(first.characters),
      processedEventIds: new Set(first.processedEventIds),
      damageRng,
      saveRng,
    });

    expect(first.processedEventIds).toEqual(['area-event-1']);
    expect(replay).toMatchObject({ status: 'rejected', reason: 'replayed_event' });
    expect(replay.characters).toBe(first.characters);
    expect(damageRng).not.toHaveBeenCalled();
    expect(saveRng).not.toHaveBeenCalled();
    expect(actor(replay.characters, CASTER_ID).spellSlots?.level_3?.current).toBe(0);
    expect(actor(replay.characters, INSIDE_ID).currentHP).toBe(28);
  });
});
