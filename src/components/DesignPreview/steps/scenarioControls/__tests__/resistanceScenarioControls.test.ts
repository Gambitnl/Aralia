import { describe, expect, it } from 'vitest';
import { DamageCommand } from '../../../../../commands/effects/DamageCommand';
import { AbilityCommandFactory } from '../../../../../commands/factory/AbilityCommandFactory';
import type { CommandContext } from '../../../../../commands/base/SpellCommand';
import type { CombatCharacter } from '../../../../../types/combat';
import type { DamageEffect } from '../../../../../types/spells';
import {
  createMockCombatCharacter,
  createMockCombatState,
  createMockCommandContext,
  createMockGameState,
} from '../../../../../utils/core';
import type {
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
  PreviewCombatScenarioControlValue,
} from '../PreviewCombatScenarioControlTypes';
import resistanceScenarioControlModule from '../resistanceScenarioControls';
import {
  RESISTANCE_FIRE_ELEMENTAL_ID,
  RESISTANCE_PLAYER_ELEMENTALIST_ID,
  RESISTANCE_PROOF_CASE_CONTROL_ID,
  RESISTANCE_REPLAY_CONTROL_ID,
  RESISTANCE_RESOLVE_CONTROL_ID,
} from '../resistanceScenarioControls';

/**
 * This file proves the Resistance & Vulnerability controls change real combat facts.
 *
 * The first checks protect the four player-facing switches, their pure roster
 * updates, and the fixed calibration abilities. The final checks pass those
 * updated targets into the production DamageCommand, proving that the switches
 * produce half, double, zero, and ordinary damage in the real combat log.
 *
 * Called by: focused Vitest scenario-control verification.
 * Depends on: resistanceScenarioControls and the production DamageCommand.
 */

// ============================================================================
// Representative Scenario Snapshot
// ============================================================================
// These actors use the stable ids from the live Resistance board. Unrelated
// defenses and a bystander make preservation observable instead of assuming
// that replacing a whole defensive list is harmless.
// ============================================================================

