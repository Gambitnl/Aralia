// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 00:26:41
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
 * This file owns the deterministic Repeat Saves & Condition Expiry actions.
 *
 * The board starts with a wizard concentrating on canonical Hold Person and a
 * Humanoid target carrying its Paralyzed status/condition records. Each action
 * rebuilds that same baseline, rolls the shared Wisdom save with a fixed random
 * stream when a save is due, and delegates successful-save or duration cleanup
 * to the same primitives used by ordinary combat.
 *
 * Called by: the Tactical Sandbox scenario-control registry and scenario host.
 * Depends on: Hold Person spell data, shared saving throws, action validation,
 * and repeat-save cleanup/duration helpers.
 */

import holdPersonData from '@/data/spells/level-2/hold-person.json';
import mageArmorData from '@/data/spells/level-1/mage-armor.json';
import type { CombatCharacter, StatusEffect } from '../../../../types/combat';
import type { Spell, SpellEffect } from '../../../../types/spells';
import {
  calculateSpellDC,
  rollSavingThrow,
  type SavingThrowResult,
} from '../../../../utils/character/savingThrowUtils';
import {
  canAffordActionCost,
  resetEconomy,
} from '../../../../utils/combat/actionEconomyUtils';
import {
  advanceStatusConditionDurationsAtTurnStart,
  removeRepeatSaveLinkedEffects,
} from '../../../../utils/combat/repeatSaveUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Canonical Spell Facts And Stable Board Identity
// ============================================================================
// Spell JSON remains authoritative for the condition name, repeat-save timing,
// ability, source id, and duration. The fixture only chooses that ten-round
// spell's final remaining round so expiry can be demonstrated in one click.
// ============================================================================

const HOLD_PERSON = holdPersonData as unknown as Spell;
const MAGE_ARMOR = mageArmorData as unknown as Spell;

type SpellEffectWithStatus = SpellEffect & {
  statusCondition?: {
    name?: string;
    repeatSave?: StatusEffect['repeatSave'];
  };
};

const HOLD_PERSON_EFFECT = HOLD_PERSON.effects.find(effect => (
  'statusCondition' in effect
)) as SpellEffectWithStatus | undefined;
const HOLD_PERSON_CONDITION_NAME = HOLD_PERSON_EFFECT?.statusCondition?.name ?? 'Paralyzed';
const HOLD_PERSON_REPEAT_SAVE = HOLD_PERSON_EFFECT?.statusCondition?.repeatSave;

export const REPEAT_SAVES_CASTER_ID = 'repeat_saves_condition_expiry-caster';
export const REPEAT_SAVES_TARGET_ID = 'repeat_saves_condition_expiry-target';
export const REPEAT_SAVES_CASTER_START = { x: 4, y: 5 } as const;
export const REPEAT_SAVES_TARGET_START = { x: 9, y: 5 } as const;
export const REPEAT_SAVES_DC = 15;
export const REPEAT_SAVES_FAILURE_D20 = 5;
export const REPEAT_SAVES_SUCCESS_D20 = 15;

const HOLD_PERSON_STATUS_ID = 'repeat-saves-hold-person-status';
const BLESS_STATUS_ID = 'repeat-saves-unrelated-bless-status';

interface RepeatSavesActors {
  caster: CombatCharacter;
  target: CombatCharacter;
}

// ============================================================================
// Deterministic Canonical Save Input
// ============================================================================
// The shared save roller still owns modifiers, proficiency, and success math.
// This random source selects a known d20 face so the same proof can be replayed.
// ============================================================================

function createD20RandomSource(face: number): () => number {
  return () => (face - 0.5) / 20;
}

