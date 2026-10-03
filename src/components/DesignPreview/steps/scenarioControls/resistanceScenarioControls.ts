// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 14:33:02
 * Dependents: components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Ability, CombatCharacter } from '../../../../types/combat';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import { removeUnconsciousCondition } from '../../../../utils/combat/deathSaveUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

/**
 * This file owns the switchable damage-defense facts for the Resistance & Vulnerability sandbox.
 *
 * Four switches add or remove the real resistance, vulnerability, and immunity
 * entries consumed by DamageCommand. A case selector plus Resolve and Replay
 * prepare deterministic odd, mixed-component, temporary-HP, downing, duplicate,
 * and simultaneous-trait transactions for the mounted production ability path.
 *
 * Called by: the Tactical Sandbox scenario-control registry.
 * Depends on: the shared scenario-control contract and production combat-character state.
 */

// ============================================================================
// Stable Scenario Identities
// ============================================================================
// The existing Resistance board gives each participant a stable id. Controls
// target those ids instead of display names, so renaming a token cannot redirect
// a switch to another creature that happens to have similar defenses.
// ============================================================================

export const RESISTANCE_PLAYER_ELEMENTALIST_ID = 'player-elementalist';
export const RESISTANCE_FIRE_ELEMENTAL_ID = 'fire-elemental';
export const RESISTANCE_SKELETON_ARCHER_ID = 'skeleton-archer';

const PHYSICAL_RESISTANCE_CONTROL_ID = 'physical-damage-resistance';
const COLD_VULNERABILITY_CONTROL_ID = 'cold-vulnerability';
const ELEMENTAL_IMMUNITY_CONTROL_ID = 'fire-poison-immunity';
const SKELETON_VULNERABILITY_CONTROL_ID = 'skeleton-bludgeoning-vulnerability';

export const RESISTANCE_PROOF_CASE_CONTROL_ID = 'resistance-proof-case';
export const RESISTANCE_RESOLVE_CONTROL_ID = 'resolve-resistance-event';
export const RESISTANCE_REPLAY_CONTROL_ID = 'replay-resistance-event';

export type ResistanceProofCase =
  | 'normal_10'
  | 'resistance_odd'
  | 'vulnerability_10'
  | 'immunity_10'
  | 'simultaneous_odd'
  | 'duplicate_resistance_odd'
  | 'mixed_components'
  | 'temporary_hp'
  | 'downing';

// ============================================================================
// Fixed Damage Calibration Abilities
// ============================================================================
// Ordinary scenario attacks roll dice, which makes before-and-after comparisons
// ambiguous. These actions still travel through AbilityCommandFactory and
// DamageCommand, but their flat value is always ten. The visible result therefore
// proves the active target fact directly: 5 resisted, 20 vulnerable, 0 immune,
// or 10 when the matching defense is switched off.
// ============================================================================

const CALIBRATION_ABILITY_IDS = new Set([
  'resistance-calibration-piercing',
  'resistance-calibration-cold',
  'resistance-calibration-fire',
  'resistance-calibration-bludgeoning',
]);

function createCalibrationAbilities(): Ability[] {
  // Each action costs a normal action because the sandbox is proving the real
  // combat path, including action spending. Reset Board or End Turn remains the
  // normal way to prepare the next controlled comparison.
  return [
    {
      id: 'resistance-calibration-piercing',
      name: 'Calibrated Piercing (10)',
      description: 'Deal exactly 10 piercing damage to prove resistance or ordinary damage.',
      type: 'spell',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 24,
      effects: [{ type: 'damage', value: 10, damageType: 'piercing' }],
      icon: '10',
      isProficient: true,
      isMagical: true,
    },
    {
      id: 'resistance-calibration-cold',
      name: 'Calibrated Cold (10)',
      description: 'Deal exactly 10 cold damage to prove vulnerability or ordinary damage.',
      type: 'spell',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 24,
      // The combat ability schema uses `ice` as its internal value while the
      // button and combat explanation keep the player-facing D&D term “Cold.”
      effects: [{ type: 'damage', value: 10, damageType: 'ice' }],
      icon: '10',
      isProficient: true,
      isMagical: true,
    },
    {
      id: 'resistance-calibration-fire',
      name: 'Calibrated Fire (10)',
      description: 'Deal exactly 10 fire damage to prove immunity or ordinary damage.',
      type: 'spell',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 24,
      effects: [{ type: 'damage', value: 10, damageType: 'fire' }],
      icon: '10',
      isProficient: true,
      isMagical: true,
    },
    {
      id: 'resistance-calibration-bludgeoning',
      name: 'Calibrated Bludgeoning (10)',
      description: 'Deal exactly 10 bludgeoning damage to prove vulnerability or ordinary damage.',
      type: 'spell',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 24,
      effects: [{ type: 'damage', value: 10, damageType: 'bludgeoning' }],
      icon: '10',
      isProficient: true,
      isMagical: true,
    },
  ];
}

