/**
 * This file proves the production-backed Summons & Controlled Allies controls.
 *
 * It checks real Summon Beast creation, exact placement rejection, shared initiative
 * with independent actor resources, source-owned cleanup, command range, stable event
 * replay requests, and deterministic Reset. The test inspects returned production
 * transactions rather than substituting a second scenario-only combat result.
 *
 * Covers: summonsControlledScenarioControls.
 */

// ============================================================================
// Test Fixtures
// ============================================================================
// IDs match the mounted teaching board. The control helper always receives the next
// complete selector values, just like PreviewCombatScenarios does in the browser.
// ============================================================================

import { describe, expect, it } from 'vitest';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import { buildCombatTurnGroups } from '../../../../../utils/combat/groupTurnUtils';
import { buildInitiativeOrder } from '../../../../../utils/combat/initiativeUtils';
import summonsControlledScenarioControls, {
  SUMMONS_CONTROLLED_OTHER_SUMMON_ID,
  SUMMONS_CONTROLLED_OWNER_ID,
  SUMMONS_CONTROLLED_SUMMON_ID,
  SUMMONS_CONTROLLED_TARGET_ID,
} from '../summonsControlledScenarioControls';
import type {
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
  PreviewCombatScenarioControlValue,
} from '../PreviewCombatScenarioControlTypes';

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      tiles.set(`${x}-${y}`, {
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: 'floor',
        elevation: 0,
        movementCost: 5,
        blocksLoS: false,
        blocksMovement: false,
        decoration: null,
        effects: [],
      });
    }
  }
  return { dimensions: { width: 16, height: 12 }, tiles, theme: 'dungeon', seed: 0 };
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  const owner = createMockCombatCharacter({
    id: SUMMONS_CONTROLLED_OWNER_ID,
    name: 'Summons & Controlled Allies Tester',
    position: { x: 2, y: 6 },
    team: 'player',
  });
  const target = createMockCombatCharacter({
    id: SUMMONS_CONTROLLED_TARGET_ID,
    name: 'Summons & Controlled Allies Target',
    position: { x: 8, y: 6 },
    team: 'enemy',
  });
  const placeholder = createMockCombatCharacter({
    id: SUMMONS_CONTROLLED_SUMMON_ID,
    name: 'Controlled Summon',
    position: { x: 5, y: 6 },
    team: 'player',
  });
  return {
    mapData: createMap(),
    characters: [owner, target, placeholder],
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

function apply(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
  value: PreviewCombatScenarioControlValue,
  controlValues: Record<string, PreviewCombatScenarioControlValue> = {},
): PreviewCombatScenarioControlPatch {
  return summonsControlledScenarioControls.applyControl({
    controlId,
    value,
    snapshot: { ...snapshot, controlValues },
  });
}

function withPatch(
  snapshot: PreviewCombatScenarioControlSnapshot,
  patch: PreviewCombatScenarioControlPatch,
): PreviewCombatScenarioControlSnapshot {
  return {
    ...snapshot,
    mapData: patch.mapData ?? snapshot.mapData,
    characters: patch.characters ?? snapshot.characters,
  };
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Expected CS14 actor ${id}.`);
  return character;
}

describe('summonsControlledScenarioControls', () => {
  it('registers four lifecycle and command controls with inert action defaults', () => {
    expect(summonsControlledScenarioControls.scenarioId).toBe('summons_controlled');
    expect(summonsControlledScenarioControls.controls.map(control => control.id)).toEqual([
      'lifecycle_case',
      'resolve_lifecycle',
      'command_case',
      'resolve_command',
    ]);
    expect(summonsControlledScenarioControls.controls.map(control => control.defaultValue)).toEqual([
      'ready', false, 'advance_to_summon', false,
    ]);
  });

  it('builds a real owned summon, exact rival ownership, shared order, and independent ledgers', () => {
    const baseline = apply(createSnapshot(), 'lifecycle_case', 'ready');
    const characters = baseline.characters ?? [];
    const owner = findCharacter(characters, SUMMONS_CONTROLLED_OWNER_ID);
    const summon = findCharacter(characters, SUMMONS_CONTROLLED_SUMMON_ID);
    const rival = findCharacter(characters, SUMMONS_CONTROLLED_OTHER_SUMMON_ID);
    const ordered = buildInitiativeOrder(characters);
    const groups = buildCombatTurnGroups(ordered);

    expect(summon).toMatchObject({
      isSummon: true,
      team: 'player',
      initiative: 18,
      summonMetadata: {
        casterId: SUMMONS_CONTROLLED_OWNER_ID,
        spellId: 'summon-beast',
        sourceName: 'Summon Beast',
        initiativePolicy: 'shared',
        commandsPerTurn: 1,
        commandsUsedThisTurn: 0,
      },
      actionEconomy: { action: { used: false, remaining: 1 } },
    });
    expect(owner.actionEconomy.action.used).toBe(false);
    expect(rival.summonMetadata?.casterId).toBe(SUMMONS_CONTROLLED_TARGET_ID);
    expect(groups.find(group => group.memberIds.includes(owner.id))?.memberIds)
      .toEqual([owner.id, summon.id]);
  });

  it('creates the summon through production payment and materializes Rend at the chosen space', () => {
    const initial = createSnapshot();
    const prepared = apply(initial, 'lifecycle_case', 'summon_legal');
    const preparedSnapshot = withPatch(initial, prepared);
    const resolved = apply(
      preparedSnapshot,
      'resolve_lifecycle',
      true,
      { lifecycle_case: 'summon_legal' },
    );
    const owner = findCharacter(resolved.characters ?? [], SUMMONS_CONTROLLED_OWNER_ID);
    const summon = findCharacter(resolved.characters ?? [], SUMMONS_CONTROLLED_SUMMON_ID);

    expect(owner.actionEconomy.action.used).toBe(true);
    expect(owner.spellSlots?.level_2.current).toBe(0);
    expect(owner.concentratingOn).toMatchObject({ spellId: 'summon-beast' });
    expect(summon.position).toEqual({ x: 6, y: 6 });
    expect(summon.actionEconomy.action.used).toBe(false);
    expect(summon.abilities.find(ability => ability.name === 'Rend')?.effects)
      .toContainEqual(expect.objectContaining({ type: 'damage', dice: '1d8 + 4 + 2' }));
    expect(resolved.reinitializeCombat).toBe(true);
  });

  it('keeps range and occupancy rejections atomic and accepts the exact 90-foot edge', () => {
    const initial = createSnapshot();
    const edgePrepared = apply(initial, 'lifecycle_case', 'summon_edge');
    const edgeResolved = apply(
      withPatch(initial, edgePrepared),
      'resolve_lifecycle',
      true,
      { lifecycle_case: 'summon_edge' },
    );
    expect(findCharacter(edgeResolved.characters ?? [], SUMMONS_CONTROLLED_SUMMON_ID).position)
      .toEqual({ x: 20, y: 6 });

    for (const choice of ['summon_out_of_range', 'summon_occupied'] as const) {
      const prepared = apply(initial, 'lifecycle_case', choice);
      const preparedSnapshot = withPatch(initial, prepared);
      const ownerBefore = findCharacter(preparedSnapshot.characters, SUMMONS_CONTROLLED_OWNER_ID);
      const rejected = apply(
        preparedSnapshot,
        'resolve_lifecycle',
        true,
        { lifecycle_case: choice },
      );

      expect(rejected.characters).toBeUndefined();
      expect(rejected.logMessage).toContain('ATOMIC NO-OP');
      expect(ownerBefore.actionEconomy.action.used).toBe(false);
      expect(ownerBefore.spellSlots?.level_2.current).toBe(1);
    }
  });

  it('despawns only the exact owned summon on source loss and makes replay a no-op', () => {
    const initial = createSnapshot();
    const baseline = apply(initial, 'lifecycle_case', 'source_loss');
    const baselineSnapshot = withPatch(initial, baseline);
    const cleaned = apply(
      baselineSnapshot,
      'resolve_lifecycle',
      true,
      { lifecycle_case: 'source_loss' },
    );
    const cleanedSnapshot = withPatch(baselineSnapshot, cleaned);
    const replay = apply(
      cleanedSnapshot,
      'resolve_lifecycle',
      true,
      { lifecycle_case: 'source_loss' },
    );

    expect(cleaned.characters?.some(character => character.id === SUMMONS_CONTROLLED_SUMMON_ID)).toBe(false);
    expect(cleaned.characters?.some(character => character.id === SUMMONS_CONTROLLED_OTHER_SUMMON_ID)).toBe(true);
    expect(cleaned.removeCharacterFromCombatId).toBe(SUMMONS_CONTROLLED_SUMMON_ID);
    expect(replay.characters).toBeUndefined();
    expect(replay.logMessage).toContain('REPLAY');
  });

  it('uses production End Turn and requests one stable command event only in Rend range', () => {
    const initial = createSnapshot();
    const baseline = apply(initial, 'lifecycle_case', 'ready');
    const summonTurnSnapshot: PreviewCombatScenarioControlSnapshot = {
      ...withPatch(initial, baseline),
      turnState: {
        currentTurn: 1,
        turnOrder: [SUMMONS_CONTROLLED_OWNER_ID, SUMMONS_CONTROLLED_SUMMON_ID, SUMMONS_CONTROLLED_TARGET_ID],
        currentCharacterId: SUMMONS_CONTROLLED_SUMMON_ID,
        phase: 'action',
        actionsThisTurn: [],
      },
    };
    const advance = apply(
      { ...withPatch(initial, baseline), turnState: { ...summonTurnSnapshot.turnState!, currentCharacterId: SUMMONS_CONTROLLED_OWNER_ID } },
      'resolve_command',
      true,
      { command_case: 'advance_to_summon' },
    );
    expect(advance.endTurn).toBe(true);

    const legalPrepared = apply(summonTurnSnapshot, 'command_case', 'legal');
    const legal = apply(
      withPatch(summonTurnSnapshot, legalPrepared),
      'resolve_command',
      true,
      { command_case: 'legal' },
    );
    const replay = apply(
      withPatch(summonTurnSnapshot, legalPrepared),
      'resolve_command',
      true,
      { command_case: 'replay' },
    );
    expect(legal.abilityExecution).toMatchObject({
      casterId: SUMMONS_CONTROLLED_SUMMON_ID,
      targetId: SUMMONS_CONTROLLED_TARGET_ID,
      executionEventId: 'cs14-command-event-001',
    });
    expect(replay.abilityExecution?.executionEventId).toBe(legal.abilityExecution?.executionEventId);

    const farPrepared = apply(summonTurnSnapshot, 'command_case', 'out_of_range');
    const far = apply(
      withPatch(summonTurnSnapshot, farPrepared),
      'resolve_command',
      true,
      { command_case: 'out_of_range' },
    );
    expect(far.abilityExecution).toBeUndefined();
    expect(far.logMessage).toContain('ATOMIC NO-OP');
  });

  it('reapplies the defaults deterministically for Reset', () => {
    const initial = createSnapshot();
    const first = apply(initial, 'lifecycle_case', 'ready');
    const second = apply(initial, 'lifecycle_case', 'ready');

    expect(second).toEqual(first);
  });
});