function formatSave(save: SavingThrowResult): string {
  const roll = save.roll ?? 0;
  const modifier = save.total - roll;
  const modifierText = modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`;
  return `d20 ${roll} ${modifierText} = ${save.total} vs DC ${save.dc}`;
}

// ============================================================================
// Repeatable Actor Setup
// ============================================================================
// Every action starts here. This makes failure, success, expiry, and Reset Board
// directly comparable and prevents one button's result leaking into the next.
// ============================================================================

function requireActors(
  characters: CombatCharacter[],
): RepeatSavesActors | null {
  const caster = characters.find(character => character.id === REPEAT_SAVES_CASTER_ID);
  const target = characters.find(character => character.id === REPEAT_SAVES_TARGET_ID);
  return caster && target ? { caster, target } : null;
}

function createHoldPersonStatus(): StatusEffect {
  return {
    id: HOLD_PERSON_STATUS_ID,
    name: HOLD_PERSON_CONDITION_NAME,
    type: 'debuff',
    description: HOLD_PERSON.description,
    duration: 1,
    source: HOLD_PERSON.name,
    sourceSpellId: HOLD_PERSON.id,
    sourceCasterId: REPEAT_SAVES_CASTER_ID,
    repeatSave: HOLD_PERSON_REPEAT_SAVE
      ? { ...HOLD_PERSON_REPEAT_SAVE, dc: REPEAT_SAVES_DC }
      : undefined,
    effect: { type: 'condition' },
  };
}

function prepareActors(actors: RepeatSavesActors): RepeatSavesActors {
  const caster = resetEconomy({
    ...actors.caster,
    id: REPEAT_SAVES_CASTER_ID,
    name: 'Enchanter · Hold Person DC 15 · Concentrating',
    position: { ...REPEAT_SAVES_CASTER_START },
    team: 'player',
    level: 5,
    stats: {
      ...actors.caster.stats,
      intelligence: 18,
      // The caster must always open this teaching board. Otherwise a random
      // target initiative can tick the final round away during launch/reset.
      baseInitiative: 20,
    },
    abilities: [],
    statusEffects: [],
    conditions: [],
    activeEffects: [],
    concentratingOn: {
      spellId: HOLD_PERSON.id,
      spellName: HOLD_PERSON.name,
      spellLevel: HOLD_PERSON.level,
      startedTurn: 4,
      effectIds: [HOLD_PERSON_STATUS_ID],
      canDropAsFreeAction: true,
    },
  });

  const target = resetEconomy({
    ...actors.target,
    id: REPEAT_SAVES_TARGET_ID,
    name: 'Held Guard · Paralyzed · 1 round · Move 0 · Mage Armor kept',
    position: { ...REPEAT_SAVES_TARGET_START },
    team: 'enemy',
    class: {
      ...actors.target.class,
      savingThrowProficiencies: [],
    },
    stats: {
      ...actors.target.stats,
      wisdom: 10,
      speed: 30,
      saveBonuses: undefined,
      baseInitiative: -20,
    },
    savingThrowProficiencies: [],
    abilities: [],
    statusEffects: [
      createHoldPersonStatus(),
      {
        id: BLESS_STATUS_ID,
        name: 'Blessed',
        type: 'buff',
        description: 'An unrelated effect that must survive Hold Person cleanup.',
        duration: 10,
        source: 'Bless',
        sourceSpellId: 'bless',
        sourceCasterId: 'off-board-cleric',
        modifiers: {
          attackRollBonusDice: '1d4',
          savingThrowBonusDice: '1d4',
        },
      },
    ],
    conditions: [{
      name: HOLD_PERSON_CONDITION_NAME,
      duration: { type: 'rounds', value: 1 },
      appliedTurn: 4,
      source: HOLD_PERSON.id,
      sourceCasterId: REPEAT_SAVES_CASTER_ID,
      repeatSave: HOLD_PERSON_REPEAT_SAVE
        ? { ...HOLD_PERSON_REPEAT_SAVE, dc: REPEAT_SAVES_DC }
        : undefined,
    }],
    activeEffects: [{
      id: 'repeat-saves-unrelated-mage-armor',
      spellId: MAGE_ARMOR.id,
      casterId: REPEAT_SAVES_TARGET_ID,
      sourceName: MAGE_ARMOR.name,
      type: 'buff',
      duration: { type: 'hours', value: MAGE_ARMOR.duration.value ?? 8 },
      startTime: 0,
      mechanics: {
        baseAC: 13,
        baseACFormula: '13 + dex_mod',
      },
    }],
  });

  return { caster, target };
}

function replaceActors(
  characters: CombatCharacter[],
  actors: RepeatSavesActors,
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === actors.caster.id) return actors.caster;
    if (character.id === actors.target.id) return actors.target;
    return character;
  });
}

export function prepareRepeatSavesConditionExpiryCharacters(
  characters: CombatCharacter[],
): CombatCharacter[] {
  const found = requireActors(characters);
  if (!found) return characters;
  return replaceActors(characters, prepareActors(found));
}

// ============================================================================
// Turn-End Save And Turn-Start Expiry Resolution
// ============================================================================
// The timing check reads Hold Person metadata before any roll. Success uses the
// engine cleanup primitive; failure keeps the condition and its real penalties.
// ============================================================================

function withEndedConcentration(caster: CombatCharacter): CombatCharacter {
  return {
    ...caster,
    name: 'Enchanter · Hold Person ended · DC 15',
    concentratingOn: undefined,
  };
}

function resolveTurnEndSave(
  application: PreviewCombatScenarioControlApplication,
  d20Face: number,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application.snapshot.characters);
  if (!found) {
    return { logMessage: 'Repeat Saves control skipped because its caster or target is unavailable.' };
  }

  const actors = prepareActors(found);
  const repeatSave = actors.target.statusEffects.find(
    status => status.id === HOLD_PERSON_STATUS_ID,
  )?.repeatSave;
  if (!repeatSave || repeatSave.timing !== 'turn_end' || repeatSave.saveType !== 'Wisdom') {
    return { logMessage: 'Repeat Saves control stopped because canonical Hold Person turn-end Wisdom metadata is unavailable.' };
  }

  const dc = calculateSpellDC(actors.caster);
  const save = rollSavingThrow(
    actors.target,
    'Wisdom',
    dc,
    undefined,
    { tags: ['magic', 'control', 'paralysis'] },
    undefined,
    { rng: createD20RandomSource(d20Face) },
  );
  const saveMath = formatSave(save);

  if (!save.success) {
    const retainedTarget = {
      ...actors.target,
      name: `Held Guard · FAIL ${save.total}/${dc} · Paralyzed · Move 0 · Action blocked`,
    };
    const actionBlocked = !canAffordActionCost(retainedTarget, { type: 'action' });

    return {
      characters: replaceActors(application.snapshot.characters, {
        ...actors,
        target: retainedTarget,
      }),
      logMessage: `Turn end · failed repeat save: ${saveMath} fails. Hold Person remains source-linked to ${actors.caster.name}; Paralyzed remains, movement ${retainedTarget.actionEconomy.movement.total}/30, Action ${actionBlocked ? 'blocked' : 'available'}. Blessed and Mage Armor remain unrelated.`,
    };
  }

  const cleanup = removeRepeatSaveLinkedEffects(actors.target, [HOLD_PERSON_STATUS_ID]);
  const freedTarget = {
    ...cleanup.character,
    name: `Freed Guard · SAVE ${save.total}/${dc} · Move ${cleanup.character.actionEconomy.movement.total} · Mage Armor kept`,
  };

  return {
    characters: replaceActors(application.snapshot.characters, {
      caster: withEndedConcentration(actors.caster),
      target: freedTarget,
    }),
    logMessage: `Turn end · successful repeat save: ${saveMath} succeeds. Hold Person removes ${cleanup.removedStatusEffects} status and ${cleanup.removedConditions} condition; movement returns to ${freedTarget.actionEconomy.movement.total}/30 and Action is available. Blessed and Mage Armor remain.`,
  };
}

function resolveDurationExpiry(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const found = requireActors(application.snapshot.characters);
  if (!found) {
    return { logMessage: 'Repeat Saves duration control skipped because its caster or target is unavailable.' };
  }

  const actors = prepareActors(found);
  const expiry = advanceStatusConditionDurationsAtTurnStart(actors.target);
  const freedTarget = {
    ...expiry.character,
    name: `Freed Guard · DURATION EXPIRED · Move ${expiry.character.actionEconomy.movement.total} · Mage Armor kept`,
  };

  return {
    characters: replaceActors(application.snapshot.characters, {
      caster: withEndedConcentration(actors.caster),
      target: freedTarget,
    }),
    logMessage: `Next turn start · duration expiry: Hold Person's final remaining round reaches 0 without another save. ${expiry.expiredNames.join(', ')} leaves both runtime mirrors; movement returns to ${freedTarget.actionEconomy.movement.total}/30. Blessed and Mage Armor remain.`,
  };
}