function createResistanceSnapshot(): PreviewCombatScenarioControlSnapshot {
  const elementalist = createMockCombatCharacter({
    id: 'player-elementalist',
    name: 'Player Elementalist',
    team: 'player',
    currentHP: 40,
    maxHP: 40,
    abilities: [
      {
        id: 'fire-bolt',
        name: 'Fire Bolt',
        description: 'Existing scenario spell.',
        type: 'spell',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: 24,
        effects: [{ type: 'damage', value: 0, dice: '2d10', damageType: 'fire' }],
        icon: 'F',
        isProficient: true,
        isMagical: true,
      },
    ],
  });
  const skeleton = createMockCombatCharacter({
    id: 'skeleton-archer',
    name: 'Skeleton Archer',
    team: 'enemy',
    currentHP: 100,
    maxHP: 100,
    vulnerabilities: ['bludgeoning', 'radiant'],
  });
  const fireElemental = createMockCombatCharacter({
    id: 'fire-elemental',
    name: 'Fire Elemental',
    team: 'enemy',
    currentHP: 100,
    maxHP: 100,
    resistances: ['piercing', 'slashing', 'bludgeoning', 'thunder'],
    vulnerabilities: ['ice', 'radiant'],
    immunities: ['fire', 'poison', 'psychic'],
  });
  const bystander = createMockCombatCharacter({
    id: 'unrelated-bystander',
    name: 'Unrelated Bystander',
    team: 'neutral',
  });

  return {
    mapData: null,
    characters: [elementalist, skeleton, fireElemental, bystander],
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

// Apply a switch through the same public module used by the shared host. A
// character-focused control without a character patch is a useful hard failure.
function applyControl(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
  value: PreviewCombatScenarioControlValue,
): PreviewCombatScenarioControlPatch & { characters: CombatCharacter[] } {
  const patch = resistanceScenarioControlModule.applyControl({
    controlId,
    value,
    snapshot,
  });

  expect(patch.characters).toBeDefined();
  return patch as PreviewCombatScenarioControlPatch & { characters: CombatCharacter[] };
}

// Find an authored actor explicitly so a missing id reports the scenario fact
// that drifted rather than failing later with an unclear property error.
function findCharacter(characters: CombatCharacter[], characterId: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === characterId);

  if (!character) {
    throw new Error(`Expected Resistance scenario character ${characterId}.`);
  }

  return character;
}

// ============================================================================
// Shared Module Description and Calibration Actions
// ============================================================================
// Defaults define Reset Board behavior. Applying any default also installs the
// same four fixed actions, while repeated controls must never duplicate them or
// replace the existing Fire Bolt fixture.
// ============================================================================

describe('resistanceScenarioControlModule definitions', () => {
  it('preserves four authored trait switches and adds case, resolve, and replay controls', () => {
    expect(resistanceScenarioControlModule.scenarioId).toBe('resistance');
    expect(resistanceScenarioControlModule.controls).toHaveLength(7);
    expect(resistanceScenarioControlModule.controls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'physical-damage-resistance',
        label: 'Bludgeoning, Piercing & Slashing Resistance',
        kind: 'toggle',
        defaultValue: true,
      }),
      expect.objectContaining({
        id: 'cold-vulnerability',
        label: 'Cold Vulnerability',
        kind: 'toggle',
        defaultValue: true,
      }),
      expect.objectContaining({
        id: 'fire-poison-immunity',
        label: 'Fire & Poison Immunity',
        kind: 'toggle',
        defaultValue: true,
      }),
      expect.objectContaining({
        id: 'skeleton-bludgeoning-vulnerability',
        label: 'Skeleton Bludgeoning Vulnerability',
        kind: 'toggle',
        defaultValue: true,
      }),
      expect.objectContaining({
        id: RESISTANCE_PROOF_CASE_CONTROL_ID,
        kind: 'select',
        defaultValue: 'resistance_odd',
      }),
      expect.objectContaining({ id: RESISTANCE_RESOLVE_CONTROL_ID, kind: 'action' }),
      expect.objectContaining({ id: RESISTANCE_REPLAY_CONTROL_ID, kind: 'action' }),
    ]));
  });

  it('adds four fixed ten-damage actions once and preserves existing abilities', () => {
    const snapshot = createResistanceSnapshot();
    const firstPatch = applyControl(snapshot, 'physical-damage-resistance', true);
    const secondPatch = applyControl(
      { ...snapshot, characters: firstPatch.characters },
      'cold-vulnerability',
      true,
    );
    const elementalist = findCharacter(secondPatch.characters, 'player-elementalist');
    const calibrationAbilities = elementalist.abilities.filter(ability =>
      ability.id.startsWith('resistance-calibration-')
    );

    expect(elementalist.abilities.some(ability => ability.id === 'fire-bolt')).toBe(true);
    expect(calibrationAbilities).toHaveLength(4);
    expect(calibrationAbilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Calibrated Piercing (10)',
        effects: [expect.objectContaining({ value: 10, damageType: 'piercing' })],
      }),
      expect.objectContaining({
        name: 'Calibrated Cold (10)',
        effects: [expect.objectContaining({ value: 10, damageType: 'ice' })],
      }),
      expect.objectContaining({
        name: 'Calibrated Fire (10)',
        effects: [expect.objectContaining({ value: 10, damageType: 'fire' })],
      }),
      expect.objectContaining({
        name: 'Calibrated Bludgeoning (10)',
        effects: [expect.objectContaining({ value: 10, damageType: 'bludgeoning' })],
      }),
    ]));
  });
});

// ============================================================================
// Reversible Canonical Trait Facts
// ============================================================================
// Each switch removes only its own damage types, keeps unrelated defenses, and
// can restore canonical names. The bystander remains the same object throughout,
// proving that this module does not rebuild the whole encounter.
// ============================================================================

interface TraitControlCase {
  controlId: string;
  targetId: string;
  traitKey: 'resistances' | 'vulnerabilities' | 'immunities';
  enabledTypes: string[];
  preservedType: string;
  expectedResult: string;
}

