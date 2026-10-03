import { describe, expect, it } from 'vitest';
import mindSliverSpellData from '@/data/spells/level-0/mind-sliver.json';
import guidanceSpellData from '@/data/spells/level-0/guidance.json';
import lightSpellData from '@/data/spells/level-0/light.json';
import holdPersonSpellData from '@/data/spells/level-2/hold-person.json';
import bladeWardSpellData from '@/data/spells/level-0/blade-ward.json';
import blessSpellData from '@/data/spells/level-1/bless.json';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  CombatState,
  TargetableMapObject,
} from '../../../../../types/combat';
import type { Spell, SpellTargeting } from '../../../../../types/spells';
import { createMockCombatCharacter } from '../../../../../utils/core';
import { TargetResolver } from '../../../../../systems/spells/targeting/TargetResolver';
import spellTargetRestrictionsScenarioControlModule, {
  spellTargetRestrictionsScenarioControlModule as namedSpellTargetRestrictionsScenarioControlModule,
} from '../spellTargetRestrictionsScenarioControls';
import type {
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
  PreviewCombatScenarioControlValue,
} from '../PreviewCombatScenarioControlTypes';

/**
 * This file proves that Spell Target Restrictions controls change real target facts.
 *
 * The tests recreate the generic expanded board, apply the shared control contract,
 * and ask the production TargetResolver to judge real Mind Sliver, Hold Person,
 * Guidance, and Light metadata. They also protect fixture purity so one switch
 * cannot mutate the input snapshot or silently reset a neighboring restriction.
 *
 * Covers: spellTargetRestrictionsScenarioControls.ts.
 * Depends on: committed spell JSON, createAbilityFromSpell through the module,
 * TargetResolver, and the shared scenario-control contract.
 */

// ============================================================================
// Stable Test Identities
// ============================================================================
// These ids match the generic expanded scenario and the fixture identities
// installed by the module. Keeping them visible makes every assertion read like
// the player-facing board rather than relying on array positions.
// ============================================================================

const TESTER_ID = 'spell_target_restrictions-tester';
const RESTRICTION_TARGET_ID = 'spell_target_restrictions-target';
const WILLING_ALLY_ID = 'spell-target-restrictions-willing-ally';
const PRACTICE_OBJECT_ID = 'spell-target-restrictions-practice-object';
const UNRELATED_CHARACTER_ID = 'unrelated-observer';
const UNRELATED_OBJECT_ID = 'unrelated-object';

type WillingCombatCharacter = CombatCharacter & {
  isWilling?: boolean;
};

const canonicalSpells = [
  mindSliverSpellData,
  holdPersonSpellData,
  guidanceSpellData,
  lightSpellData,
  bladeWardSpellData,
  blessSpellData,
] as unknown as Spell[];

// ============================================================================
// Generic Expanded-Board Snapshot
// ============================================================================
// The starting actors deliberately lack the restriction fixture. Applying the
// first default must install the spells, canonical target facts, ally, and object
// exactly as the live preview does when this scenario opens or resets.
// ============================================================================

