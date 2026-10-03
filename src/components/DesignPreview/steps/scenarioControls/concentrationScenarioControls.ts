// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 13:33:53
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the deterministic Spell Concentration rules laboratory.
 *
 * A tester chooses one complete event, then sends it through the same mounted
 * ability, command, action-economy, spell-slot, damage, saving-throw, condition,
 * and concentration paths used by normal combat. The adapter only prepares
 * stable actors and dice-safe inputs; production helpers own every result.
 *
 * Called by: the Tactical Sandbox control registry and scenario host.
 * Depends on: canonical Bless/Protection spell data, ability construction,
 * action-economy reset, and the shared scenario-control contract.
 */

import blessData from '@/data/spells/level-1/bless.json';
import protectionFromEvilAndGoodData from '@/data/spells/level-1/protection-from-evil-and-good.json';
import type { PlayerCharacter, SpellSlots } from '../../../../types';
import type {
  Ability,
  CombatCharacter,
  ConcentrationState,
  StatusEffect,
} from '../../../../types/combat';
import type { Spell } from '../../../../types/spells';
import { createAbilityFromSpell } from '../../../../utils/character/spellAbilityFactory';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Canonical Spells, Actors, and Stable Proof Identity
// ============================================================================
// Spell JSON owns casting time, level, slot cost, duration, effects, and the
// concentration flag. Stable actor and event ids make Reset and replay readable.
// ============================================================================

const BLESS = blessData as unknown as Spell;
const PROTECTION_FROM_EVIL_AND_GOOD = protectionFromEvilAndGoodData as unknown as Spell;

export const CONCENTRATION_CASTER_ID = 'apprentice-mage';
export const CONCENTRATION_DAMAGE_SOURCE_ID = 'orc-archer';
export const CONCENTRATION_OTHER_ACTOR_ID = 'orc-raider';
export const CONCENTRATION_OWNED_BLESS_STATUS_ID = 'cs04-owned-bless-status';
export const CONCENTRATION_UNRELATED_STATUS_ID = 'cs04-unrelated-bless-status';

export const CONCENTRATION_CASE_CONTROL_ID = 'concentration-proof-case';
export const CONCENTRATION_RESOLVE_CONTROL_ID = 'resolve-concentration-event';
export const CONCENTRATION_REPLAY_CONTROL_ID = 'replay-concentration-event';

const SCENARIO_MARKER_PREFIX = 'cs04-case-';
const STANDARD_DAMAGE = 20;
const HEAVY_DAMAGE = 22;
const GUARANTEED_KEEP_SAVE_BONUS = 10;
const GUARANTEED_BREAK_SAVE_BONUS = -11;

export type ConcentrationProofCase =
  | 'cast_bless'
  | 'replace_owned_effect'
  | 'damage_keep_dc10'
  | 'damage_break_dc11'
  | 'source_incapacitated'
  | 'invalid_spent_action'
  | 'declined_replacement';

const CAST_CASES: ReadonlySet<ConcentrationProofCase> = new Set([
  'cast_bless',
  'replace_owned_effect',
  'invalid_spent_action',
  'declined_replacement',
]);

// ============================================================================
// Player-Facing Controls and Reset Defaults
// ============================================================================
// Selecting a case prepares one isolated transaction. Resolve sends the first
// delivery; Replay deliberately sends the same stable id a second time.
// ============================================================================

const controls: PreviewCombatScenarioControlModule['controls'] = [
  {
    id: CONCENTRATION_CASE_CONTROL_ID,
    label: 'Concentration proof case',
    description: 'Prepare a cast, owned-effect replacement, boundary save, source loss, invalid cast, or declined cast.',
    kind: 'select',
    defaultValue: 'replace_owned_effect',
    options: [
      { value: 'cast_bless', label: 'Cast Bless (fresh)' },
      { value: 'replace_owned_effect', label: 'Replace Bless with Protection' },
      { value: 'damage_keep_dc10', label: '20 damage / DC 10 / keep' },
      { value: 'damage_break_dc11', label: '22 damage / DC 11 / break' },
      { value: 'source_incapacitated', label: 'Source becomes Incapacitated' },
      { value: 'invalid_spent_action', label: 'Invalid cast / Action spent' },
      { value: 'declined_replacement', label: 'Decline replacement cast' },
    ],
  },
  {
    id: CONCENTRATION_RESOLVE_CONTROL_ID,
    label: 'Resolve selected event',
    description: 'Run the prepared event through mounted production combat exactly once.',
    kind: 'action',
    defaultValue: false,
  },
  {
    id: CONCENTRATION_REPLAY_CONTROL_ID,
    label: 'Replay same event id',
    description: 'Redeliver the identical stable id; resources, effects, HP, and concentration must not change.',
    kind: 'action',
    defaultValue: false,
  },
];

