/**
 * This file proves the Falling & Ground Impact sandbox adapts every visible
 * control to the production fall transaction.
 *
 * Assertions cover the threshold, 20d6 cap, defenses, temporary HP, downing,
 * occupied/blocked/off-board atomic rejection, Feather Fall choice/payment,
 * rejection, replay safety, exact cues, and Reset preparation.
 */

import { describe, expect, it } from 'vitest';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../../../types/combat';
import type { SpellSlots } from '../../../../../types/character';
import { createMockCombatCharacter } from '../../../../../utils/core';
import fallingGroundImpactScenarioControls, {
  FALLING_GROUND_IMPACT_BLOCKER_ID,
  FALLING_GROUND_IMPACT_CAP_DAMAGE_TOTAL,
  FALLING_GROUND_IMPACT_CASTER_ID,
  FALLING_GROUND_IMPACT_CASTER_START,
  FALLING_GROUND_IMPACT_DAMAGE_LANDING,
  FALLING_GROUND_IMPACT_DAMAGE_TOTAL,
  FALLING_GROUND_IMPACT_FALLER_ID,
  FALLING_GROUND_IMPACT_MAX_HP,
  FALLING_GROUND_IMPACT_OCCUPIED_LANDING,
  FALLING_GROUND_IMPACT_SAFE_LANDING,
  FALLING_GROUND_IMPACT_SOURCE,
  prepareFallingGroundImpactCharacters,
  prepareFallingGroundImpactMapData,
} from '../fallingGroundImpactScenarioControls';
import type {
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
  PreviewCombatScenarioControlValues,
} from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Mounted-Like Board And Actor Fixture
// ============================================================================
// The raw map begins as ordinary floor. The same exported preparers used by the
// host add the cliff, invalid endpoints, in-flight receipt, caster ownership,
// and fresh resources.
// ============================================================================

/** Creates the full spell-slot shape before Reset replaces the L1 resource. */
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

function createRawMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
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
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'dungeon',
    seed: 14,
  };
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  const characters = prepareFallingGroundImpactCharacters([
    createMockCombatCharacter({
      id: FALLING_GROUND_IMPACT_FALLER_ID,
      name: 'Cliff Runner',
      position: FALLING_GROUND_IMPACT_SOURCE,
      currentHP: 17,
      maxHP: 22,
      conditions: [{
        name: 'Prone',
        duration: { type: 'rounds', value: 2 },
        appliedTurn: 0,
        source: 'old result',
      }],
    }),
    createMockCombatCharacter({
      id: FALLING_GROUND_IMPACT_CASTER_ID,
      name: 'Aerie Mage',
      position: FALLING_GROUND_IMPACT_CASTER_START,
      spellSlots: createSpellSlots(0),
    }),
    createMockCombatCharacter({
      id: FALLING_GROUND_IMPACT_BLOCKER_ID,
      name: 'Landing Guard',
      position: FALLING_GROUND_IMPACT_OCCUPIED_LANDING,
      team: 'enemy',
    }),
    createMockCombatCharacter({
      id: 'falling-ground-impact-bystander',
      name: 'Unrelated Bystander',
      position: { x: 1, y: 10 },
    }),
  ]);

  return {
    mapData: prepareFallingGroundImpactMapData(createRawMap()),
    characters,
    activeLightSources: [],
    reactiveTriggers: [],
    controlValues: {
      'fall-case': 'short',
      'resolve-fall': false,
      'feather-fall-case': 'accept',
      'resolve-feather-fall': false,
    },
  };
}