const TRAIT_CONTROL_CASES: TraitControlCase[] = [
  {
    controlId: 'physical-damage-resistance',
    targetId: 'fire-elemental',
    traitKey: 'resistances',
    enabledTypes: ['bludgeoning', 'piercing', 'slashing'],
    preservedType: 'thunder',
    expectedResult: 'should deal 5',
  },
  {
    controlId: 'cold-vulnerability',
    targetId: 'fire-elemental',
    traitKey: 'vulnerabilities',
    enabledTypes: ['ice'],
    preservedType: 'radiant',
    expectedResult: 'should deal 20',
  },
  {
    controlId: 'fire-poison-immunity',
    targetId: 'fire-elemental',
    traitKey: 'immunities',
    enabledTypes: ['fire', 'poison'],
    preservedType: 'psychic',
    expectedResult: 'should deal 0',
  },
  {
    controlId: 'skeleton-bludgeoning-vulnerability',
    targetId: 'skeleton-archer',
    traitKey: 'vulnerabilities',
    enabledTypes: ['bludgeoning'],
    preservedType: 'radiant',
    expectedResult: 'should deal 20',
  },
];

describe.each(TRAIT_CONTROL_CASES)('$controlId control', testCase => {
  it('switches its owned trait off and on without mutating unrelated state', () => {
    const snapshot = createResistanceSnapshot();
    const bystander = findCharacter(snapshot.characters, 'unrelated-bystander');
    const offPatch = applyControl(snapshot, testCase.controlId, false);
    const disabledTarget = findCharacter(offPatch.characters, testCase.targetId);
    const disabledTypes = disabledTarget[testCase.traitKey] ?? [];

    expect(disabledTypes).not.toEqual(expect.arrayContaining(testCase.enabledTypes));
    expect(disabledTypes).toContain(testCase.preservedType);
    expect(offPatch.logMessage).toContain('should deal 10');
    expect(findCharacter(offPatch.characters, 'unrelated-bystander')).toBe(bystander);

    const onPatch = applyControl(
      { ...snapshot, characters: offPatch.characters },
      testCase.controlId,
      true,
    );
    const enabledTarget = findCharacter(onPatch.characters, testCase.targetId);
    const enabledTypes = enabledTarget[testCase.traitKey] ?? [];

    expect(enabledTypes).toEqual(expect.arrayContaining(testCase.enabledTypes));
    expect(enabledTypes).toContain(testCase.preservedType);
    expect(onPatch.logMessage).toContain(testCase.expectedResult);

    // The incoming roster is a historical snapshot owned by the host. Pure
    // controls must not retroactively normalize or remove its lowercase facts.
    expect(findCharacter(snapshot.characters, 'fire-elemental').vulnerabilities).toContain('ice');
  });
});

// ============================================================================
// Production DamageCommand Proof
// ============================================================================
// A ten-sided expression made from ten one-sided dice always rolls exactly ten,
// while still exercising DamageCommand's normal dice, mitigation, HP, and log
// path. Each pair compares the same target fact On and Off.
// ============================================================================

interface DamageProofCase {
  controlId: string;
  targetId: string;
  damageType: string;
  enabledDamage: number;
}

const DAMAGE_PROOF_CASES: DamageProofCase[] = [
  {
    controlId: 'physical-damage-resistance',
    targetId: 'fire-elemental',
    damageType: 'piercing',
    enabledDamage: 5,
  },
  {
    controlId: 'cold-vulnerability',
    targetId: 'fire-elemental',
    damageType: 'ice',
    enabledDamage: 20,
  },
  {
    controlId: 'fire-poison-immunity',
    targetId: 'fire-elemental',
    damageType: 'fire',
    enabledDamage: 0,
  },
  {
    controlId: 'skeleton-bludgeoning-vulnerability',
    targetId: 'skeleton-archer',
    damageType: 'bludgeoning',
    enabledDamage: 20,
  },
];