// ============================================================================
// Owned and Unrelated Ongoing Effects
// ============================================================================
// The opening replacement fixture has one Bless record owned by the Apprentice
// Mage and one same-spell record owned elsewhere. Cleanup must remove only the
// exact owned record, proving spell-name matching never becomes a broad purge.
// ============================================================================

function createBlessConcentration(): ConcentrationState {
  return {
    spellId: BLESS.id,
    spellName: BLESS.name,
    spellLevel: BLESS.level,
    startedTurn: 1,
    effectIds: [CONCENTRATION_OWNED_BLESS_STATUS_ID],
    canDropAsFreeAction: true,
  };
}

function createBlessStatus(
  id: string,
  sourceCasterId: string,
): StatusEffect {
  return {
    id,
    name: 'Blessed',
    type: 'buff',
    duration: 10,
    source: BLESS.name,
    sourceSpellId: BLESS.id,
    sourceCasterId,
    effect: { type: 'condition' },
  };
}

function createConcentrationSpellSlots(existing: SpellSlots | undefined): SpellSlots {
  // CombatCharacter's slot ledger is total across levels 1-9. CS04 authors
  // only level 1, but preserves any higher-level fixture values so selecting
  // this scenario never erases unrelated resources from a shared actor shape.
  return {
    level_1: { current: 2, max: 2 },
    level_2: existing?.level_2 ?? { current: 0, max: 0 },
    level_3: existing?.level_3 ?? { current: 0, max: 0 },
    level_4: existing?.level_4 ?? { current: 0, max: 0 },
    level_5: existing?.level_5 ?? { current: 0, max: 0 },
    level_6: existing?.level_6 ?? { current: 0, max: 0 },
    level_7: existing?.level_7 ?? { current: 0, max: 0 },
    level_8: existing?.level_8 ?? { current: 0, max: 0 },
    level_9: existing?.level_9 ?? { current: 0, max: 0 },
  };
}

function withoutScenarioRecords(character: CombatCharacter): CombatCharacter {
  return {
    ...character,
    statusEffects: character.statusEffects.filter(status => (
      !status.id.startsWith(SCENARIO_MARKER_PREFIX)
      && status.id !== CONCENTRATION_OWNED_BLESS_STATUS_ID
      && status.id !== CONCENTRATION_UNRELATED_STATUS_ID
    )),
    conditions: (character.conditions ?? []).filter(condition => (
      condition.sourceCasterId !== CONCENTRATION_CASTER_ID
      || (condition.source !== BLESS.id && condition.source !== BLESS.name)
    )),
    activeEffects: (character.activeEffects ?? []).filter(effect => (
      effect.casterId !== CONCENTRATION_CASTER_ID
      || (effect.spellId !== BLESS.id && effect.spellId !== PROTECTION_FROM_EVIL_AND_GOOD.id)
    )),
  };
}

// ============================================================================
// Deterministic Case Preparation
// ============================================================================
// Each selector starts from the same HP, slots, positions, and ready economy.
// The chosen event owner receives the highest authored initiative so the normal
// turn gate, rather than a preview bypass, decides whether the action may run.
// ============================================================================

function isProofCase(value: unknown): value is ConcentrationProofCase {
  return typeof value === 'string' && [
    'cast_bless',
    'replace_owned_effect',
    'damage_keep_dc10',
    'damage_break_dc11',
    'source_incapacitated',
    'invalid_spent_action',
    'declined_replacement',
  ].includes(value);
}

function createScenarioMarker(value: ConcentrationProofCase): StatusEffect {
  return {
    id: `${SCENARIO_MARKER_PREFIX}${value}`,
    name: `Proof Case: ${value}`,
    type: 'neutral',
    duration: Number.MAX_SAFE_INTEGER,
    source: 'Spell Concentration Sandbox',
    effect: { type: 'condition' },
  };
}