function ensureCalibrationAbilities(character: CombatCharacter): CombatCharacter {
  if (character.id !== RESISTANCE_PLAYER_ELEMENTALIST_ID) {
    return character;
  }

  // Replace only abilities owned by this module. Existing spells, class actions,
  // and any future preview additions keep their original objects and order.
  const preservedAbilities = character.abilities.filter(
    ability => !CALIBRATION_ABILITY_IDS.has(ability.id),
  );

  return {
    ...character,
    abilities: [...preservedAbilities, ...createCalibrationAbilities()],
  };
}

// ============================================================================
// Controlled Damage-Type Lists
// ============================================================================
// Damage type matching in the production calculator is case-insensitive. This
// helper removes every spelling owned by a control before restoring the combat
// schema's lowercase names. The schema calls cold damage `ice`; player-facing
// labels still use “Cold.” Unrelated defenses stay exactly as they arrived.
// ============================================================================

type DamageTraitKey = 'resistances' | 'vulnerabilities' | 'immunities';

interface ResistanceControlSpec {
  id: string;
  targetId: string;
  targetName: string;
  traitKey: DamageTraitKey;
  controlledAliases: readonly string[];
  enabledTypes: readonly string[];
  enabledMessage: string;
  disabledMessage: string;
}

const CONTROL_SPECS: ResistanceControlSpec[] = [
  {
    id: PHYSICAL_RESISTANCE_CONTROL_ID,
    targetId: RESISTANCE_FIRE_ELEMENTAL_ID,
    targetName: 'Fire Elemental',
    traitKey: 'resistances',
    controlledAliases: ['bludgeoning', 'piercing', 'slashing'],
    enabledTypes: ['bludgeoning', 'piercing', 'slashing'],
    enabledMessage: 'Fire Elemental resists bludgeoning, piercing, and slashing damage; Calibrated Piercing (10) should deal 5.',
    disabledMessage: 'Fire Elemental has no bludgeoning, piercing, or slashing resistance; Calibrated Piercing (10) should deal 10.',
  },
  {
    id: COLD_VULNERABILITY_CONTROL_ID,
    targetId: RESISTANCE_FIRE_ELEMENTAL_ID,
    targetName: 'Fire Elemental',
    traitKey: 'vulnerabilities',
    controlledAliases: ['ice'],
    enabledTypes: ['ice'],
    enabledMessage: 'Fire Elemental is vulnerable to cold damage; Calibrated Cold (10) should deal 20.',
    disabledMessage: 'Fire Elemental has no cold vulnerability; Calibrated Cold (10) should deal 10.',
  },
  {
    id: ELEMENTAL_IMMUNITY_CONTROL_ID,
    targetId: RESISTANCE_FIRE_ELEMENTAL_ID,
    targetName: 'Fire Elemental',
    traitKey: 'immunities',
    controlledAliases: ['fire', 'poison'],
    enabledTypes: ['fire', 'poison'],
    enabledMessage: 'Fire Elemental is immune to fire and poison damage; Calibrated Fire (10) should deal 0.',
    disabledMessage: 'Fire Elemental has no fire or poison immunity; Calibrated Fire (10) should deal 10.',
  },
  {
    id: SKELETON_VULNERABILITY_CONTROL_ID,
    targetId: RESISTANCE_SKELETON_ARCHER_ID,
    targetName: 'Skeleton Archer',
    traitKey: 'vulnerabilities',
    controlledAliases: ['bludgeoning'],
    enabledTypes: ['bludgeoning'],
    enabledMessage: 'Skeleton Archer is vulnerable to bludgeoning damage; Calibrated Bludgeoning (10) should deal 20.',
    disabledMessage: 'Skeleton Archer has no bludgeoning vulnerability; Calibrated Bludgeoning (10) should deal 10.',
  },
];