function createFloorTile(x: number, y: number): BattleMapTile {
  // A complete ordinary floor board gives range and line-of-sight checks real
  // map evidence without introducing another rejection before spell metadata.
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'floor',
    elevation: 0,
    movementCost: 5,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

function createMapData(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();

  // Match the live sixteen-by-twelve sandbox so all four target positions use
  // ordinary in-bounds tiles and the production sight algorithm can trace them.
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const tile = createFloorTile(x, y);
      tiles.set(tile.id, tile);
    }
  }

  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    targetableObjects: [{
      id: UNRELATED_OBJECT_ID,
      name: 'Unrelated Object',
      position: { x: 10, y: 9 },
      size: 'Small',
      weightPounds: 2,
      isWornOrCarried: false,
      isMagical: false,
      isFixedToSurface: false,
    }],
    theme: 'dungeon',
    seed: 29,
  };
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  const tester = createMockCombatCharacter({
    id: TESTER_ID,
    name: 'Spell Target Restrictions Tester',
    team: 'player',
    position: { x: 3, y: 5 },
  });
  const target = createMockCombatCharacter({
    id: RESTRICTION_TARGET_ID,
    name: 'Spell Target Restrictions Target',
    team: 'enemy',
    position: { x: 10, y: 5 },
    creatureTypes: ['Half-Orc'],
    stats: {
      ...createMockCombatCharacter({ id: 'stats-template' }).stats,
      creatureTypes: ['Half-Orc'],
    },
  });
  const unrelatedCharacter = createMockCombatCharacter({
    id: UNRELATED_CHARACTER_ID,
    name: 'Unrelated Observer',
    team: 'neutral',
    position: { x: 12, y: 10 },
  });

  return {
    mapData: createMapData(),
    characters: [tester, target, unrelatedCharacter],
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

// ============================================================================
// Shared Contract Application Helpers
// ============================================================================
// The live host layers each returned patch onto the current snapshot. These
// helpers reproduce that behavior, including sequential default application,
// so tests catch controls that accidentally reset another switch.
// ============================================================================

function mergePatch(
  snapshot: PreviewCombatScenarioControlSnapshot,
  patch: PreviewCombatScenarioControlPatch,
): PreviewCombatScenarioControlSnapshot {
  // Preserve every unpatched production-state collection exactly as the parent
  // component does when one pure control returns its narrow change.
  return {
    mapData: patch.mapData ?? snapshot.mapData,
    characters: patch.characters ?? snapshot.characters,
    activeLightSources: patch.activeLightSources ?? snapshot.activeLightSources,
    reactiveTriggers: patch.reactiveTriggers ?? snapshot.reactiveTriggers,
    spellZones: patch.spellZones ?? snapshot.spellZones,
    controlValues: snapshot.controlValues,
  };
}

function applyControl(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
  value: PreviewCombatScenarioControlValue,
): PreviewCombatScenarioControlSnapshot {
  // Tests intentionally enter through the default export because that is the
  // single module value the shared registry will consume.
  const controlValues = { ...snapshot.controlValues, [controlId]: value };
  const patch = spellTargetRestrictionsScenarioControlModule.applyControl({
    controlId,
    value,
    snapshot: { ...snapshot, controlValues },
  });
  return { ...mergePatch(snapshot, patch), controlValues };
}

function applyDefaults(
  snapshot: PreviewCombatScenarioControlSnapshot = createSnapshot(),
): PreviewCombatScenarioControlSnapshot {
  let controlled = snapshot;

  // Reset Board applies defaults in declaration order. Passing each updated
  // snapshot forward proves that initial fixture installation is idempotent.
  for (const control of spellTargetRestrictionsScenarioControlModule.controls) {
    controlled = applyControl(
      controlled,
      control.id,
      control.defaultValue,
    );
  }

  return controlled;
}

function getCharacter(
  snapshot: PreviewCombatScenarioControlSnapshot,
  characterId: string,
): CombatCharacter {
  // Every successful fixture application must retain its stable actor ids.
  const character = snapshot.characters.find(candidate => candidate.id === characterId);
  expect(character).toBeDefined();
  return character as CombatCharacter;
}

function getPracticeObject(
  snapshot: PreviewCombatScenarioControlSnapshot,
): TargetableMapObject {
  // The map object registry is the canonical source read by object targeting.
  const targetObject = snapshot.mapData?.targetableObjects?.find(candidate =>
    candidate.id === PRACTICE_OBJECT_ID,
  );
  expect(targetObject).toBeDefined();
  return targetObject as TargetableMapObject;
}

function createCombatState(
  snapshot: PreviewCombatScenarioControlSnapshot,
): CombatState {
  const tester = getCharacter(snapshot, TESTER_ID);

  // This is the smallest complete state TargetResolver needs for relation,
  // taxonomy, consent, object eligibility, range, plane, and line-of-sight rules.
  return {
    isActive: true,
    characters: snapshot.characters,
    turnState: {
      currentTurn: 0,
      turnOrder: snapshot.characters.map(character => character.id),
      currentCharacterId: tester.id,
      phase: 'action',
      actionsThisTurn: [],
    },
    selectedCharacterId: tester.id,
    selectedAbilityId: null,
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: snapshot.reactiveTriggers,
    activeLightSources: snapshot.activeLightSources,
    mapData: snapshot.mapData ?? undefined,
  };
}

function getSpellTargeting(spellId: string): SpellTargeting {
  // The committed JSON is passed unchanged to the production resolver. The
  // assertion only narrows JSON strings to the runtime targeting vocabulary.
  const spell = canonicalSpells.find(candidate => candidate.id === spellId);
  expect(spell).toBeDefined();
  return spell!.targeting as SpellTargeting;
}

// ============================================================================
// Public Contract and Canonical Fixture
// ============================================================================
// These assertions protect the registry-facing shape and verify that defaults
// produce four genuinely converted spell abilities instead of preview-only mocks.
// ============================================================================

describe('spellTargetRestrictionsScenarioControlModule', () => {
  it('default-exports one pure module with expected-first selectors, legacy fact toggles, replay, and exact Reset', () => {
    expect(spellTargetRestrictionsScenarioControlModule).toBe(
      namedSpellTargetRestrictionsScenarioControlModule,
    );
    expect(spellTargetRestrictionsScenarioControlModule.scenarioId).toBe(
      'spell_target_restrictions',
    );
    expect(spellTargetRestrictionsScenarioControlModule.controls.map(control => [
      control.id,
      control.defaultValue,
    ])).toEqual([
      ['target_case', 'hostile_creature'],
      ['spatial_case', 'clear'],
      ['enemy_is_hostile', true],
      ['target_is_humanoid', true],
      ['ally_is_willing', true],
      ['object_is_loose', true],
      ['resolve_target_attempt', false],
      ['replay_target_attempt', false],
      ['reset_targeting_board', false],
    ]);
  });

  it('installs canonical spell, creature, ally, and object facts without mutating the input', () => {
    const snapshot = createSnapshot();
    const originalMap = snapshot.mapData;
    const originalTarget = getCharacter(snapshot, RESTRICTION_TARGET_ID);
    const originalUnrelatedCharacter = getCharacter(snapshot, UNRELATED_CHARACTER_ID);
    const originalUnrelatedObject = originalMap?.targetableObjects?.[0];

    const controlled = applyDefaults(snapshot);
    const tester = getCharacter(controlled, TESTER_ID);
    const target = getCharacter(controlled, RESTRICTION_TARGET_ID);
    const ally = getCharacter(controlled, WILLING_ALLY_ID) as WillingCombatCharacter;
    const practiceObject = getPracticeObject(controlled);
    const restrictionAbilities = tester.abilities.filter(ability =>
      canonicalSpells.some(spell => spell.id === ability.id),
    );

    expect(restrictionAbilities.map(ability => [ability.id, ability.targeting])).toEqual([
      ['mind-sliver', 'single_enemy'],
      ['hold-person', 'single_any'],
      ['guidance', 'single_ally'],
      ['light', 'single_any'],
      ['blade-ward', 'self'],
      // The legacy Ability label has no multi enum, but the unchanged embedded
      // spell metadata below remains the production `multi` authority.
      ['bless', 'single_any'],
    ]);
    expect(restrictionAbilities.map(ability => ability.spell?.targeting)).toEqual(
      canonicalSpells.map(spell => spell.targeting),
    );
    expect(tester.spellSlots?.level_2).toEqual({ current: 2, max: 2 });
    expect(target).toMatchObject({
      name: 'Restriction Target',
      position: { x: 6, y: 5 },
      team: 'enemy',
      creatureTypes: ['Humanoid'],
      abilities: [],
    });
    expect(target.stats.creatureTypes).toEqual(['Humanoid']);
    expect(ally).toMatchObject({
      name: 'Willing Volunteer',
      position: { x: 3, y: 6 },
      team: 'player',
      isWilling: true,
      abilities: [],
    });
    expect(practiceObject).toMatchObject({
      name: 'Practice Lantern',
      position: { x: 4, y: 5 },
      isWornOrCarried: false,
      isMagical: false,
      isFixedToSurface: false,
    });

    // Input and unrelated records must remain unchanged and reusable by the
    // caller after the pure control module returns its copied patch.
    expect(snapshot.mapData).toBe(originalMap);
    expect(originalTarget.position).toEqual({ x: 10, y: 5 });
    expect(originalTarget.creatureTypes).toEqual(['Half-Orc']);
    expect(getCharacter(controlled, UNRELATED_CHARACTER_ID)).toBe(originalUnrelatedCharacter);
    expect(controlled.mapData?.targetableObjects?.find(candidate =>
      candidate.id === UNRELATED_OBJECT_ID,
    )).toBe(originalUnrelatedObject);
  });

  // ========================================================================
  // Enemy Relation Restriction
  // ========================================================================
  // Mind Sliver's committed metadata includes the enemies filter. The target's
  // team is the only fact this switch changes.
  // ========================================================================

  it('switches Mind Sliver between allowed enemy and rejected ally relation', () => {
    const controlled = applyDefaults();
    const tester = getCharacter(controlled, TESTER_ID);
    const enemy = getCharacter(controlled, RESTRICTION_TARGET_ID);
    const targeting = getSpellTargeting('mind-sliver');

    expect(TargetResolver.getTargetRejectionReason(
      targeting,
      tester,
      enemy,
      createCombatState(controlled),
    )).toBeNull();

    const allied = applyControl(controlled, 'enemy_is_hostile', false);
    const alliedTarget = getCharacter(allied, RESTRICTION_TARGET_ID);

    expect(alliedTarget.team).toBe('player');
    expect(alliedTarget.creatureTypes).toEqual(['Humanoid']);
    expect(TargetResolver.getTargetRejectionReason(
      targeting,
      tester,
      alliedTarget,
      createCombatState(allied),
    )).toMatchObject({
      code: 'requires_enemy',
      message: 'This spell can only target enemies.',
    });

    const restored = applyControl(allied, 'enemy_is_hostile', true);
    expect(getCharacter(restored, RESTRICTION_TARGET_ID).team).toBe('enemy');
  });

  // ========================================================================
  // Creature Taxonomy Restriction
  // ========================================================================
  // Hold Person reads the real Humanoid filter. Both taxonomy storage locations
  // must move together so neither compatibility path leaves the spell allowed.
  // ========================================================================

  it('switches Hold Person between allowed Humanoid and rejected Undead taxonomy', () => {
    const controlled = applyDefaults();
    const tester = getCharacter(controlled, TESTER_ID);
    const humanoid = getCharacter(controlled, RESTRICTION_TARGET_ID);
    const targeting = getSpellTargeting('hold-person');

    expect(TargetResolver.getTargetRejectionReason(
      targeting,
      tester,
      humanoid,
      createCombatState(controlled),
    )).toBeNull();

    const undead = applyControl(controlled, 'target_is_humanoid', false);
    const undeadTarget = getCharacter(undead, RESTRICTION_TARGET_ID);

    expect(undeadTarget.creatureTypes).toEqual(['Undead']);
    expect(undeadTarget.stats.creatureTypes).toEqual(['Undead']);
    expect(undeadTarget.team).toBe('enemy');
    expect(TargetResolver.getTargetRejectionReason(
      targeting,
      tester,
      undeadTarget,
      createCombatState(undead),
    )).toMatchObject({ code: 'target_filter_failed' });

    const restored = applyControl(undead, 'target_is_humanoid', true);
    expect(getCharacter(restored, RESTRICTION_TARGET_ID).creatureTypes).toEqual(['Humanoid']);
  });

  // ========================================================================
  // Willing-Creature Restriction
  // ========================================================================
  // Guidance's filter consumes the explicit isWilling marker while team and
  // touch range remain stable. This proves consent independently of ally status.
  // ========================================================================

  it('switches Guidance between a willing ally and explicit refusal', () => {
    const controlled = applyDefaults();
    const tester = getCharacter(controlled, TESTER_ID);
    const willingAlly = getCharacter(controlled, WILLING_ALLY_ID) as WillingCombatCharacter;
    const targeting = getSpellTargeting('guidance');

    expect(TargetResolver.getTargetRejectionReason(
      targeting,
      tester,
      willingAlly,
      createCombatState(controlled),
    )).toBeNull();

    const unwilling = applyControl(controlled, 'ally_is_willing', false);
    const unwillingAlly = getCharacter(unwilling, WILLING_ALLY_ID) as WillingCombatCharacter;

    expect(unwillingAlly.isWilling).toBe(false);
    expect(unwillingAlly.team).toBe('player');
    expect(TargetResolver.getTargetRejectionReason(
      targeting,
      tester,
      unwillingAlly,
      createCombatState(unwilling),
    )).toMatchObject({ code: 'target_filter_failed' });

    const restored = applyControl(unwilling, 'ally_is_willing', true);
    expect((getCharacter(restored, WILLING_ALLY_ID) as WillingCombatCharacter).isWilling).toBe(true);
  });

  // ========================================================================
  // Object Eligibility Restriction
  // ========================================================================
  // Light's live object filter excludes worn or carried objects. The positive
  // switch label writes the inverse production field without changing position.
  // ========================================================================

  it('switches Light between an allowed loose object and worn-or-carried rejection', () => {
    const controlled = applyDefaults();
    const tester = getCharacter(controlled, TESTER_ID);
    const looseObject = getPracticeObject(controlled);
    const targeting = getSpellTargeting('light');

    expect(TargetResolver.getObjectTargetRejectionReason(
      targeting,
      tester,
      looseObject,
      createCombatState(controlled),
    )).toBeNull();

    const carried = applyControl(controlled, 'object_is_loose', false);
    const carriedObject = getPracticeObject(carried);

    expect(carriedObject.isWornOrCarried).toBe(true);
    expect(carriedObject.position).toEqual({ x: 4, y: 5 });
    expect(TargetResolver.getObjectTargetRejectionReason(
      targeting,
      tester,
      carriedObject,
      createCombatState(carried),
    )).toMatchObject({
      code: 'object_worn_or_carried',
      message: 'This spell cannot target an object that is worn or carried.',
    });

    const restored = applyControl(carried, 'object_is_loose', true);
    expect(getPracticeObject(restored).isWornOrCarried).toBe(false);
  });

  // ========================================================================
  // Independence and Safe Failure Behavior
  // ========================================================================
  // Controls are meant to isolate one fact at a time, but a tester can combine
  // them. Later clicks must preserve earlier choices, and malformed requests
  // must not create a partial counterfeit fixture.
  // ========================================================================

  it('preserves neighboring off states when another control changes', () => {
    const controlled = applyDefaults();
    const undead = applyControl(controlled, 'target_is_humanoid', false);
    const unwilling = applyControl(undead, 'ally_is_willing', false);
    const allied = applyControl(unwilling, 'enemy_is_hostile', false);

    expect(getCharacter(allied, RESTRICTION_TARGET_ID)).toMatchObject({
      team: 'player',
      creatureTypes: ['Undead'],
    });
    expect((getCharacter(allied, WILLING_ALLY_ID) as WillingCombatCharacter).isWilling).toBe(false);
    expect(getPracticeObject(allied).isWornOrCarried).toBe(false);
  });

  it('returns log-only patches for invalid values, stale ids, or unavailable fixtures', () => {
    const invalidValue = spellTargetRestrictionsScenarioControlModule.applyControl({
      controlId: 'enemy_is_hostile',
      value: 'false',
      snapshot: createSnapshot(),
    });
    const unknownControl = spellTargetRestrictionsScenarioControlModule.applyControl({
      controlId: 'not-a-real-control',
      value: true,
      snapshot: createSnapshot(),
    });
    const missingFixture = spellTargetRestrictionsScenarioControlModule.applyControl({
      controlId: 'enemy_is_hostile',
      value: true,
      snapshot: {
        mapData: null,
        characters: [],
        activeLightSources: [],
        reactiveTriggers: [],
      },
    });

    expect(invalidValue.characters).toBeUndefined();
    expect(invalidValue.mapData).toBeUndefined();
    expect(invalidValue.logMessage).toContain('requires an on/off value');
    expect(unknownControl.characters).toBeUndefined();
    expect(unknownControl.mapData).toBeUndefined();
    expect(unknownControl.logMessage).toContain('Unknown Spell Target Restrictions control');
    expect(missingFixture.characters).toBeUndefined();
    expect(missingFixture.mapData).toBeUndefined();
    expect(missingFixture.logMessage).toContain('tester, or target is unavailable');
  });

  it('rejects unwilling, out-of-range, Total Cover, duplicate, and over-cap attempts before payment', () => {
    const baseline = applyDefaults();
    const cases: Array<[string, string, string]> = [
      ['target_case', 'unwilling_ally', 'target_filter_failed'],
      ['spatial_case', 'out_of_range', 'out_of_range'],
      ['spatial_case', 'total_cover', 'line_of_sight_blocked'],
      ['target_case', 'multi_duplicate', 'duplicate_target'],
      ['target_case', 'multi_over_cap', 'too_many_targets'],
    ];

    for (const [controlId, value, expectedCode] of cases) {
      const prepared = applyControl(baseline, controlId, value);
      const patch = spellTargetRestrictionsScenarioControlModule.applyControl({
        controlId: 'resolve_target_attempt',
        value: true,
        snapshot: prepared,
      });
      expect(patch.abilityExecution).toBeUndefined();
      expect(patch.logMessage).toContain(`TARGET REJECTED (${expectedCode})`);
      expect(patch.logMessage).toContain('Action, slot, stable event, commands, and rolls were not started');
    }
  });

  it('accepts legal hostile, self, object, and three-unique selections and emits one stable replay id', () => {
    const baseline = applyDefaults();

    for (const targetCase of ['hostile_creature', 'self', 'loose_object', 'multi_unique']) {
      const prepared = applyControl(baseline, 'target_case', targetCase);
      const patch = spellTargetRestrictionsScenarioControlModule.applyControl({
        controlId: 'resolve_target_attempt',
        value: true,
        snapshot: prepared,
      });
      expect(patch.logMessage).toContain('TARGET VALID');
      expect(patch.logMessage).not.toContain('TARGET REJECTED');
    }

    const legal = applyControl(baseline, 'target_case', 'hostile_creature');
    const first = spellTargetRestrictionsScenarioControlModule.applyControl({
      controlId: 'resolve_target_attempt', value: true, snapshot: legal,
    });
    const replay = spellTargetRestrictionsScenarioControlModule.applyControl({
      controlId: 'replay_target_attempt', value: true, snapshot: legal,
    });
    expect(first.abilityExecution?.executionEventId).toBe('spell-target-restrictions-stable-cast');
    expect(replay.abilityExecution?.executionEventId).toBe(first.abilityExecution?.executionEventId);
    expect(replay.logMessage).toContain('production must return a no-op');
  });

  it('restores exact authored target facts and ready resources through Reset', () => {
    let changed = applyDefaults();
    changed = applyControl(changed, 'enemy_is_hostile', false);
    changed = applyControl(changed, 'ally_is_willing', false);
    changed = applyControl(changed, 'object_is_loose', false);
    const patch = spellTargetRestrictionsScenarioControlModule.applyControl({
      controlId: 'reset_targeting_board', value: true, snapshot: changed,
    });
    const reset = mergePatch(changed, patch);

    expect(patch.reinitializeCombat).toBe(true);
    expect(getCharacter(reset, RESTRICTION_TARGET_ID)).toMatchObject({
      team: 'enemy',
      position: { x: 6, y: 5 },
      creatureTypes: ['Humanoid'],
    });
    expect(getCharacter(reset, WILLING_ALLY_ID)).toMatchObject({ isWilling: true });
    expect(getPracticeObject(reset).isWornOrCarried).toBe(false);
    expect(getCharacter(reset, TESTER_ID).actionEconomy.action.used).toBe(false);
    expect(getCharacter(reset, TESTER_ID).spellSlots?.level_2).toEqual({ current: 2, max: 2 });
  });
});
