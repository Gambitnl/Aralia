/**
 * This file proves the production Hide lifecycle with deterministic combat facts.
 *
 * The fixtures exercise eligibility, skill-vs-Perception resolution, exact
 * Hidden ownership, movement reveals, and stable event replay. They deliberately
 * keep an unrelated Hidden source beside the Hide-derived record so a broad
 * status cleanup cannot pass unnoticed.
 *
 * Called by: focused Vitest proof for the Stealth & Hidden scenario.
 * Depends on: stealthResolution and the shared combat-character factory.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter, StatusEffect } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import {
  resolveHideAttempt,
  resolveHiddenMovement,
  resolveStealthObservation,
} from '../stealthResolution';

// ============================================================================
// Deterministic Map And Actor Facts
// ============================================================================
// The bright board contains two covered bush tiles and one exposed destination.
// The hider's fixed d20 result of 8 plus Dexterity and proficiency makes DC 14.
// ============================================================================

const OWNER_ID = 'stealth-hidden-scenario';
const STATUS_ID = 'stealth-hidden-owned';
const UNRELATED_HIDDEN: StatusEffect = {
  id: 'unrelated-hidden',
  name: 'Hidden',
  type: 'buff',
  duration: 3,
  source: 'another-feature',
};

function createTile(x: number, y: number, providesCover = false): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: providesCover ? 'forest' : 'floor',
    elevation: 0,
    movementCost: 5,
    blocksLoS: false,
    blocksMovement: false,
    providesCover,
    decoration: null,
    effects: [],
  };
}

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const covered = y === 5 && (x === 5 || x === 10);
      const tile = createTile(x, y, covered);
      tiles.set(tile.id, tile);
    }
  }
  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'forest',
    seed: 238,
  };
}

function createObserver(wisdom = 12): CombatCharacter {
  return createMockCombatCharacter({
    id: 'observer',
    name: 'Observer',
    level: 5,
    team: 'player',
    position: { x: 3, y: 5 },
    stats: {
      wisdom,
      senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0 },
    },
  });
}

function createHider(position = { x: 10, y: 5 }): CombatCharacter {
  return createMockCombatCharacter({
    id: 'hider',
    name: 'Hider',
    level: 5,
    team: 'enemy',
    position,
    statusEffects: [UNRELATED_HIDDEN],
    stats: { dexterity: 16, speed: 30 },
    modifiers: { skillProficiencies: ['stealth'] },
  });
}

function hide(hider = createHider(), eventId = 'hide-1') {
  const observer = createObserver();
  return resolveHideAttempt({
    hider,
    observer,
    characters: [observer, hider],
    mapData: createMap(),
    activeLightSources: [],
    ownerId: OWNER_ID,
    statusId: STATUS_ID,
    eventId,
    rng: () => 0.37,
  });
}

// ============================================================================
// Hide Eligibility, Ownership, And Replay
// ============================================================================
// Rejected events are atomic. Successful events pay one Action and replace only
// the status with this owner. Re-delivering the same id changes nothing.
// ============================================================================

describe('resolveHideAttempt', () => {
  it('rejects Hide in visible open ground without spending the Action', () => {
    const hider = createHider({ x: 8, y: 5 });
    const observer = createObserver();
    const result = resolveHideAttempt({
      hider,
      observer,
      characters: [observer, hider],
      mapData: createMap(),
      activeLightSources: [],
      ownerId: OWNER_ID,
      statusId: STATUS_ID,
      eventId: 'hide-open',
      rng: () => 0.37,
    });

    expect(result.outcome).toBe('rejected');
    expect(result.reason).toContain('visible in open ground');
    expect(result.character).toBe(hider);
    expect(result.character.actionEconomy.action.used).toBe(false);
  });

  it('applies DC 14 Hidden from cover, spends Action, and preserves unrelated Hidden', () => {
    const result = hide();

    expect(result).toMatchObject({ outcome: 'applied', roll: 8, total: 14 });
    expect(result.character.actionEconomy.action.used).toBe(true);
    expect(result.character.statusEffects).toEqual([
      UNRELATED_HIDDEN,
      expect.objectContaining({
        id: STATUS_ID,
        stealth: {
          ownerId: OWNER_ID,
          stealthDc: 14,
          detectedBy: [],
          breaksOnAttack: true,
        },
      }),
    ]);

    const replay = hide(result.character, 'hide-1');
    expect(replay.outcome).toBe('replayed');
    expect(replay.character).toBe(result.character);
  });
});

// ============================================================================
// Observer-Relative Detection And Movement Boundaries
// ============================================================================
// Detection records one observer without globally clearing Hidden. Movement uses
// production placement and economy gates before evaluating cover at destination.
// ============================================================================

describe('stealth observation and movement', () => {
  it('compares live passive Perception and records only the detecting observer', () => {
    const hidden = hide().character;
    const low = resolveStealthObservation({
      hidden,
      observer: createObserver(12),
      ownerId: OWNER_ID,
      eventId: 'observe-low',
      mode: 'passive',
    });
    const highObserver = createObserver(18);
    const high = resolveStealthObservation({
      hidden: low.character,
      observer: highObserver,
      ownerId: OWNER_ID,
      eventId: 'observe-high',
      mode: 'passive',
    });

    expect(low).toMatchObject({ outcome: 'undetected', total: 11 });
    expect(high).toMatchObject({ outcome: 'detected', total: 14 });
    expect(high.character.statusEffects.find(status => status.id === STATUS_ID)?.stealth?.detectedBy)
      .toEqual([highObserver.id]);
    expect(high.character.statusEffects).toContain(UNRELATED_HIDDEN);
  });

  it('retains owned Hidden in cover and reveals only that owner in visible open ground', () => {
    const observer = createObserver();
    const firstHidden = hide().character;
    const covered = resolveHiddenMovement({
      hidden: firstHidden,
      observer,
      characters: [observer, firstHidden],
      mapData: createMap(),
      activeLightSources: [],
      ownerId: OWNER_ID,
      destination: { x: 5, y: 5 },
      eventId: 'move-covered',
    });

    expect(covered.outcome).toBe('moved_hidden');
    expect(covered.character.position).toEqual({ x: 5, y: 5 });
    expect(covered.character.statusEffects.some(status => status.id === STATUS_ID)).toBe(true);

    const freshHidden = hide().character;
    const exposed = resolveHiddenMovement({
      hidden: freshHidden,
      observer,
      characters: [observer, freshHidden],
      mapData: createMap(),
      activeLightSources: [],
      ownerId: OWNER_ID,
      destination: { x: 8, y: 5 },
      eventId: 'move-open',
    });

    expect(exposed.outcome).toBe('revealed');
    expect(exposed.character.position).toEqual({ x: 8, y: 5 });
    expect(exposed.character.statusEffects).toEqual([UNRELATED_HIDDEN]);
  });
});
