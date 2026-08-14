/**
 * This file proves the production fall transaction from legal endpoint through
 * Feather Fall choice, defended damage, temporary HP, downing, Prone, and the
 * once-only event receipt.
 *
 * The tests use deterministic d6 faces but real placement, sight, economy,
 * damage-defense, and HP helpers. That makes the Tactical Sandbox an adapter
 * of production truth rather than the only place these rules are enforced.
 */

import { describe, expect, it } from 'vitest';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../types/combat';
import type { SpellSlots } from '../../../types/character';
import { createMockCombatCharacter } from '../../../utils/core';
import {
  resolveAerialLandingImpact,
  resolveAerialSupportLossImpact,
  resolveFallingGroundImpact,
  type FallingGroundImpactInput,
} from '../fallingGroundImpactResolution';

// ============================================================================
// Deterministic Production Fixture
// ============================================================================
// Every test starts with one falling player, one allied Feather Fall caster,
// and one occupied landing guard on a complete map. Individual cases change
// only the rule fact they are proving.
// ============================================================================

const EVENT_ID = 'fall-event-1';
const FALLER_ID = 'falling-player';
const CASTER_ID = 'feather-caster';
const BLOCKER_ID = 'landing-blocker';
const SOURCE = { x: 2, y: 3 } as const;
const LANDING = { x: 5, y: 5 } as const;

/** Builds a complete slot record so resource assertions exercise the public type. */
function createSpellSlots(levelOneCurrent: number): SpellSlots {
  return {
    level_1: { current: levelOneCurrent, max: 1 },
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

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      const id = `${x}-${y}`;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: 'floor',
        elevation: 0,
        movementCost: 5,
        blocksMovement: false,
        blocksLoS: false,
        decoration: null,
        effects: [],
      });
    }
  }

  return {
    dimensions: { width: 20, height: 20 },
    tiles,
    theme: 'dungeon',
    seed: 32,
  };
}

function createFaller(overrides: Partial<CombatCharacter> = {}): CombatCharacter {
  return createMockCombatCharacter({
    id: FALLER_ID,
    name: 'Falling Player',
    position: { ...SOURCE },
    team: 'player',
    currentHP: 100,
    maxHP: 100,
    tempHP: 0,
    fallingState: {
      eventId: EVENT_ID,
      isFalling: true,
      sourcePosition: { ...SOURCE },
      sourceElevationFeet: 30,
      fallDistanceFeet: 30,
    },
    ...overrides,
  });
}

function createCaster(overrides: Partial<CombatCharacter> = {}): CombatCharacter {
  return createMockCombatCharacter({
    id: CASTER_ID,
    name: 'Feather Caster',
    position: { x: 2, y: 2 },
    team: 'player',
    spellbook: {
      knownSpells: ['feather-fall'],
      preparedSpells: [],
      cantrips: [],
    },
    spellSlots: createSpellSlots(1),
    ...overrides,
  });
}

function createBlocker(): CombatCharacter {
  return createMockCombatCharacter({
    id: BLOCKER_ID,
    name: 'Landing Blocker',
    position: { x: 8, y: 8 },
    team: 'enemy',
    currentHP: 20,
    maxHP: 20,
  });
}

function deterministicFaces(...faces: number[]): () => number {
  let index = 0;
  return () => {
    const face = faces[Math.min(index, faces.length - 1)] ?? 1;
    index += 1;
    return (face - 0.5) / 6;
  };
}

function createInput(
  faller: CombatCharacter = createFaller(),
  caster: CombatCharacter = createCaster(),
  overrides: Partial<FallingGroundImpactInput> = {},
): FallingGroundImpactInput {
  return {
    eventId: EVENT_ID,
    fallerId: FALLER_ID,
    landingPosition: { ...LANDING },
    mapData: createMap(),
    characters: [faller, caster, createBlocker()],
    damageRng: deterministicFaces(3, 4, 5),
    ...overrides,
  };
}