// ============================================================================
// Control Routing And Registration
// ============================================================================
// Three inert action controls isolate failure, success, and natural duration
// expiry. The host's Reset Board reloads the prepared baseline and all defaults.
// ============================================================================

function applyRepeatSavesControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.value === false) {
    return { logMessage: '' };
  }
  if (application.value !== true) {
    return { logMessage: `Repeat Saves control ${application.controlId} requires an action trigger.` };
  }

  if (application.controlId === 'fail-repeat-save') {
    return resolveTurnEndSave(application, REPEAT_SAVES_FAILURE_D20);
  }
  if (application.controlId === 'succeed-repeat-save') {
    return resolveTurnEndSave(application, REPEAT_SAVES_SUCCESS_D20);
  }
  if (application.controlId === 'expire-duration') {
    return resolveDurationExpiry(application);
  }

  return { logMessage: `Unknown Repeat Saves control: ${application.controlId}.` };
}

const repeatSavesConditionExpiryScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'repeat_saves_condition_expiry',
  controls: [
    {
      id: 'fail-repeat-save',
      label: 'End Turn: Fail Repeat Save',
      description: 'Roll 5 + 0 vs DC 15; Hold Person, speed 0, and blocked actions remain.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'succeed-repeat-save',
      label: 'End Turn: Succeed Repeat Save',
      description: 'Roll 15 + 0 vs DC 15; source-linked Hold Person records end at turn end.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'expire-duration',
      label: 'Next Turn: Expire Duration',
      description: 'Advance the final remaining round; cleanup happens without a successful save.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyRepeatSavesControl,
};

export default repeatSavesConditionExpiryScenarioControls;