function setControlledDamageTypes(
  currentTypes: string[] | undefined,
  spec: ResistanceControlSpec,
  enabled: boolean,
): string[] | undefined {
  const ownedTypeNames = new Set(
    spec.controlledAliases.map(damageType => damageType.toLowerCase()),
  );

  // Strip only this switch's types. This makes repeated On and Off events
  // idempotent and preserves defenses supplied by another spell or fixture.
  const preservedTypes = (currentTypes ?? []).filter(
    damageType => !ownedTypeNames.has(damageType.toLowerCase()),
  );
  const nextTypes = enabled
    ? [...preservedTypes, ...spec.enabledTypes]
    : preservedTypes;

  return nextTypes.length > 0 ? nextTypes : undefined;
}

function updateControlledTrait(
  character: CombatCharacter,
  spec: ResistanceControlSpec,
  enabled: boolean,
): CombatCharacter {
  if (character.id !== spec.targetId) {
    return character;
  }

  const nextTypes = setControlledDamageTypes(character[spec.traitKey], spec, enabled);

  // Only one of these three branches changes for a given control. Keeping the
  // complete character shape avoids flattening future defensive fields that the
  // ResistanceCalculator may learn to consume later.
  return {
    ...character,
    resistances: spec.traitKey === 'resistances' ? nextTypes : character.resistances,
    vulnerabilities: spec.traitKey === 'vulnerabilities' ? nextTypes : character.vulnerabilities,
    immunities: spec.traitKey === 'immunities' ? nextTypes : character.immunities,
  };
}

// ============================================================================
// Deterministic Transaction Cases
// ============================================================================
// The four switches remain available for free comparison. These complete cases
// prepare one mounted ability transaction with fixed values and stable identity,
// so HP, temporary HP, downing, one Action payment, and replay safety are visible
// without duplicating any production damage calculation inside the adapter.
// ============================================================================

const PROOF_ABILITY_PREFIX = 'cs06-proof-';

function isResistanceProofCase(value: unknown): value is ResistanceProofCase {
  return typeof value === 'string' && [
    'normal_10',
    'resistance_odd',
    'vulnerability_10',
    'immunity_10',
    'simultaneous_odd',
    'duplicate_resistance_odd',
    'mixed_components',
    'temporary_hp',
    'downing',
  ].includes(value);
}

function createProofAbility(proofCase: ResistanceProofCase): Ability {
  const shared = {
    id: `${PROOF_ABILITY_PREFIX}${proofCase}`,
    type: 'spell' as const,
    cost: { type: 'action' as const },
    targeting: 'single_enemy' as const,
    range: 24,
    icon: 'CS06',
    isProficient: true,
    isMagical: true,
  };

  switch (proofCase) {
    case 'normal_10':
      return {
        ...shared,
        name: 'Normal Thunder (10)',
        description: 'Deal exactly 10 thunder damage with no matching defense.',
        effects: [{ type: 'damage', value: 10, damageType: 'thunder' }],
      };
    case 'resistance_odd':
      return {
        ...shared,
        name: 'Odd Piercing (9)',
        description: 'Deal exactly 9 piercing damage; resistance rounds down to 4.',
        effects: [{ type: 'damage', value: 9, damageType: 'piercing' }],
      };
    case 'vulnerability_10':
      return {
        ...shared,
        name: 'Vulnerable Cold (10)',
        description: 'Deal exactly 10 cold damage; vulnerability doubles it to 20.',
        effects: [{ type: 'damage', value: 10, damageType: 'ice' }],
      };
    case 'immunity_10':
      return {
        ...shared,
        name: 'Immune Fire (10)',
        description: 'Deal exactly 10 fire damage; immunity reduces it to 0.',
        effects: [{ type: 'damage', value: 10, damageType: 'fire' }],
      };
    case 'simultaneous_odd':
      return {
        ...shared,
        name: 'Ordered Piercing (9)',
        description: 'Deal 9 piercing through matching resistance then vulnerability: 9 to 4 to 8.',
        effects: [{ type: 'damage', value: 9, damageType: 'piercing' }],
      };
    case 'duplicate_resistance_odd':
      return {
        ...shared,
        name: 'Duplicate Resistance Piercing (9)',
        description: 'Deal 9 piercing against repeated matching traits; resistance applies only once.',
        effects: [{ type: 'damage', value: 9, damageType: 'piercing' }],
      };
    case 'mixed_components':
      return {
        ...shared,
        name: 'Mixed Piercing 9 + Cold 5',
        description: 'Resolve each typed component independently: piercing 9 to 4, then cold 5 to 10.',
        effects: [
          { type: 'damage', value: 9, damageType: 'piercing' },
          { type: 'damage', value: 5, damageType: 'ice' },
        ],
      };
    case 'temporary_hp':
      return {
        ...shared,
        name: 'Buffered Piercing (9)',
        description: 'Resolve 9 piercing to 4, then remove 3 temporary HP and 1 current HP.',
        effects: [{ type: 'damage', value: 9, damageType: 'piercing' }],
      };
    case 'downing':
      return {
        ...shared,
        name: 'Downing Bludgeoning (35)',
        description: 'Deal 35 bludgeoning to the 30 HP player target and enter the canonical downed state.',
        effects: [{ type: 'damage', value: 35, damageType: 'bludgeoning' }],
      };
  }
}

