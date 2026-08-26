// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 09:10:17
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
 * This file owns the deterministic Damage Over Time & Scheduled Effects board.
 *
 * The board derives two future-turn payloads from canonical spell JSON: Searing
 * Smite burns at the start of the marked target's turn, while Melf's Acid Arrow
 * deals its one-time delayed damage at the end of that turn. The live turn
 * manager stores and resolves both schedules; this module supplies only stable
 * actors, schedule records, replay dice, and player-facing cleanup controls.
 *
 * Called by: the Tactical Sandbox host and scenario-control registry.
 * Depends on: canonical spell data, the production scheduled-effect factory,
 * and the shared scenario-control contract.
 */

import melfsAcidArrowData from '@/data/spells/level-2/melfs-acid-arrow.json';
import searingSmiteData from '@/data/spells/level-1/searing-smite.json';
import type { ActiveCondition, CombatCharacter, StatusEffect } from '../../../../types/combat';
import type { Spell, SpellEffect } from '../../../../types/spells';
import type { RecurringMechanic } from '../../../../types/spellEffectTypes';
import {
  createScheduledSpellEffect,
  type ScheduledSpellEffect,
} from '../../../../systems/spells/effects';
import { resetEconomy } from '../../../../utils/combat/actionEconomyUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Canonical Spell Facts And Stable Scenario Identity
// ============================================================================
// Spell JSON remains authoritative for timing, frequency, dice, damage type,
// and duration. Stable IDs make the live schedule readable and removable
// without relying on Date.now-generated factory identities.
// ============================================================================

const SEARING_SMITE = searingSmiteData as unknown as Spell;
const MELFS_ACID_ARROW = melfsAcidArrowData as unknown as Spell;

type ScheduledDamageEffect = SpellEffect & {
  trigger?: { type?: string; frequency?: string };
  damage?: { dice?: string; type?: string };
  recurringMechanics?: RecurringMechanic[];
  statusCondition?: {
    name?: string;
    description?: string;
    repeatSave?: ActiveCondition['repeatSave'];
  };
};

const SEARING_SMITE_STATUS_EFFECT = SEARING_SMITE.effects.find(effect => (
  effect.type === 'STATUS_CONDITION'
)) as ScheduledDamageEffect | undefined;
const SEARING_SMITE_RECURRING = SEARING_SMITE_STATUS_EFFECT
  ?.recurringMechanics?.find(mechanic => mechanic.timing === 'turn_start');
const MELFS_ACID_DELAYED_EFFECT = MELFS_ACID_ARROW.effects.find(effect => {
  const scheduledEffect = effect as ScheduledDamageEffect;
  return scheduledEffect.type === 'DAMAGE'
    && scheduledEffect.trigger?.type === 'turn_end';
}) as ScheduledDamageEffect | undefined;

export const DAMAGE_OVER_TIME_SOURCE_ID = 'damage_over_time_scheduled_effects-source';
export const DAMAGE_OVER_TIME_TARGET_ID = 'damage_over_time_scheduled_effects-target';
export const DAMAGE_OVER_TIME_SOURCE_START = { x: 4, y: 5 } as const;
export const DAMAGE_OVER_TIME_TARGET_START = { x: 10, y: 5 } as const;
export const DAMAGE_OVER_TIME_SOURCE_INITIATIVE = 20;
export const DAMAGE_OVER_TIME_TARGET_INITIATIVE = 10;
export const DAMAGE_OVER_TIME_TARGET_MAX_HP = 60;
export const DAMAGE_OVER_TIME_SEARING_ROLL = 4;
export const DAMAGE_OVER_TIME_ACID_ROLL = 5;
export const DAMAGE_OVER_TIME_SEARING_SAVE_DC = 15;
export const DAMAGE_OVER_TIME_SEARING_FAILED_SAVE_FACE = 5;
export const DAMAGE_OVER_TIME_SEARING_SUCCESS_SAVE_FACE = 18;
export const DAMAGE_OVER_TIME_SEARING_SCHEDULE_ID = 'scheduled-cs35-searing-smite-start';
export const DAMAGE_OVER_TIME_ACID_SCHEDULE_ID = 'scheduled-cs35-melfs-acid-arrow-end';