function findCharacter(result: { characters: CombatCharacter[] }, id: string): CombatCharacter {
  const character = result.characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing production fall actor ${id}.`);
  return character;
}

// ============================================================================
// Fall Dice, Defenses, HP, And Death State
// ============================================================================
// These cases preserve the full-ten-foot rule and 20d6 cap while proving that
// the rolled packet uses canonical defenses and HP/downing transitions.
// ============================================================================

describe('resolveFallingGroundImpact damage transaction', () => {
  it('resolves a sub-10-foot fall as 0d6 with no damage or Prone', () => {
    const faller = createFaller({
      fallingState: {
        eventId: EVENT_ID,
        isFalling: true,
        sourcePosition: { ...SOURCE },
        sourceElevationFeet: 5,
        fallDistanceFeet: 5,
      },
    });
    const result = resolveFallingGroundImpact(createInput(faller));

    expect(result).toMatchObject({
      status: 'resolved',
      fallDistanceFeet: 5,
      damageDice: 0,
      rawDamage: 0,
      defendedDamage: 0,
      proneApplied: false,
    });
    expect(result.faller).toMatchObject({ currentHP: 100, position: LANDING });
  });

  it('counts each complete 10 feet and applies deterministic 3d6 plus Prone', () => {
    const result = resolveFallingGroundImpact(createInput());

    expect(result).toMatchObject({
      damageDice: 3,
      rawDamage: 12,
      defendedDamage: 12,
      hpDamage: 12,
      proneApplied: true,
    });
    expect(result.faller?.currentHP).toBe(88);
    expect(result.faller?.conditions).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Prone', source: 'Falling' }),
    ]));
  });

  it('caps a 200-foot-or-longer fall at 20d6', () => {
    const faller = createFaller({
      currentHP: 200,
      maxHP: 200,
      fallingState: {
        eventId: EVENT_ID,
        isFalling: true,
        sourcePosition: { ...SOURCE },
        sourceElevationFeet: 250,
        fallDistanceFeet: 250,
      },
    });
    const result = resolveFallingGroundImpact(createInput(
      faller,
      createCaster(),
      { damageRng: deterministicFaces(6) },
    ));

    expect(result).toMatchObject({ damageDice: 20, rawDamage: 120, defendedDamage: 120 });
    expect(result.faller?.currentHP).toBe(80);
  });

  it('applies Bludgeoning resistance before temporary HP and current HP', () => {
    const faller = createFaller({ resistances: ['Bludgeoning'], tempHP: 2 });
    const result = resolveFallingGroundImpact(createInput(faller));

    expect(result).toMatchObject({
      rawDamage: 12,
      defendedDamage: 6,
      temporaryHitPointsSpent: 2,
      hpDamage: 4,
      proneApplied: true,
    });
    expect(result.faller).toMatchObject({ currentHP: 96, tempHP: 0 });
  });

  it('lets Bludgeoning immunity prevent damage, temp-HP loss, and Prone', () => {
    const faller = createFaller({ immunities: ['Bludgeoning'], tempHP: 5 });
    const result = resolveFallingGroundImpact(createInput(faller));

    expect(result).toMatchObject({
      rawDamage: 12,
      defendedDamage: 0,
      temporaryHitPointsSpent: 0,
      hpDamage: 0,
      proneApplied: false,
    });
    expect(result.faller).toMatchObject({ currentHP: 100, tempHP: 5 });
    expect(result.faller?.damagedThisTurn).not.toBe(true);
  });

  it('downing a player creates canonical death saves and Unconscious while retaining Prone', () => {
    const faller = createFaller({ currentHP: 10, maxHP: 40 });
    const result = resolveFallingGroundImpact(createInput(faller));

    expect(result.faller).toMatchObject({
      currentHP: 0,
      deathSaves: { successes: 0, failures: 0, isStable: false },
    });
    expect(result.faller?.conditions?.map(condition => condition.name)).toEqual(
      expect.arrayContaining(['Unconscious', 'Prone']),
    );
  });

  it('routes damage to an already-down falling player as one death-save failure', () => {
    const faller = createFaller({
      currentHP: 0,
      maxHP: 40,
      deathSaves: { successes: 1, failures: 1, isStable: true },
    });
    const result = resolveFallingGroundImpact(createInput(faller));

    expect(result.faller?.deathSaves).toEqual({ successes: 1, failures: 2, isStable: false });
  });
});

// ============================================================================
// Aerial Movement Bridge
// ============================================================================
// These cases prove flight does not reimplement gravity: paid descent and lost
// support both close through this production transaction.
// ============================================================================

describe('aerial landing and support-loss bridge', () => {
  function createAirborneFaller(flySpeed: number): CombatCharacter {
    const faller = createFaller({
      position: { ...LANDING },
      fallingState: undefined,
      currentHP: 20,
      maxHP: 20,
      aerialMovement: {
        altitudeFeet: 20,
        isFlying: true,
        canHover: false,
        source: 'test Fly Speed',
      },
    });
    faller.stats.extraMovementSpeeds = { fly: flySpeed };
    return faller;
  }

  it('lands a controlled descent without damage or Prone', () => {
    const mapData = createMap();
    const faller = createAirborneFaller(40);
    const descended: CombatCharacter = {
      ...faller,
      aerialMovement: { ...faller.aerialMovement!, altitudeFeet: 0, isFlying: false },
    };
    const result = resolveAerialLandingImpact({
      eventId: 'controlled-descent',
      character: descended,
      landingPosition: LANDING,
      mapData,
      characters: [descended],
      fallDistanceFeet: 0,
    });

    expect(result).toMatchObject({
      status: 'resolved',
      fallDistanceFeet: 0,
      hpDamage: 0,
      proneApplied: false,
    });
    expect(result.faller?.aerialMovement).toMatchObject({ altitudeFeet: 0, isFlying: false });
  });

  it('turns zero Fly Speed into fall damage, downing state, and Prone atomically', () => {
    const mapData = createMap();
    const faller = createAirborneFaller(0);
    faller.currentHP = 4;
    const result = resolveAerialSupportLossImpact({
      eventId: 'support-loss-impact',
      characterId: faller.id,
      landingPosition: LANDING,
      mapData,
      characters: [faller],
      damageRng: () => 0.5,
    });

    expect(result).toMatchObject({
      status: 'resolved',
      fallDistanceFeet: 20,
      damageDice: 2,
      rawDamage: 8,
      hpDamage: 4,
      proneApplied: true,
    });
    expect(result.faller).toMatchObject({ currentHP: 0 });
    expect(result.faller?.aerialMovement).toMatchObject({ altitudeFeet: 0, isFlying: false });
    expect(result.faller?.deathSaves).toMatchObject({ successes: 0, failures: 0 });
  });
});

// ============================================================================
// Feather Fall Choice And Atomic Rejections
// ============================================================================
// Acceptance pays exactly once and prevents damage/Prone. Decline or an
// unavailable reaction pays nothing and lets the already-valid fall continue.
// Invalid landing and replay stop before either resource or damage changes.
// ============================================================================

describe('resolveFallingGroundImpact Feather Fall and atomicity', () => {
  const acceptedReaction = {
    casterId: CASTER_ID,
    selectedTargetIds: [FALLER_ID],
    choice: 'accept' as const,
  };

  it('accepts an owned, visible, in-range falling target and pays once', () => {
    const result = resolveFallingGroundImpact(createInput(
      createFaller(),
      createCaster(),
      { featherFall: acceptedReaction },
    ));
    const caster = findCharacter(result, CASTER_ID);

    expect(result).toMatchObject({
      status: 'resolved',
      featherFallOutcome: 'accepted',
      rawDamage: 0,
      defendedDamage: 0,
      proneApplied: false,
    });
    expect(caster.actionEconomy.reaction.used).toBe(true);
    expect(caster.spellSlots?.level_1.current).toBe(0);
    expect(result.faller?.fallingState).toMatchObject({
      isFalling: false,
      mitigation: 'feather_fall',
      resolvedAt: LANDING,
    });
  });

  it('declines without payment and resolves the ordinary damaging fall', () => {
    const result = resolveFallingGroundImpact(createInput(
      createFaller(),
      createCaster(),
      {
        featherFall: {
          ...acceptedReaction,
          choice: 'decline',
        },
      },
    ));
    const caster = findCharacter(result, CASTER_ID);

    expect(result).toMatchObject({
      featherFallOutcome: 'declined',
      defendedDamage: 12,
      proneApplied: true,
    });
    expect(caster.actionEconomy.reaction.used).toBe(false);
    expect(caster.spellSlots?.level_1.current).toBe(1);
  });

  it.each([
    ['unowned', createCaster({ spellbook: { knownSpells: [], preparedSpells: [], cantrips: [] } }), 'does not own'],
    ['spent Reaction', createCaster({ actionEconomy: { ...createCaster().actionEconomy, reaction: { used: true, remaining: 0 } } }), 'spent its Reaction'],
    ['empty slot', createCaster({ spellSlots: createSpellSlots(0) }), 'no level-1 spell slot'],
  ])('rejects %s without payment while gravity still resolves', (_label, caster, reason) => {
    const result = resolveFallingGroundImpact(createInput(
      createFaller(),
      caster,
      { featherFall: acceptedReaction },
    ));
    const resolvedCaster = findCharacter(result, CASTER_ID);

    expect(result).toMatchObject({
      status: 'resolved',
      featherFallOutcome: 'rejected',
      defendedDamage: 12,
      proneApplied: true,
    });
    expect(result.featherFallReason).toContain(reason);
    expect(resolvedCaster.actionEconomy.reaction.used).toBe(caster.actionEconomy.reaction.used);
    expect(resolvedCaster.spellSlots?.level_1.current).toBe(caster.spellSlots?.level_1.current);
  });

  it('rejects a non-falling selected target and an out-of-range target before payment', () => {
    const grounded = createMockCombatCharacter({
      id: 'grounded-choice',
      name: 'Grounded Choice',
      position: { x: 3, y: 3 },
    });
    const nonFalling = resolveFallingGroundImpact(createInput(
      createFaller(),
      createCaster(),
      {
        characters: [createFaller(), createCaster(), grounded],
        featherFall: {
          casterId: CASTER_ID,
          selectedTargetIds: [FALLER_ID, grounded.id],
          choice: 'accept',
        },
      },
    ));
    const distantCaster = createCaster({ position: { x: 19, y: 19 } });
    const outOfRange = resolveFallingGroundImpact(createInput(
      createFaller(),
      distantCaster,
      { featherFall: acceptedReaction },
    ));

    expect(nonFalling.featherFallReason).toContain('is not currently falling');
    expect(nonFalling.featherFallOutcome).toBe('rejected');
    expect(outOfRange.featherFallReason).toContain("beyond Feather Fall's 60-foot range");
    expect(outOfRange.featherFallOutcome).toBe('rejected');
    expect(findCharacter(outOfRange, CASTER_ID).actionEconomy.reaction.used).toBe(false);
  });

  it('rejects an occupied landing before damage or Feather Fall payment', () => {
    const blocker = createBlocker();
    blocker.position = { ...LANDING };
    const input = createInput(createFaller(), createCaster(), {
      characters: [createFaller(), createCaster(), blocker],
      featherFall: acceptedReaction,
    });
    const result = resolveFallingGroundImpact(input);

    expect(result).toMatchObject({ status: 'rejected', defendedDamage: 0, featherFallOutcome: 'not_requested' });
    expect(result.reason).toContain('overlaps Landing Blocker');
    expect(result.characters).toBe(input.characters);
    expect(findCharacter(result, CASTER_ID).spellSlots?.level_1.current).toBe(1);
  });

  it('makes replay after an accepted landing a complete no-op', () => {
    const first = resolveFallingGroundImpact(createInput(
      createFaller(),
      createCaster(),
      { featherFall: acceptedReaction },
    ));
    const replayInput = createInput(
      findCharacter(first, FALLER_ID),
      findCharacter(first, CASTER_ID),
      {
        characters: first.characters,
        featherFall: acceptedReaction,
      },
    );
    const replay = resolveFallingGroundImpact(replayInput);

    expect(replay).toMatchObject({ status: 'repeat', rawDamage: 0, hpDamage: 0 });
    expect(replay.characters).toBe(first.characters);
    expect(findCharacter(replay, CASTER_ID).spellSlots?.level_1.current).toBe(0);
    expect(findCharacter(replay, FALLER_ID).currentHP).toBe(100);
  });
});