function applyAction(
  actionId: 'resolve-fall' | 'resolve-feather-fall',
  controlValues: PreviewCombatScenarioControlValues,
  snapshot: PreviewCombatScenarioControlSnapshot = createSnapshot(),
): PreviewCombatScenarioControlPatch {
  return fallingGroundImpactScenarioControls.applyControl({
    controlId: actionId,
    value: true,
    snapshot: { ...snapshot, controlValues },
  });
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing Falling scenario actor ${id}.`);
  return character;
}

// ============================================================================
// Registration And Reset Baseline
// ============================================================================
// The baseline itself exposes the legal platform, every endpoint boundary, one
// actively falling target, and a separate eligible Feather Fall owner.
// ============================================================================

describe('fallingGroundImpactScenarioControls baseline', () => {
  it('registers two selectors and two inert production actions', () => {
    expect(fallingGroundImpactScenarioControls.scenarioId).toBe('falling_ground_impact');
    expect(fallingGroundImpactScenarioControls.controls.map(control => control.kind))
      .toEqual(['select', 'action', 'select', 'action']);
    expect(fallingGroundImpactScenarioControls.controls[0].options?.map(option => option.value))
      .toEqual(expect.arrayContaining([
        'short', 'damaging', 'cap_200', 'resistance', 'immunity',
        'temporary_hp', 'downing', 'occupied', 'blocked', 'off_board',
      ]));
    expect(fallingGroundImpactScenarioControls.controls[2].options?.map(option => option.value))
      .toEqual(['accept', 'decline', 'unowned', 'spent_reaction', 'empty_slot', 'not_selected']);
  });

  it('prepares the in-flight faller, owner caster, and every rule-bearing tile', () => {
    const snapshot = createSnapshot();
    const faller = findCharacter(snapshot.characters, FALLING_GROUND_IMPACT_FALLER_ID);
    const caster = findCharacter(snapshot.characters, FALLING_GROUND_IMPACT_CASTER_ID);

    expect(faller).toMatchObject({
      position: FALLING_GROUND_IMPACT_SOURCE,
      currentHP: FALLING_GROUND_IMPACT_MAX_HP,
      fallingState: {
        isFalling: true,
        sourceElevationFeet: 30,
        fallDistanceFeet: 30,
      },
    });
    expect(faller.conditions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Prone' }),
    ]));
    expect(caster).toMatchObject({ position: FALLING_GROUND_IMPACT_CASTER_START });
    expect(caster.spellbook?.knownSpells).toContain('feather-fall');
    expect(caster.actionEconomy.reaction.used).toBe(false);
    expect(caster.spellSlots?.level_1).toEqual({ current: 1, max: 1 });
    expect(snapshot.mapData?.tiles.get('4-5')).toMatchObject({ elevation: 30, terrain: 'rock' });
    expect(snapshot.mapData?.tiles.get('6-5')).toMatchObject({ elevation: 25, terrain: 'sand' });
    expect(snapshot.mapData?.tiles.get('11-7')).toMatchObject({ blocksMovement: true, blocksLoS: true });
    expect(snapshot.mapData?.tiles.has('16-5')).toBe(false);
  });
});

// ============================================================================
// Threshold, Cap, Defense, Temporary HP, And Downing Matrix
// ============================================================================
// Every option calls one action and receives canonical state. Names and logs
// surface the same values without being used as the mechanics authority.
// ============================================================================

describe('fallingGroundImpactScenarioControls fall matrix', () => {
  it('resolves 5 feet as 0d6 without damage or Prone', () => {
    const result = applyAction('resolve-fall', { 'fall-case': 'short' });
    const faller = findCharacter(result.characters ?? [], FALLING_GROUND_IMPACT_FALLER_ID);

    expect(faller).toMatchObject({ position: FALLING_GROUND_IMPACT_SAFE_LANDING, currentHP: 40 });
    expect(faller.fallingState?.isFalling).toBe(false);
    expect(faller.conditions?.map(condition => condition.name)).not.toContain('Prone');
    expect(faller.name).toContain('fall 5 ft | 0d6=0');
    expect(result.logMessage).toContain('canonical 0d6 raw 0, defended 0');
  });

  it('resolves 30 feet as 3d6 = 12 and applies Prone', () => {
    const result = applyAction('resolve-fall', { 'fall-case': 'damaging' });
    const faller = findCharacter(result.characters ?? [], FALLING_GROUND_IMPACT_FALLER_ID);

    expect(faller).toMatchObject({ position: FALLING_GROUND_IMPACT_DAMAGE_LANDING, currentHP: 28 });
    expect(faller.conditions?.map(condition => condition.name)).toContain('Prone');
    expect(faller.statusEffects.map(effect => effect.name)).toContain('Prone');
    expect(faller.name).toContain(`3d6=${FALLING_GROUND_IMPACT_DAMAGE_TOTAL}`);
    expect(result.activeLightSources?.[1]).toMatchObject({ color: '#fb7185' });
  });

  it('caps 200 feet at deterministic 20d6 = 79', () => {
    const result = applyAction('resolve-fall', { 'fall-case': 'cap_200' });
    const faller = findCharacter(result.characters ?? [], FALLING_GROUND_IMPACT_FALLER_ID);

    expect(faller).toMatchObject({ currentHP: 121, maxHP: 200 });
    expect(faller.name).toContain(`fall 200 ft | 20d6=${FALLING_GROUND_IMPACT_CAP_DAMAGE_TOTAL}`);
    expect(result.mapData?.tiles.get('4-5')?.elevation).toBe(200);
    expect(result.logMessage).toContain('distance 200 ft; canonical 20d6 raw 79');
  });

  it.each([
    ['resistance', 34, 0, true, 'defended 12 -> 6'],
    ['immunity', 40, 0, false, 'defended 12 -> 0'],
    ['temporary_hp', 33, 0, true, 'temp HP spent 5; HP damage 7'],
  ])('routes %s through defenses and temporary HP', (choice, hp, tempHP, prone, label) => {
    const result = applyAction('resolve-fall', { 'fall-case': choice });
    const faller = findCharacter(result.characters ?? [], FALLING_GROUND_IMPACT_FALLER_ID);

    expect(faller).toMatchObject({ currentHP: hp, tempHP });
    expect(faller.conditions?.map(condition => condition.name).includes('Prone')).toBe(prone);
    expect(`${faller.name} ${result.logMessage}`).toContain(label);
  });

  it('downing writes 0 HP, death saves, Unconscious, and Prone', () => {
    const result = applyAction('resolve-fall', { 'fall-case': 'downing' });
    const faller = findCharacter(result.characters ?? [], FALLING_GROUND_IMPACT_FALLER_ID);

    expect(faller).toMatchObject({
      currentHP: 0,
      deathSaves: { successes: 0, failures: 0, isStable: false },
    });
    expect(faller.conditions?.map(condition => condition.name)).toEqual(
      expect.arrayContaining(['Unconscious', 'Prone']),
    );
    expect(result.logMessage).toContain('DOWNED: 0 HP, death saves 0S/0F, Unconscious');
  });
});

// ============================================================================
// Endpoint Atomicity And Replay
// ============================================================================
// Living occupied ground follows the shared placement rule: it is not a legal
// landing. Every invalid endpoint and repeated event preserves the live roster.
// ============================================================================

describe('fallingGroundImpactScenarioControls endpoint and replay safety', () => {
  it.each([
    ['occupied', 'overlaps Landing Guard'],
    ['blocked', 'blocked at 11,7'],
    ['off_board', 'leaves the battle map at 16,5'],
  ])('rejects %s atomically', (choice, reason) => {
    const result = applyAction('resolve-fall', { 'fall-case': choice });
    const faller = findCharacter(result.characters ?? [], FALLING_GROUND_IMPACT_FALLER_ID);
    const caster = findCharacter(result.characters ?? [], FALLING_GROUND_IMPACT_CASTER_ID);

    expect(faller).toMatchObject({ position: FALLING_GROUND_IMPACT_SOURCE, currentHP: 40 });
    expect(faller.fallingState?.isFalling).toBe(true);
    expect(caster.actionEconomy.reaction.used).toBe(false);
    expect(caster.spellSlots?.level_1.current).toBe(1);
    expect(result.activeLightSources).toEqual([]);
    expect(result.logMessage).toContain(reason);
    expect(result.logMessage).toContain('ATOMIC NO-OP');
  });

  it('repeating one resolved event does not damage or apply a death failure twice', () => {
    const first = applyAction('resolve-fall', { 'fall-case': 'downing' });
    const firstFaller = findCharacter(first.characters ?? [], FALLING_GROUND_IMPACT_FALLER_ID);
    const replay = applyAction(
      'resolve-fall',
      { 'fall-case': 'downing' },
      {
        ...createSnapshot(),
        mapData: first.mapData ?? null,
        characters: first.characters ?? [],
        activeLightSources: first.activeLightSources ?? [],
      },
    );
    const replayFaller = findCharacter(replay.characters ?? [], FALLING_GROUND_IMPACT_FALLER_ID);

    expect(firstFaller.deathSaves?.failures).toBe(0);
    expect(replayFaller.deathSaves?.failures).toBe(0);
    expect(replayFaller.currentHP).toBe(0);
    expect(replay.logMessage).toContain('REPEAT ATOMIC NO-OP');
  });
});

// ============================================================================
// Feather Fall Acceptance, Decline, Rejection, And Reset
// ============================================================================
// Acceptance protects and pays the separate owner. Every other branch pays
// nothing and lets the valid thirty-foot fall proceed with ordinary damage.
// ============================================================================

describe('fallingGroundImpactScenarioControls Feather Fall transaction', () => {
  it('accepts, pays one Reaction and slot, and prevents damage and Prone', () => {
    const result = applyAction('resolve-feather-fall', { 'feather-fall-case': 'accept' });
    const faller = findCharacter(result.characters ?? [], FALLING_GROUND_IMPACT_FALLER_ID);
    const caster = findCharacter(result.characters ?? [], FALLING_GROUND_IMPACT_CASTER_ID);

    expect(faller).toMatchObject({ position: FALLING_GROUND_IMPACT_DAMAGE_LANDING, currentHP: 40 });
    expect(faller.fallingState).toMatchObject({ isFalling: false, mitigation: 'feather_fall' });
    expect(faller.conditions?.map(condition => condition.name)).not.toContain('Prone');
    expect(caster.actionEconomy.reaction.used).toBe(true);
    expect(caster.spellSlots?.level_1.current).toBe(0);
    expect(result.logMessage).toContain('Feather Fall accepted');
  });

  it('declines without payment and takes the canonical impact', () => {
    const result = applyAction('resolve-feather-fall', { 'feather-fall-case': 'decline' });
    const faller = findCharacter(result.characters ?? [], FALLING_GROUND_IMPACT_FALLER_ID);
    const caster = findCharacter(result.characters ?? [], FALLING_GROUND_IMPACT_CASTER_ID);

    expect(faller.currentHP).toBe(28);
    expect(faller.conditions?.map(condition => condition.name)).toContain('Prone');
    expect(caster.actionEconomy.reaction.used).toBe(false);
    expect(caster.spellSlots?.level_1.current).toBe(1);
    expect(result.logMessage).toContain('Feather Fall declined');
  });

  it.each([
    ['unowned', 'does not own Feather Fall'],
    ['spent_reaction', 'already spent its Reaction'],
    ['empty_slot', 'no level-1 spell slot'],
    ['not_selected', 'must choose 1-5 falling creatures'],
  ])('rejects %s without new payment while the fall proceeds', (choice, reason) => {
    const result = applyAction('resolve-feather-fall', { 'feather-fall-case': choice });
    const faller = findCharacter(result.characters ?? [], FALLING_GROUND_IMPACT_FALLER_ID);
    const caster = findCharacter(result.characters ?? [], FALLING_GROUND_IMPACT_CASTER_ID);

    expect(faller.currentHP).toBe(28);
    expect(faller.conditions?.map(condition => condition.name)).toContain('Prone');
    expect(result.logMessage).toContain('Feather Fall rejected');
    expect(result.logMessage).toContain(reason);
    if (choice !== 'spent_reaction') expect(caster.actionEconomy.reaction.used).toBe(false);
    if (choice !== 'empty_slot') expect(caster.spellSlots?.level_1.current).toBe(1);
  });

  it('replay after acceptance preserves the one paid resource transaction', () => {
    const first = applyAction('resolve-feather-fall', { 'feather-fall-case': 'accept' });
    const replay = applyAction(
      'resolve-feather-fall',
      { 'feather-fall-case': 'accept' },
      {
        ...createSnapshot(),
        mapData: first.mapData ?? null,
        characters: first.characters ?? [],
        activeLightSources: first.activeLightSources ?? [],
      },
    );
    const caster = findCharacter(replay.characters ?? [], FALLING_GROUND_IMPACT_CASTER_ID);
    const faller = findCharacter(replay.characters ?? [], FALLING_GROUND_IMPACT_FALLER_ID);

    expect(caster.actionEconomy.reaction.used).toBe(true);
    expect(caster.spellSlots?.level_1.current).toBe(0);
    expect(faller.currentHP).toBe(40);
    expect(replay.logMessage).toContain('REPEAT ATOMIC NO-OP');
  });

  it('Reset preparation restores the in-flight target and eligible owner', () => {
    const first = applyAction('resolve-feather-fall', { 'feather-fall-case': 'accept' });
    const reset = prepareFallingGroundImpactCharacters(first.characters ?? []);
    const faller = findCharacter(reset, FALLING_GROUND_IMPACT_FALLER_ID);
    const caster = findCharacter(reset, FALLING_GROUND_IMPACT_CASTER_ID);

    expect(faller).toMatchObject({ position: FALLING_GROUND_IMPACT_SOURCE, currentHP: 40 });
    expect(faller.fallingState).toMatchObject({ isFalling: true, fallDistanceFeet: 30 });
    expect(caster.actionEconomy.reaction.used).toBe(false);
    expect(caster.spellSlots?.level_1.current).toBe(1);
  });
});