async function executeTenDamage(
  characters: CombatCharacter[],
  targetId: string,
  damageType: string,
): Promise<{ damage: number; target: CombatCharacter }> {
  const caster = findCharacter(characters, 'player-elementalist');
  const target = findCharacter(characters, targetId);
  const context = createMockCommandContext({
    spellId: `calibrated-${damageType.toLowerCase()}`,
    spellName: `Calibrated ${damageType} (10)`,
    caster,
    targets: [target],
    castAtLevel: 0,
    isMagical: true,
    gameState: createMockGameState(),
  }) as CommandContext;
  const effect: DamageEffect = {
    type: 'DAMAGE',
    damage: { dice: '10d1', type: damageType },
    trigger: { type: 'immediate' },
    condition: { type: 'always' },
  };

  // Execute the production command against only the participants in this hit.
  // This isolates the defense fact while preserving real HP and combat-log work.
  const result = await new DamageCommand(effect, context).execute(
    createMockCombatState({
      characters: [caster, target],
      combatLog: [],
    }),
  );
  const updatedTarget = findCharacter(result.characters, targetId);
  const damageEntry = result.combatLog.find(entry => entry.type === 'damage');

  return {
    damage: Number(damageEntry?.data?.value),
    target: updatedTarget,
  };
}

describe.each(DAMAGE_PROOF_CASES)('$controlId production damage proof', proofCase => {
  it(`changes ten ${proofCase.damageType} damage between the controlled result and ordinary damage`, async () => {
    const snapshot = createResistanceSnapshot();
    const onPatch = applyControl(snapshot, proofCase.controlId, true);
    const onResult = await executeTenDamage(
      onPatch.characters,
      proofCase.targetId,
      proofCase.damageType,
    );
    const offPatch = applyControl(snapshot, proofCase.controlId, false);
    const offResult = await executeTenDamage(
      offPatch.characters,
      proofCase.targetId,
      proofCase.damageType,
    );

    expect(onResult.damage).toBe(proofCase.enabledDamage);
    expect(onResult.target.currentHP).toBe(100 - proofCase.enabledDamage);
    expect(offResult.damage).toBe(10);
    expect(offResult.target.currentHP).toBe(90);
  });
});

// ============================================================================
// Complete Mounted Transaction Requests
// ============================================================================
// The expanded selector prepares exact transaction shapes while the two action
// controls hand one stable ability event to the mounted hook. Production factory
// commands prove per-component defenses, temporary HP, HP, and downing here;
// the hook-owned event ledger is verified by identical resolve/replay identity.
// ============================================================================

type ProofCaseId =
  | 'normal_10'
  | 'resistance_odd'
  | 'vulnerability_10'
  | 'immunity_10'
  | 'simultaneous_odd'
  | 'duplicate_resistance_odd'
  | 'mixed_components'
  | 'temporary_hp'
  | 'downing';

function createProofControlValues(proofCase: ProofCaseId) {
  return {
    'physical-damage-resistance': true,
    'cold-vulnerability': true,
    'fire-poison-immunity': true,
    'skeleton-bludgeoning-vulnerability': true,
    [RESISTANCE_PROOF_CASE_CONTROL_ID]: proofCase,
    [RESISTANCE_RESOLVE_CONTROL_ID]: false,
    [RESISTANCE_REPLAY_CONTROL_ID]: false,
  };
}

function prepareProofCase(
  snapshot: PreviewCombatScenarioControlSnapshot,
  proofCase: ProofCaseId,
): PreviewCombatScenarioControlPatch & { characters: CombatCharacter[] } {
  const patch = resistanceScenarioControlModule.applyControl({
    controlId: RESISTANCE_PROOF_CASE_CONTROL_ID,
    value: proofCase,
    snapshot: {
      ...snapshot,
      controlValues: createProofControlValues(proofCase),
    },
  });

  expect(patch.characters).toBeDefined();
  expect(patch.reinitializeCombat).toBe(true);
  return patch as PreviewCombatScenarioControlPatch & { characters: CombatCharacter[] };
}

function requestProofEvent(
  characters: CombatCharacter[],
  proofCase: ProofCaseId,
  replay = false,
) {
  return resistanceScenarioControlModule.applyControl({
    controlId: replay ? RESISTANCE_REPLAY_CONTROL_ID : RESISTANCE_RESOLVE_CONTROL_ID,
    value: true,
    snapshot: {
      ...createResistanceSnapshot(),
      characters,
      controlValues: createProofControlValues(proofCase),
    },
  });
}