function getProofParticipants(proofCase: ResistanceProofCase): {
  casterId: string;
  targetId: string;
} {
  return proofCase === 'downing'
    ? {
        casterId: RESISTANCE_FIRE_ELEMENTAL_ID,
        targetId: RESISTANCE_PLAYER_ELEMENTALIST_ID,
      }
    : {
        casterId: RESISTANCE_PLAYER_ELEMENTALIST_ID,
        targetId: RESISTANCE_FIRE_ELEMENTAL_ID,
      };
}

function removeProofAbilities(character: CombatCharacter): CombatCharacter {
  return {
    ...character,
    abilities: character.abilities.filter(ability => !ability.id.startsWith(PROOF_ABILITY_PREFIX)),
  };
}

function prepareResistanceProofCharacters(
  characters: CombatCharacter[],
  proofCase: ResistanceProofCase,
  controlValues: PreviewCombatScenarioControlApplication['snapshot']['controlValues'],
): CombatCharacter[] | null {
  const requiredIds = [
    RESISTANCE_PLAYER_ELEMENTALIST_ID,
    RESISTANCE_FIRE_ELEMENTAL_ID,
    RESISTANCE_SKELETON_ARCHER_ID,
  ];
  if (!requiredIds.every(id => characters.some(character => character.id === id))) {
    return null;
  }

  const participants = getProofParticipants(proofCase);
  const proofAbility = createProofAbility(proofCase);
  let prepared = characters.map(original => {
    const awake = removeUnconsciousCondition(removeProofAbilities(original));
    const ready = resetEconomy({
      ...awake,
      initiative: original.id === participants.casterId ? 30 : 10,
      deathSaves: undefined,
      damagedThisTurn: false,
      tempHP: 0,
      temporaryHitPointSource: undefined,
    });

    if (ready.id === RESISTANCE_PLAYER_ELEMENTALIST_ID) {
      return ensureCalibrationAbilities({
        ...ready,
        currentHP: proofCase === 'downing' ? 30 : 40,
        maxHP: proofCase === 'downing' ? 30 : 40,
        resistances: (ready.resistances ?? []).filter(type => type.toLowerCase() !== 'bludgeoning'),
        immunities: (ready.immunities ?? []).filter(type => type.toLowerCase() !== 'bludgeoning'),
        vulnerabilities: (ready.vulnerabilities ?? []).filter(type => type.toLowerCase() !== 'bludgeoning'),
        abilities: participants.casterId === ready.id
          ? [...ready.abilities, proofAbility]
          : ready.abilities,
      });
    }

    if (ready.id === RESISTANCE_FIRE_ELEMENTAL_ID) {
      return {
        ...ready,
        currentHP: 60,
        maxHP: 60,
        vulnerabilities: (ready.vulnerabilities ?? []).filter(type => type.toLowerCase() !== 'piercing'),
        abilities: participants.casterId === ready.id
          ? [...ready.abilities, proofAbility]
          : ready.abilities,
      };
    }

    if (ready.id === RESISTANCE_SKELETON_ARCHER_ID) {
      return { ...ready, currentHP: 30, maxHP: 30 };
    }

    return ready;
  });

  // Selector preparation replays the four visible switches from their current
  // values. This prevents choosing a case from silently disagreeing with the
  // toggles and also makes Reset deterministic through the same public path.
  for (const spec of CONTROL_SPECS) {
    const enabledValue = controlValues?.[spec.id];
    const enabled = typeof enabledValue === 'boolean' ? enabledValue : true;
    prepared = prepared.map(character => updateControlledTrait(character, spec, enabled));
  }

  prepared = prepared.map(character => {
    if (character.id !== RESISTANCE_FIRE_ELEMENTAL_ID) return character;

    if (proofCase === 'simultaneous_odd') {
      return {
        ...character,
        vulnerabilities: [...(character.vulnerabilities ?? []), 'piercing'],
      };
    }
    if (proofCase === 'duplicate_resistance_odd') {
      return {
        ...character,
        resistances: [...(character.resistances ?? []), 'Piercing', 'piercing'],
      };
    }
    if (proofCase === 'temporary_hp') {
      return {
        ...character,
        tempHP: 3,
        temporaryHitPointSource: { spellId: 'cs06-buffer', spellName: 'CS06 Buffer', casterId: character.id },
      };
    }
    if (proofCase === 'normal_10') {
      return {
        ...character,
        resistances: (character.resistances ?? []).filter(type => type.toLowerCase() !== 'thunder'),
        vulnerabilities: (character.vulnerabilities ?? []).filter(type => type.toLowerCase() !== 'thunder'),
        immunities: (character.immunities ?? []).filter(type => type.toLowerCase() !== 'thunder'),
      };
    }
    return character;
  });

  return prepared;
}