function createDamageAbility(damage: number): Ability {
  return {
    id: `cs04-fixed-${damage}-damage`,
    name: `${damage} damage concentration hit`,
    description: `A fixed ${damage}-damage hit delivered through the normal attack and damage commands.`,
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: 16,
    effects: [{ type: 'damage', value: damage, damageType: 'piercing' }],
  };
}

const INCAPACITATING_ABILITY: Ability = {
  id: 'cs04-incapacitating-effect',
  name: 'Apply Incapacitated',
  description: 'Applies the real Incapacitated condition through StatusConditionCommand.',
  type: 'utility',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 16,
  effects: [{
    type: 'status',
    statusEffect: {
      id: 'cs04-incapacitated',
      name: 'Incapacitated',
      type: 'debuff',
      duration: 1,
      effect: { type: 'condition' },
    },
  }],
};

export function prepareConcentrationScenarioCharacters(
  characters: CombatCharacter[],
  proofCase: ConcentrationProofCase,
): CombatCharacter[] {
  const casterExists = characters.some(character => character.id === CONCENTRATION_CASTER_ID);
  const sourceExists = characters.some(character => character.id === CONCENTRATION_DAMAGE_SOURCE_ID);
  const otherExists = characters.some(character => character.id === CONCENTRATION_OTHER_ACTOR_ID);
  if (!casterExists || !sourceExists || !otherExists) return characters;

  const castCase = CAST_CASES.has(proofCase);
  const startsWithBless = proofCase !== 'cast_bless';

  return characters.map(original => {
    const character = withoutScenarioRecords(original);

    if (character.id === CONCENTRATION_CASTER_ID) {
      const readyCaster = resetEconomy({
        ...character,
        team: 'player',
        position: { x: 3, y: 5 },
        initiative: castCase ? 30 : 10,
        currentHP: 60,
        maxHP: 60,
        concentratingOn: startsWithBless ? createBlessConcentration() : undefined,
        spellSlots: createConcentrationSpellSlots(character.spellSlots),
        stats: {
          ...character.stats,
          constitution: 16,
          saveBonuses: {
            ...character.stats.saveBonuses,
            con: proofCase === 'damage_break_dc11'
              ? GUARANTEED_BREAK_SAVE_BONUS
              : GUARANTEED_KEEP_SAVE_BONUS,
          },
        },
      });
      const invalidCaster = proofCase === 'invalid_spent_action'
        ? {
            ...readyCaster,
            actionEconomy: {
              ...readyCaster.actionEconomy,
              action: { used: true, remaining: 0 },
            },
          }
        : readyCaster;

      return {
        ...invalidCaster,
        statusEffects: [
          ...invalidCaster.statusEffects,
          ...(startsWithBless
            ? [createBlessStatus(CONCENTRATION_OWNED_BLESS_STATUS_ID, CONCENTRATION_CASTER_ID)]
            : []),
          createScenarioMarker(proofCase),
        ],
        conditions: startsWithBless
          ? [
              ...(invalidCaster.conditions ?? []),
              {
                name: 'Blessed',
                duration: { type: 'minutes', value: 1 },
                appliedTurn: 1,
                source: BLESS.id,
                sourceCasterId: CONCENTRATION_CASTER_ID,
              },
            ]
          : invalidCaster.conditions,
      };
    }

    if (character.id === CONCENTRATION_DAMAGE_SOURCE_ID) {
      const source = resetEconomy({
        ...character,
        team: 'enemy',
        position: { x: 9, y: 5 },
        initiative: castCase ? 10 : 30,
      });
      return {
        ...source,
        abilities: proofCase === 'source_incapacitated'
          ? [INCAPACITATING_ABILITY]
          : [createDamageAbility(proofCase === 'damage_break_dc11' ? HEAVY_DAMAGE : STANDARD_DAMAGE)],
      };
    }

    if (character.id === CONCENTRATION_OTHER_ACTOR_ID) {
      return {
        ...resetEconomy({
          ...character,
          team: 'enemy',
          position: { x: 7, y: 7 },
          initiative: 5,
        }),
        statusEffects: [
          ...character.statusEffects,
          createBlessStatus(CONCENTRATION_UNRELATED_STATUS_ID, 'unrelated-caster'),
        ],
      };
    }

    return character;
  });
}

export function getConcentrationInitiativeTotal(character: CombatCharacter): number {
  return character.initiative ?? 0;
}