export const DAMAGE_OVER_TIME_DEFENSE_CONTROL_ID = 'scheduled-damage-defense';
export const DAMAGE_OVER_TIME_SAVE_OUTCOME_CONTROL_ID = 'searing-smite-save-outcome';
export const DAMAGE_OVER_TIME_LIFECYCLE_CONTROL_ID = 'scheduled-effect-lifecycle';
const REMOVE_ACID_SCHEDULE_CONTROL_ID = 'remove-acid-schedule';
export const SEARING_SMITE_DURATION_ROUNDS = 10;
const MELFS_ACID_DURATION_ROUNDS = 1;
const INITIAL_ROUND = 1;

// ============================================================================
// Canonical Schedule Construction
// ============================================================================
// The production factory filters direct triggers and preserves recurring spell
// mechanics. This guard keeps a malformed spell-data migration from silently
// turning the board into a fabricated payload.
// ============================================================================

function requireCanonicalScheduledFacts(): {
  searingEffect: ScheduledDamageEffect;
  searingRecurring: RecurringMechanic;
  acidEffect: ScheduledDamageEffect;
} {
  if (!SEARING_SMITE_STATUS_EFFECT || !SEARING_SMITE_RECURRING || !MELFS_ACID_DELAYED_EFFECT) {
    throw new Error('Damage Over Time scenario cannot find its canonical scheduled spell facts.');
  }

  return {
    searingEffect: SEARING_SMITE_STATUS_EFFECT,
    searingRecurring: SEARING_SMITE_RECURRING,
    acidEffect: MELFS_ACID_DELAYED_EFFECT,
  };
}

export function createDamageOverTimeScheduledEffects(
  currentRound: number = INITIAL_ROUND,
): ScheduledSpellEffect[] {
  const canonical = requireCanonicalScheduledFacts();
  const searingSchedule = createScheduledSpellEffect(
    SEARING_SMITE.id,
    DAMAGE_OVER_TIME_SOURCE_ID,
    DAMAGE_OVER_TIME_TARGET_ID,
    'turn_start',
    [canonical.searingEffect],
    currentRound,
    SEARING_SMITE_DURATION_ROUNDS,
    DAMAGE_OVER_TIME_SEARING_SAVE_DC,
    canonical.searingRecurring,
  );
  const acidSchedule = createScheduledSpellEffect(
    MELFS_ACID_ARROW.id,
    DAMAGE_OVER_TIME_SOURCE_ID,
    DAMAGE_OVER_TIME_TARGET_ID,
    'turn_end',
    [canonical.acidEffect],
    currentRound,
    MELFS_ACID_DURATION_ROUNDS,
  );

  // Authored IDs are intentionally stable so Reset Board can replace the exact
  // two records and the cleanup control can remove only Acid Arrow.
  return [
    { ...searingSchedule, id: DAMAGE_OVER_TIME_SEARING_SCHEDULE_ID },
    { ...acidSchedule, id: DAMAGE_OVER_TIME_ACID_SCHEDULE_ID },
  ];
}

export interface DamageOverTimeScheduleDisplay {
  id: string;
  spellId: string;
  sourceId: string;
  targetId: string;
  nextTrigger: 'start of target turn' | 'end of target turn';
  damage: string;
  damageType: string;
  frequency: string;
  expiresAtRound: number | null;
  saveType: string | null;
  saveDC: number | null;
}

export function describeDamageOverTimeSchedule(
  scheduledEffect: ScheduledSpellEffect,
): DamageOverTimeScheduleDisplay {
  const directDamage = scheduledEffect.effects.find(effect => (
    effect.type === 'DAMAGE'
  )) as ScheduledDamageEffect | undefined;
  const damage = scheduledEffect.recurringMechanic?.damage ?? directDamage?.damage;
  const frequency = scheduledEffect.recurringMechanic?.frequency
    ?? directDamage?.trigger?.frequency
    ?? 'once';

  return {
    id: scheduledEffect.id,
    spellId: scheduledEffect.spellId,
    sourceId: scheduledEffect.casterId,
    targetId: scheduledEffect.targetId,
    nextTrigger: scheduledEffect.timing === 'turn_start'
      ? 'start of target turn'
      : 'end of target turn',
    damage: damage?.dice ?? 'unknown dice',
    damageType: damage?.type ?? 'untyped',
    frequency,
    expiresAtRound: scheduledEffect.expiresAtRound ?? null,
    saveType: scheduledEffect.recurringMechanic?.saveType ?? null,
    saveDC: scheduledEffect.saveDC ?? null,
  };
}