function selectedProofCase(
  application: PreviewCombatScenarioControlApplication,
): ResistanceProofCase | null {
  const value = application.snapshot.controlValues?.[RESISTANCE_PROOF_CASE_CONTROL_ID];
  return isResistanceProofCase(value) ? value : null;
}

function prepareProofCase(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (!isResistanceProofCase(application.value)) {
    return { logMessage: `RESISTANCE CASE REJECTED: unknown case ${String(application.value)}.` };
  }

  const characters = prepareResistanceProofCharacters(
    application.snapshot.characters,
    application.value,
    application.snapshot.controlValues,
  );
  if (!characters) {
    return { logMessage: 'RESISTANCE CASE REJECTED: scenario actors are missing.' };
  }

  return {
    characters,
    reinitializeCombat: true,
    logMessage: `RESISTANCE CASE PREPARED: ${application.value}; HP, temporary HP, traits, and one ready Action reset before delivery.`,
  };
}

function requestProofEvent(
  application: PreviewCombatScenarioControlApplication,
  replay: boolean,
): PreviewCombatScenarioControlPatch {
  if (application.value !== true) return { logMessage: '' };

  const proofCase = selectedProofCase(application);
  if (!proofCase) {
    return { logMessage: 'RESISTANCE EVENT REJECTED: no prepared proof case.' };
  }

  const participants = getProofParticipants(proofCase);
  const hasParticipants = [participants.casterId, participants.targetId].every(id =>
    application.snapshot.characters.some(character => character.id === id)
  );
  if (!hasParticipants) {
    return { logMessage: 'RESISTANCE EVENT REJECTED: caster or target is missing.' };
  }

  const executionEventId = `cs06-${proofCase}-event-001`;
  return {
    abilityExecution: {
      ability: createProofAbility(proofCase),
      casterId: participants.casterId,
      targetId: participants.targetId,
      executionEventId,
      executionDecision: 'accept',
    },
    logMessage: replay
      ? `RESISTANCE REPLAY REQUESTED: ${executionEventId}; the event ledger must preserve Action, HP, temporary HP, and logs.`
      : `RESISTANCE EVENT REQUESTED: ${executionEventId}; production combat owns Action payment, typed damage, HP, and downing.`,
  };
}

// ============================================================================
// Pure Control Application
// ============================================================================
// The shared host sends one id and value at a time. A valid switch updates its
// authored target and refreshes the scenario-owned calibration abilities. Bad
// values, stale ids, or missing targets produce explanatory no-op messages.
// ============================================================================

function applyResistanceControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const { controlId, value, snapshot } = application;

  if (controlId === RESISTANCE_PROOF_CASE_CONTROL_ID) {
    return prepareProofCase(application);
  }
  if (controlId === RESISTANCE_RESOLVE_CONTROL_ID) {
    return requestProofEvent(application, false);
  }
  if (controlId === RESISTANCE_REPLAY_CONTROL_ID) {
    return requestProofEvent(application, true);
  }

  if (typeof value !== 'boolean') {
    return {
      logMessage: `Resistance sandbox control "${controlId}" requires an on/off value.`,
    };
  }

  const spec = CONTROL_SPECS.find(control => control.id === controlId);

  if (!spec) {
    return {
      logMessage: `Unknown Resistance & Vulnerability control: ${controlId}.`,
    };
  }

  const targetExists = snapshot.characters.some(character => character.id === spec.targetId);

  // A still-loading or mismatched board must not redirect a defense switch to
  // another target. The host can display this message and keep its live roster.
  if (!targetExists) {
    return {
      logMessage: `${spec.targetName} is unavailable, so ${controlId} was not applied.`,
    };
  }

  return {
    characters: snapshot.characters.map(character =>
      updateControlledTrait(ensureCalibrationAbilities(character), spec, value)
    ),
    logMessage: `Sandbox fact: ${value ? spec.enabledMessage : spec.disabledMessage}`,
  };
}

// ============================================================================
// Resistance & Vulnerability Control Module
// ============================================================================
// All defaults are On because they reproduce the scenario's authored opening
// defenses. The host applies these defaults through applyControl on first load
// and Reset Board, so the same path also installs the calibration abilities.
// ============================================================================

const resistanceScenarioControlModule: PreviewCombatScenarioControlModule = {
  scenarioId: 'resistance',
  controls: [
    {
      id: PHYSICAL_RESISTANCE_CONTROL_ID,
      label: 'Bludgeoning, Piercing & Slashing Resistance',
      description: 'Switch the Fire Elemental between half and ordinary physical damage.',
      kind: 'toggle',
      defaultValue: true,
    },
    {
      id: COLD_VULNERABILITY_CONTROL_ID,
      label: 'Cold Vulnerability',
      description: 'Switch whether cold damage is doubled against the Fire Elemental.',
      kind: 'toggle',
      defaultValue: true,
    },
    {
      id: ELEMENTAL_IMMUNITY_CONTROL_ID,
      label: 'Fire & Poison Immunity',
      description: 'Switch whether fire and poison damage are reduced to zero.',
      kind: 'toggle',
      defaultValue: true,
    },
    {
      id: SKELETON_VULNERABILITY_CONTROL_ID,
      label: 'Skeleton Bludgeoning Vulnerability',
      description: 'Switch whether bludgeoning damage is doubled against the Skeleton Archer.',
      kind: 'toggle',
      defaultValue: true,
    },
    {
      id: RESISTANCE_PROOF_CASE_CONTROL_ID,
      label: 'Damage transaction proof',
      description: 'Prepare one fixed normal, defended, odd, mixed, buffered, downing, or duplicate transaction.',
      kind: 'select',
      defaultValue: 'resistance_odd',
      options: [
        { value: 'normal_10', label: 'Normal: 10 thunder to 10' },
        { value: 'resistance_odd', label: 'Resistance: 9 piercing to 4' },
        { value: 'vulnerability_10', label: 'Vulnerability: 10 cold to 20' },
        { value: 'immunity_10', label: 'Immunity: 10 fire to 0' },
        { value: 'simultaneous_odd', label: 'Both: 9 to 4 to 8' },
        { value: 'duplicate_resistance_odd', label: 'Duplicate resistance: still 4' },
        { value: 'mixed_components', label: 'Mixed: piercing 9 + cold 5' },
        { value: 'temporary_hp', label: 'Temp HP: 4 into buffer 3' },
        { value: 'downing', label: 'Downing: 35 into player 30' },
      ],
    },
    {
      id: RESISTANCE_RESOLVE_CONTROL_ID,
      label: 'Resolve selected damage',
      description: 'Pay one live Action and resolve every typed component through production damage once.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: RESISTANCE_REPLAY_CONTROL_ID,
      label: 'Replay same event id',
      description: 'Redeliver the stable id; Action, HP, temporary HP, downing, and damage logs must not change.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyResistanceControl,
};

export default resistanceScenarioControlModule;