async function executePreparedProof(proofCase: ProofCaseId) {
  const prepared = prepareProofCase(createResistanceSnapshot(), proofCase);
  const request = requestProofEvent(prepared.characters, proofCase);
  const execution = request.abilityExecution;
  expect(execution).toBeDefined();
  if (!execution) throw new Error(`Missing CS06 execution for ${proofCase}.`);

  const caster = findCharacter(prepared.characters, execution.casterId);
  const target = findCharacter(prepared.characters, execution.targetId);
  const commands = AbilityCommandFactory.createCommands(
    execution.ability,
    caster,
    [target],
    createMockGameState(),
  );
  let state = createMockCombatState({ characters: prepared.characters, combatLog: [] });

  for (const command of commands) {
    state = await command.execute(state);
  }

  return { prepared, request, execution, state };
}

describe('Resistance complete transaction controls', () => {
  it('prepares one Action owner and replays the exact stable event without rebuilding state', () => {
    const prepared = prepareProofCase(createResistanceSnapshot(), 'mixed_components');
    const first = requestProofEvent(prepared.characters, 'mixed_components');
    const replay = requestProofEvent(prepared.characters, 'mixed_components', true);

    expect(first.abilityExecution).toMatchObject({
      casterId: RESISTANCE_PLAYER_ELEMENTALIST_ID,
      targetId: RESISTANCE_FIRE_ELEMENTAL_ID,
      executionEventId: 'cs06-mixed_components-event-001',
      executionDecision: 'accept',
      ability: {
        cost: { type: 'action' },
        effects: [
          { type: 'damage', value: 9, damageType: 'piercing' },
          { type: 'damage', value: 5, damageType: 'ice' },
        ],
      },
    });
    expect(replay.characters).toBeUndefined();
    expect(replay.abilityExecution?.executionEventId)
      .toBe(first.abilityExecution?.executionEventId);
    expect(replay.logMessage).toContain('must preserve Action, HP, temporary HP, and logs');
  });

  it('makes Reset preparation deterministic after HP, temp HP, action, and downing drift', () => {
    const first = prepareProofCase(createResistanceSnapshot(), 'temporary_hp');
    const drifted = first.characters.map(character => ({
      ...character,
      currentHP: 0,
      tempHP: 0,
      actionEconomy: {
        ...character.actionEconomy,
        action: { used: true, remaining: 0 },
      },
    }));
    const reset = prepareProofCase(
      { ...createResistanceSnapshot(), characters: drifted },
      'temporary_hp',
    );
    const target = findCharacter(reset.characters, RESISTANCE_FIRE_ELEMENTAL_ID);
    const owner = findCharacter(reset.characters, RESISTANCE_PLAYER_ELEMENTALIST_ID);

    expect(target.currentHP).toBe(60);
    expect(target.tempHP).toBe(3);
    expect(target.temporaryHitPointSource).toBe('CS06 Buffer');
    expect(owner.currentHP).toBe(40);
    expect(owner.actionEconomy.action).toEqual({ used: false, remaining: 1 });
    expect(owner.deathSaves).toBeUndefined();
  });

  it('assigns the downing transaction to the enemy Action owner and player HP target', () => {
    const prepared = prepareProofCase(createResistanceSnapshot(), 'downing');
    const request = requestProofEvent(prepared.characters, 'downing');

    expect(request.abilityExecution).toMatchObject({
      casterId: RESISTANCE_FIRE_ELEMENTAL_ID,
      targetId: RESISTANCE_PLAYER_ELEMENTALIST_ID,
      ability: { cost: { type: 'action' } },
    });
  });
});

interface CompleteDamageCase {
  proofCase: ProofCaseId;
  targetId: string;
  expectedHP: number;
  expectedTempHP: number;
  expectedDamageEntries: number[];
  expectedDowned?: boolean;
}