// ============================================================================
// Deterministic Replay Dice
// ============================================================================
// Production combat remains random by default. The host passes this roller only
// for CS35, selecting legal fixed totals for the canonical 1d6 and 2d4 payloads.
// Unknown records fail loudly instead of concealing spell-data drift.
// ============================================================================

export function rollDamageOverTimeScheduledEffect(
  dice: string,
  scheduledEffect: ScheduledSpellEffect,
): number {
  if (
    scheduledEffect.id === DAMAGE_OVER_TIME_SEARING_SCHEDULE_ID
    && dice === SEARING_SMITE_RECURRING?.damage?.dice
  ) {
    return DAMAGE_OVER_TIME_SEARING_ROLL;
  }

  if (
    scheduledEffect.id === DAMAGE_OVER_TIME_ACID_SCHEDULE_ID
    && dice === MELFS_ACID_DELAYED_EFFECT?.damage?.dice
  ) {
    return DAMAGE_OVER_TIME_ACID_ROLL;
  }

  throw new Error(`Damage Over Time replay has no deterministic roll for ${scheduledEffect.id} (${dice}).`);
}

/**
 * Returns a deterministic d20 random value while keeping the shared saving-
 * throw utility responsible for Constitution modifiers, proficiency, and DC.
 */
export function rollDamageOverTimeScheduledSave(outcome: string): number {
  const face = outcome === 'success'
    ? DAMAGE_OVER_TIME_SEARING_SUCCESS_SAVE_FACE
    : DAMAGE_OVER_TIME_SEARING_FAILED_SAVE_FACE;
  return (face - 0.5) / 20;
}

// ============================================================================
// Repeatable Actor Setup
// ============================================================================
// The source always opens combat, and the marked target carries the canonical
// Ignited source record plus visible HP. Schedules themselves remain live
// engine state rather than being duplicated onto the actor.
// ============================================================================

function createIgnitedStatus(): StatusEffect {
  return {
    id: 'damage-over-time-searing-smite-ignited',
    name: SEARING_SMITE_STATUS_EFFECT?.statusCondition?.name ?? 'Ignited',
    description: SEARING_SMITE_STATUS_EFFECT?.statusCondition?.description
      ?? SEARING_SMITE.description,
    type: 'debuff',
    duration: SEARING_SMITE_DURATION_ROUNDS,
    // The schedule owns the one-minute clock and removes this source link at
    // save success or expiry. Prevent the generic turn-start ticker from
    // creating a second, one-turn-short duration clock.
    persistsUntilRemoved: true,
    source: SEARING_SMITE.name,
    sourceSpellId: SEARING_SMITE.id,
    sourceCasterId: DAMAGE_OVER_TIME_SOURCE_ID,
    effect: { type: 'condition' },
  };
}

function createIgnitedCondition(): ActiveCondition {
  return {
    name: SEARING_SMITE_STATUS_EFFECT?.statusCondition?.name ?? 'Ignited',
    duration: { type: 'minutes', value: 1 },
    appliedTurn: INITIAL_ROUND,
    source: SEARING_SMITE.id,
    sourceCasterId: DAMAGE_OVER_TIME_SOURCE_ID,
    repeatSave: SEARING_SMITE_STATUS_EFFECT?.statusCondition?.repeatSave,
  };
}

export function prepareDamageOverTimeScheduledEffectsCharacters(
  characters: CombatCharacter[],
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === DAMAGE_OVER_TIME_SOURCE_ID) {
      return resetEconomy({
        ...character,
        name: 'Ember Arcanist · schedule owner · Init 20',
        position: { ...DAMAGE_OVER_TIME_SOURCE_START },
        team: 'player',
        level: 5,
        initiative: DAMAGE_OVER_TIME_SOURCE_INITIATIVE,
        stats: {
          ...character.stats,
          baseInitiative: 0,
          intelligence: 18,
        },
        abilities: [],
        statusEffects: [],
        conditions: [],
        activeEffects: [],
        concentratingOn: undefined,
      });
    }

    if (character.id === DAMAGE_OVER_TIME_TARGET_ID) {
      return resetEconomy({
        ...character,
        name: 'Marked Guard · scheduled target · 60/60 HP',
        position: { ...DAMAGE_OVER_TIME_TARGET_START },
        team: 'enemy',
        initiative: DAMAGE_OVER_TIME_TARGET_INITIATIVE,
        currentHP: DAMAGE_OVER_TIME_TARGET_MAX_HP,
        maxHP: DAMAGE_OVER_TIME_TARGET_MAX_HP,
        tempHP: 0,
        temporaryHitPointSource: undefined,
        resistances: undefined,
        immunities: undefined,
        deathSaves: undefined,
        stats: {
          ...character.stats,
          baseInitiative: 0,
        },
        class: {
          ...character.class,
          savingThrowProficiencies: [],
        },
        savingThrowProficiencies: [],
        abilities: [],
        statusEffects: [createIgnitedStatus()],
        conditions: [createIgnitedCondition()],
        activeEffects: [],
        concentratingOn: undefined,
      });
    }

    return character;
  });
}