// ============================================================================
// Mounted Production Event Requests
// ============================================================================
// Cast cases use canonical spell abilities. Damage and source-loss cases use
// ordinary ability commands. Every request carries a stable id so Replay hits
// the hook-owned once-only ledger instead of reapplying scenario state.
// ============================================================================

function createEventExecution(
  characters: CombatCharacter[],
  proofCase: ConcentrationProofCase,
): NonNullable<PreviewCombatScenarioControlPatch['abilityExecution']> | null {
  const caster = characters.find(character => character.id === CONCENTRATION_CASTER_ID);
  const source = characters.find(character => character.id === CONCENTRATION_DAMAGE_SOURCE_ID);
  if (!caster || !source) return null;

  const executionEventId = `cs04-${proofCase}-event-001`;
  if (CAST_CASES.has(proofCase)) {
    const spell = proofCase === 'cast_bless' ? BLESS : PROTECTION_FROM_EVIL_AND_GOOD;
    return {
      ability: createAbilityFromSpell(spell, caster as unknown as PlayerCharacter),
      casterId: caster.id,
      targetId: caster.id,
      // Both canonical spells carry a player-input prompt. Supplying the chosen
      // willing target keeps this authored button on the normal spell-command
      // path without opening an unrelated free-form modal during proof.
      playerInput: caster.name,
      executionEventId,
      executionDecision: proofCase === 'declined_replacement' ? 'decline' : 'accept',
    };
  }

  return {
    ability: proofCase === 'source_incapacitated'
      ? INCAPACITATING_ABILITY
      : createDamageAbility(proofCase === 'damage_break_dc11' ? HEAVY_DAMAGE : STANDARD_DAMAGE),
    casterId: source.id,
    targetId: caster.id,
    attackRollRng: () => 0.95,
    damageRng: () => 0.5,
    executionEventId,
    executionDecision: 'accept',
  };
}

function selectedCase(application: PreviewCombatScenarioControlApplication): ConcentrationProofCase | null {
  const value = application.snapshot.controlValues?.[CONCENTRATION_CASE_CONTROL_ID];
  return isProofCase(value) ? value : null;
}

function prepareCase(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (!isProofCase(application.value)) {
    return { logMessage: `CONCENTRATION CASE REJECTED: unknown case ${String(application.value)}.` };
  }

  const characters = prepareConcentrationScenarioCharacters(
    application.snapshot.characters,
    application.value,
  );
  if (characters === application.snapshot.characters) {
    return { logMessage: 'CONCENTRATION CASE REJECTED: scenario actors are missing.' };
  }

  return {
    characters,
    reinitializeCombat: true,
    logMessage: `CONCENTRATION CASE PREPARED: ${application.value}; no action, slot, damage, save, or cleanup has resolved yet.`,
  };
}

function requestEvent(
  application: PreviewCombatScenarioControlApplication,
  replay: boolean,
): PreviewCombatScenarioControlPatch {
  if (application.value !== true) {
    return { logMessage: '' };
  }

  const proofCase = selectedCase(application);
  const abilityExecution = proofCase
    ? createEventExecution(application.snapshot.characters, proofCase)
    : null;
  if (!proofCase || !abilityExecution) {
    return { logMessage: 'CONCENTRATION EVENT REJECTED: prepared case or actors are missing.' };
  }

  return {
    abilityExecution,
    logMessage: replay
      ? `CONCENTRATION REPLAY REQUESTED: ${abilityExecution.executionEventId}.`
      : `CONCENTRATION EVENT REQUESTED: ${abilityExecution.executionEventId}.`,
  };
}

// ============================================================================
// Shared Contract Dispatch
// ============================================================================
// Invalid ids and values remain visible log-only no-ops. The module never owns
// a private result state; it only prepares or requests mounted transactions.
// ============================================================================

function applyControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.controlId === CONCENTRATION_CASE_CONTROL_ID) {
    return prepareCase(application);
  }
  if (application.controlId === CONCENTRATION_RESOLVE_CONTROL_ID) {
    return requestEvent(application, false);
  }
  if (application.controlId === CONCENTRATION_REPLAY_CONTROL_ID) {
    return requestEvent(application, true);
  }
  return {
    logMessage: `CONCENTRATION CONTROL REJECTED: unknown control ${application.controlId}.`,
  };
}

const concentrationScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'concentration',
  controls,
  applyControl,
};

export default concentrationScenarioControls;