const COMPLETE_DAMAGE_CASES: CompleteDamageCase[] = [
  { proofCase: 'normal_10', targetId: RESISTANCE_FIRE_ELEMENTAL_ID, expectedHP: 50, expectedTempHP: 0, expectedDamageEntries: [10] },
  { proofCase: 'resistance_odd', targetId: RESISTANCE_FIRE_ELEMENTAL_ID, expectedHP: 56, expectedTempHP: 0, expectedDamageEntries: [4] },
  { proofCase: 'vulnerability_10', targetId: RESISTANCE_FIRE_ELEMENTAL_ID, expectedHP: 40, expectedTempHP: 0, expectedDamageEntries: [20] },
  { proofCase: 'immunity_10', targetId: RESISTANCE_FIRE_ELEMENTAL_ID, expectedHP: 60, expectedTempHP: 0, expectedDamageEntries: [0] },
  { proofCase: 'simultaneous_odd', targetId: RESISTANCE_FIRE_ELEMENTAL_ID, expectedHP: 52, expectedTempHP: 0, expectedDamageEntries: [8] },
  { proofCase: 'duplicate_resistance_odd', targetId: RESISTANCE_FIRE_ELEMENTAL_ID, expectedHP: 56, expectedTempHP: 0, expectedDamageEntries: [4] },
  { proofCase: 'mixed_components', targetId: RESISTANCE_FIRE_ELEMENTAL_ID, expectedHP: 46, expectedTempHP: 0, expectedDamageEntries: [4, 10] },
  { proofCase: 'temporary_hp', targetId: RESISTANCE_FIRE_ELEMENTAL_ID, expectedHP: 59, expectedTempHP: 0, expectedDamageEntries: [4] },
  { proofCase: 'downing', targetId: RESISTANCE_PLAYER_ELEMENTALIST_ID, expectedHP: 0, expectedTempHP: 0, expectedDamageEntries: [35], expectedDowned: true },
];

describe.each(COMPLETE_DAMAGE_CASES)('$proofCase production transaction', proofCase => {
  it('resolves typed components before one HP/downing update per component', async () => {
    const { state } = await executePreparedProof(proofCase.proofCase);
    const target = findCharacter(state.characters, proofCase.targetId);
    const damageEntries = state.combatLog
      .filter(entry => entry.type === 'damage')
      .map(entry => Number(entry.data?.finalDamage));

    expect(target.currentHP).toBe(proofCase.expectedHP);
    expect(target.tempHP ?? 0).toBe(proofCase.expectedTempHP);
    expect(damageEntries).toEqual(proofCase.expectedDamageEntries);
    if (proofCase.expectedDowned) {
      expect(target.deathSaves).toEqual({ successes: 0, failures: 0, isStable: false });
      expect(target.statusEffects.some(status => status.name === 'Unconscious')).toBe(true);
    }
  });
});

// ============================================================================
// Safe Failure Behavior
// ============================================================================
// Stale control values and absent authored targets should remain visible in the
// log while returning no roster patch. The module never selects a substitute.
// ============================================================================

describe('safe Resistance control failures', () => {
  it('returns no character patch for invalid values and unknown controls', () => {
    const snapshot = createResistanceSnapshot();
    const invalidPatch = resistanceScenarioControlModule.applyControl({
      controlId: 'cold-vulnerability',
      value: 'enabled',
      snapshot,
    });
    const unknownPatch = resistanceScenarioControlModule.applyControl({
      controlId: 'stale-control',
      value: true,
      snapshot,
    });

    expect(invalidPatch.characters).toBeUndefined();
    expect(invalidPatch.logMessage).toContain('requires an on/off value');
    expect(unknownPatch.characters).toBeUndefined();
    expect(unknownPatch.logMessage).toContain('Unknown Resistance & Vulnerability control');
  });

  it('does not redirect a control when its authored target is missing', () => {
    const snapshot = createResistanceSnapshot();
    const withoutElemental = {
      ...snapshot,
      characters: snapshot.characters.filter(character => character.id !== 'fire-elemental'),
    };
    const patch = resistanceScenarioControlModule.applyControl({
      controlId: 'cold-vulnerability',
      value: true,
      snapshot: withoutElemental,
    });

    expect(patch.characters).toBeUndefined();
    expect(patch.logMessage).toContain('Fire Elemental is unavailable');
  });
});