export function getDamageOverTimeScheduledEffectsInitiativeTotal(
  character: CombatCharacter,
): number {
  return character.id === DAMAGE_OVER_TIME_SOURCE_ID
    ? DAMAGE_OVER_TIME_SOURCE_INITIATIVE
    : DAMAGE_OVER_TIME_TARGET_INITIATIVE;
}

// ============================================================================
// Player-Facing Defense, Save, Lifecycle, And Cleanup Controls
// ============================================================================
// These controls change only real character facts or live engine records. The
// subsequent End Turn still owns damage, saves, expiry, downing, ordering, and
// removal; the panel never calculates a result or keeps a display-only queue.
// ============================================================================

function applyScheduledDefense(
  characters: CombatCharacter[],
  defense: string,
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id !== DAMAGE_OVER_TIME_TARGET_ID) {
      return character;
    }

    const isLethalProof = defense === 'lethal';
    const tempHP = defense === 'temporary_hit_points' ? 3 : 0;
    return {
      ...character,
      name: isLethalProof
        ? 'Marked Guard · lethal proof · 3/60 HP'
        : 'Marked Guard · scheduled target · 60/60 HP',
      team: isLethalProof ? 'player' : 'enemy',
      currentHP: isLethalProof ? 3 : DAMAGE_OVER_TIME_TARGET_MAX_HP,
      maxHP: DAMAGE_OVER_TIME_TARGET_MAX_HP,
      tempHP,
      temporaryHitPointSource: tempHP > 0
        ? {
            spellId: 'cs35-proof-ward',
            spellName: 'CS35 Proof Ward',
            casterId: DAMAGE_OVER_TIME_SOURCE_ID,
          }
        : undefined,
      resistances: defense === 'resistance' ? ['Fire'] : undefined,
      immunities: defense === 'immunity' ? ['Fire'] : undefined,
      deathSaves: undefined,
      statusEffects: character.statusEffects.filter(status => (
        status.name.toLowerCase() !== 'unconscious'
      )),
      conditions: (character.conditions ?? []).filter(condition => (
        String(condition.name).toLowerCase() !== 'unconscious'
      )),
    };
  });
}

function prepareLifecyclePatch(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const lifecycle = String(application.value);

  if (lifecycle === 'near_expiry') {
    // A freshly mounted manager briefly reports round zero before initiative
    // hydration. Prime from round one in that window so the control still
    // demonstrates one live round followed by the exclusive round-two cutoff.
    const currentRound = Math.max(
      INITIAL_ROUND,
      application.snapshot.turnState?.currentTurn ?? INITIAL_ROUND,
    );
    const expiryRound = currentRound + 1;
    const replacement = (application.snapshot.scheduledSpellEffects ?? []).map(effect => (
      effect.id === DAMAGE_OVER_TIME_SEARING_SCHEDULE_ID
        ? { ...effect, expiresAtRound: expiryRound }
        : effect
    ));
    return {
      scheduledSpellEffectsToReplace: replacement,
      logMessage: `EXPIRY PRIMED: Searing Smite has one canonical round remaining and expires before round ${expiryRound}'s target-start payload.`,
    };
  }

  if (lifecycle === 'source_removed') {
    return {
      characters: application.snapshot.characters.filter(character => (
        character.id !== DAMAGE_OVER_TIME_SOURCE_ID
      )),
      removeCharacterFromCombatId: DAMAGE_OVER_TIME_SOURCE_ID,
      logMessage: 'SOURCE REMOVED: the non-concentration Searing Smite and already-landed Acid Arrow schedules retain their captured owner id and save DC.',
    };
  }

  if (lifecycle === 'target_removed') {
    return {
      characters: application.snapshot.characters.filter(character => (
        character.id !== DAMAGE_OVER_TIME_TARGET_ID
      )),
      removeCharacterFromCombatId: DAMAGE_OVER_TIME_TARGET_ID,
      logMessage: 'TARGET REMOVED: production combat removes target-orphaned schedules; no later phase can damage a missing creature.',
    };
  }

  return {
    logMessage: 'LIFECYCLE LIVE: source and target remain present; the full ten-round Searing Smite clock stays active.',
  };
}

function applyDamageOverTimeControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.value === false) {
    return { logMessage: '' };
  }

  if (application.controlId === REMOVE_ACID_SCHEDULE_CONTROL_ID) {
    return {
      scheduledSpellEffectIdsToRemove: [DAMAGE_OVER_TIME_ACID_SCHEDULE_ID],
      logMessage: 'SCHEDULE REMOVED: Melf\'s Acid Arrow no longer owns an end-of-turn payload; later target turn ends cannot fire its 2d4 Acid damage.',
    };
  }

  if (application.controlId === DAMAGE_OVER_TIME_DEFENSE_CONTROL_ID) {
    return {
      characters: applyScheduledDefense(
        application.snapshot.characters,
        String(application.value),
      ),
      logMessage: `SCHEDULED DEFENSE SET: ${String(application.value).replaceAll('_', ' ')} will resolve through resistance/immunity, temporary HP, and downing before the Searing Smite save.`,
    };
  }

  if (application.controlId === DAMAGE_OVER_TIME_SAVE_OUTCOME_CONTROL_ID) {
    const outcome = String(application.value) === 'success' ? 'success' : 'failure';
    return {
      logMessage: `SEARING SAVE SET: deterministic d20 ${outcome === 'success' ? DAMAGE_OVER_TIME_SEARING_SUCCESS_SAVE_FACE : DAMAGE_OVER_TIME_SEARING_FAILED_SAVE_FACE} will use the canonical Constitution modifier against DC ${DAMAGE_OVER_TIME_SEARING_SAVE_DC}.`,
    };
  }

  if (application.controlId === DAMAGE_OVER_TIME_LIFECYCLE_CONTROL_ID) {
    return prepareLifecyclePatch(application);
  }

  return {
    logMessage: `Damage Over Time control ignored unknown control "${application.controlId}".`,
  };
}

const damageOverTimeScheduledEffectsScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'damage_over_time_scheduled_effects',
  controls: [
    {
      id: DAMAGE_OVER_TIME_DEFENSE_CONTROL_ID,
      label: 'Scheduled Damage Defense',
      description: 'Choose normal HP, Fire Resistance, Fire Immunity, 3 temporary HP, or a lethal 3 HP player target.',
      kind: 'select',
      defaultValue: 'normal',
      options: [
        { value: 'normal', label: 'Normal HP' },
        { value: 'resistance', label: 'Fire Resistance' },
        { value: 'immunity', label: 'Fire Immunity' },
        { value: 'temporary_hit_points', label: '3 Temporary HP' },
        { value: 'lethal', label: 'Lethal 3 HP' },
      ],
    },
    {
      id: DAMAGE_OVER_TIME_SAVE_OUTCOME_CONTROL_ID,
      label: 'Searing Smite Save Outcome',
      description: 'Choose a deterministic failed or successful Constitution save after the Fire transaction.',
      kind: 'select',
      defaultValue: 'failure',
      options: [
        { value: 'failure', label: 'Fail And Continue' },
        { value: 'success', label: 'Succeed And Clean' },
      ],
    },
    {
      id: DAMAGE_OVER_TIME_LIFECYCLE_CONTROL_ID,
      label: 'Scheduled Effect Lifecycle',
      description: 'Keep both actors, prime one remaining round, remove the non-concentration source, or remove the target.',
      kind: 'select',
      defaultValue: 'live',
      options: [
        { value: 'live', label: 'Full Duration' },
        { value: 'near_expiry', label: 'One Round Remaining' },
        { value: 'source_removed', label: 'Remove Source' },
        { value: 'target_removed', label: 'Remove Target' },
      ],
    },
    {
      id: REMOVE_ACID_SCHEDULE_CONTROL_ID,
      label: 'Remove Acid Schedule',
      description: 'Remove only Melf\'s end-of-turn record; Searing Smite remains scheduled.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyDamageOverTimeControl,
};

export default damageOverTimeScheduledEffectsScenarioControls;
