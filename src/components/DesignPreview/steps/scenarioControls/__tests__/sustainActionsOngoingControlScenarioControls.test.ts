/**
 * This file proves the Sustain Actions & Ongoing Control adapter stays engine-backed.
 *
 * The mounted fixture and controls must agree about Witch Bolt HP, initial and
 * later-turn resources, concentration ownership, optional skipping, range and
 * Total Cover, duration, selective cleanup, map cues, and unrelated actors.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import sustainActionsOngoingControlScenarioControls, {
  prepareSustainActionsOngoingControlCharacters,
  SUSTAIN_ACTIONS_CASTER_ID,
  SUSTAIN_ACTIONS_CASTER_START,
  SUSTAIN_ACTIONS_LINKED_HP,
  SUSTAIN_ACTIONS_OUT_OF_RANGE_CASTER,
  SUSTAIN_ACTIONS_OUT_OF_RANGE_TARGET,
  SUSTAIN_ACTIONS_REPEAT_DAMAGE,
  SUSTAIN_ACTIONS_TARGET_ID,
  SUSTAIN_ACTIONS_TARGET_MAX_HP,
  SUSTAIN_ACTIONS_TARGET_START,
  SUSTAIN_ACTIONS_TOTAL_COVER_TILE,
} from '../sustainActionsOngoingControlScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Rendered Board Snapshot
// ============================================================================
// This map and actor roster match the host's 16-by-12 deterministic board. A
// complete tile set is necessary because Total Cover uses the real sightline.
// ============================================================================

function makeMap(): BattleMapData {
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
    seed: 12,
  };
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  const characters = prepareSustainActionsOngoingControlCharacters([
    createMockCombatCharacter({
      id: SUSTAIN_ACTIONS_CASTER_ID,
      name: 'Storm Binder',
      level: 5,
      position: { ...SUSTAIN_ACTIONS_CASTER_START },
      spellcastingAbility: 'intelligence',
      spellSlots: { level_1: { current: 0, max: 1 } },
    }),
    createMockCombatCharacter({
      id: SUSTAIN_ACTIONS_TARGET_ID,
      name: 'Arc Target',
      position: { ...SUSTAIN_ACTIONS_TARGET_START },
      currentHP: SUSTAIN_ACTIONS_LINKED_HP,
      maxHP: SUSTAIN_ACTIONS_TARGET_MAX_HP,
    }),
    createMockCombatCharacter({ id: 'sustain-actions-bystander', name: 'Unrelated Bystander' }),
  ]);

  return {
    mapData: makeMap(),
    characters,
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

function apply(controlId: string, value: boolean | string = true) {
  return sustainActionsOngoingControlScenarioControls.applyControl({
    controlId,
    value,
    snapshot: createSnapshot(),
  });
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing Sustain Actions actor ${id}.`);
  return character;
}

function expectLinked(characters: CombatCharacter[]) {
  const caster = findCharacter(characters, SUSTAIN_ACTIONS_CASTER_ID);
  const target = findCharacter(characters, SUSTAIN_ACTIONS_TARGET_ID);
  expect(caster.concentratingOn?.spellId).toBe('witch-bolt');
  expect(target.statusEffects.map(effect => effect.sourceSpellId)).toContain('witch-bolt');
  expect(target.activeEffects?.map(effect => effect.spellId)).toEqual([
    'mage-armor',
    'witch-bolt',
  ]);
}

function expectEndedButUnrelatedEffectKept(characters: CombatCharacter[]) {
  const caster = findCharacter(characters, SUSTAIN_ACTIONS_CASTER_ID);
  const target = findCharacter(characters, SUSTAIN_ACTIONS_TARGET_ID);
  expect(caster.concentratingOn).toBeUndefined();
  expect(target.statusEffects.map(effect => effect.sourceSpellId)).not.toContain('witch-bolt');
  expect(target.activeEffects?.map(effect => effect.spellId)).toEqual(['mage-armor']);
  expect(target.name).toContain('Mage Armor kept');
}

// ============================================================================
// Registration, Baseline, And Resource Proof
// ============================================================================
// The board starts on the first later turn so the arc and its remaining duration
// are inspectable before a click. Each action then rebuilds its own exact input.
// ============================================================================

describe('sustainActionsOngoingControlScenarioControls', () => {
  it('registers three inert actions and one break-condition selector', () => {
    expect(sustainActionsOngoingControlScenarioControls.scenarioId)
      .toBe('sustain_actions_ongoing_control');
    expect(sustainActionsOngoingControlScenarioControls.controls).toHaveLength(4);
    expect(sustainActionsOngoingControlScenarioControls.controls.map(control => control.kind))
      .toEqual(['action', 'action', 'action', 'select']);
    expect(sustainActionsOngoingControlScenarioControls.controls[3].options?.map(option => option.value))
      .toEqual(['clear', 'out_of_range', 'total_cover', 'concentration_lost', 'duration_expired']);
  });

  it('prepares the linked later-turn baseline used by 2D, 3D, and Reset Board', () => {
    const snapshot = createSnapshot();
    const caster = findCharacter(snapshot.characters, SUSTAIN_ACTIONS_CASTER_ID);
    const target = findCharacter(snapshot.characters, SUSTAIN_ACTIONS_TARGET_ID);

    expect(caster.position).toEqual(SUSTAIN_ACTIONS_CASTER_START);
    expect(caster.spellSlots?.level_1).toEqual({ current: 0, max: 1 });
    expect(caster.actionEconomy.action.used).toBe(false);
    expect(caster.actionEconomy.bonusAction.used).toBe(false);
    expect(caster.name).toContain('9 rounds');
    expect(target.position).toEqual(SUSTAIN_ACTIONS_TARGET_START);
    expect(target.currentHP).toBe(SUSTAIN_ACTIONS_LINKED_HP);
    expectLinked(snapshot.characters);
  });

  it('casts the initial effect through the Action/slot, attack, HP, and link resolver', () => {
    const result = apply('cast-and-link');
    const caster = findCharacter(result.characters ?? [], SUSTAIN_ACTIONS_CASTER_ID);
    const target = findCharacter(result.characters ?? [], SUSTAIN_ACTIONS_TARGET_ID);

    expect(caster.actionEconomy.action.used).toBe(true);
    expect(caster.actionEconomy.bonusAction.used).toBe(false);
    expect(caster.spellSlots?.level_1.current).toBe(0);
    expect(target.currentHP).toBe(SUSTAIN_ACTIONS_LINKED_HP);
    expectLinked(result.characters ?? []);
    expect(result.logMessage).toContain('initial Action');
    expect(result.logMessage).toContain('2d12 = 12 Lightning');
    expect(result.logMessage).toContain('concentration owns the visible arc');
  });

  it('spends only the later-turn Bonus Action and applies repeat damage', () => {
    const result = apply('activate-next-turn');
    const caster = findCharacter(result.characters ?? [], SUSTAIN_ACTIONS_CASTER_ID);
    const target = findCharacter(result.characters ?? [], SUSTAIN_ACTIONS_TARGET_ID);

    expect(caster.actionEconomy.action.used).toBe(false);
    expect(caster.actionEconomy.bonusAction.used).toBe(true);
    expect(target.currentHP).toBe(SUSTAIN_ACTIONS_LINKED_HP - SUSTAIN_ACTIONS_REPEAT_DAMAGE);
    expectLinked(result.characters ?? []);
    expect(result.logMessage).toContain('Bonus Action spent');
    expect(result.logMessage).toContain('1d12 = 6 Lightning');
    expect(result.logMessage).toContain('no new attack roll');
  });

  it('skips the optional later-turn action without cost, damage, or cleanup', () => {
    const result = apply('skip-next-turn');
    const caster = findCharacter(result.characters ?? [], SUSTAIN_ACTIONS_CASTER_ID);
    const target = findCharacter(result.characters ?? [], SUSTAIN_ACTIONS_TARGET_ID);

    expect(caster.actionEconomy.action.used).toBe(false);
    expect(caster.actionEconomy.bonusAction.used).toBe(false);
    expect(target.currentHP).toBe(SUSTAIN_ACTIONS_LINKED_HP);
    expectLinked(result.characters ?? []);
    expect(result.logMessage).toContain('optional Witch Bolt Bonus Action skipped');
    expect(result.logMessage).toContain('skipping is not an ending condition');
  });

  it('preserves actors outside the authored pair', () => {
    expect(apply('activate-next-turn').characters?.find(character => (
      character.id === 'sustain-actions-bystander'
    ))?.name).toBe('Unrelated Bystander');
  });
});

// ============================================================================
// Break Selector And Cleanup Proof
// ============================================================================
// Every ending is independent. The selector begins from the same linked board,
// changes one canonical boundary, and keeps Mage Armor after Witch Bolt leaves.
// ============================================================================

describe('sustainActionsOngoingControlScenarioControls arc boundaries', () => {
  it('keeps the arc when range, sight, concentration, and duration remain valid', () => {
    const result = apply('arc-break-condition', 'clear');
    expectLinked(result.characters ?? []);
    expect(result.logMessage).toContain('Arc check clear');
    expect(result.logMessage).toContain('30 feet away');
  });

  it('moves the actors 65 feet apart and ends the arc before payment', () => {
    const result = apply('arc-break-condition', 'out_of_range');
    const caster = findCharacter(result.characters ?? [], SUSTAIN_ACTIONS_CASTER_ID);
    const target = findCharacter(result.characters ?? [], SUSTAIN_ACTIONS_TARGET_ID);

    expect(caster.position).toEqual(SUSTAIN_ACTIONS_OUT_OF_RANGE_CASTER);
    expect(target.position).toEqual(SUSTAIN_ACTIONS_OUT_OF_RANGE_TARGET);
    expect(caster.actionEconomy.bonusAction.used).toBe(false);
    expectEndedButUnrelatedEffectKept(result.characters ?? []);
    expect(result.logMessage).toContain('65 feet');
    expect(result.logMessage).toContain('before repeat damage or Bonus Action payment');
  });

  it('turns the center cue into real Total Cover and ends the arc', () => {
    const result = apply('arc-break-condition', 'total_cover');
    const tileId = `${SUSTAIN_ACTIONS_TOTAL_COVER_TILE.x}-${SUSTAIN_ACTIONS_TOTAL_COVER_TILE.y}`;
    const wall = result.mapData?.tiles.get(tileId);

    expect(wall).toMatchObject({ blocksLoS: true, blocksMovement: true, terrain: 'wall' });
    expectEndedButUnrelatedEffectKept(result.characters ?? []);
    expect(result.logMessage).toContain('Total Cover');
  });

  it.each([
    ['concentration_lost', 'lost concentration'],
    ['duration_expired', '10-round'],
  ])('ends and selectively cleans for %s', (choice, expectedLog) => {
    const result = apply('arc-break-condition', choice);
    expectEndedButUnrelatedEffectKept(result.characters ?? []);
    expect(result.logMessage).toContain(expectedLog);
    expect(result.logMessage).toContain('Mage Armor remains');
  });
});

