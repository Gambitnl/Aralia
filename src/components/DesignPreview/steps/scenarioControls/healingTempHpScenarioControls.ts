/**
 * This file owns the deterministic Healing & Temporary HP scenario actions.
 *
 * Every action reads the live mounted actors and turn ledger. Targeted actions
 * cross the production validation/payment transaction before shared HP helpers
 * apply the result, while incoming damage uses the production HP transition
 * directly. Reset remains the only path that rebuilds the authored fixture.
 *
 * Called by: the Tactical Sandbox scenario-control registry.
 * Depends on: the canonical combat HP transition helpers.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/10/2026, 00:42:28
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatCharacter } from '../../../../types/combat';
import type { Spell } from '../../../../types';
import healingWordData from '@/data/spells/level-1/healing-word.json';
import cureWoundsData from '@/data/spells/level-1/cure-wounds.json';
import {
  createHitPointSpellAction,
  resolveHitPointAction,
  type HitPointActionDefinition,
  type HitPointActionResolution,
} from '../../../../systems/spells/mechanics/healingTemporaryHitPointResolution';
import { applyDamageAndCheckDowned } from '../../../../utils/combat/deathSaveUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Auditable Board Facts
// ============================================================================
// The ally starts at exactly half health. Fixed healing, temporary-HP, and
// damage values keep every before-and-after total readable without random rolls.
// ============================================================================

export const HEALING_TEMP_HP_HEALER_ID = 'healing_temp_hp-healer';
export const HEALING_TEMP_HP_ALLY_ID = 'healing_temp_hp-wounded-ally';

export const HEALING_TEMP_HP_HEALER_START = { x: 7, y: 5 } as const;
export const HEALING_TEMP_HP_ALLY_START = { x: 8, y: 5 } as const;

export const HEALING_TEMP_HP_ALLY_START_HP = 12;
export const HEALING_TEMP_HP_ALLY_MAX_HP = 24;
export const HEALING_TEMP_HP_SMALL_HEAL = 8;
export const HEALING_TEMP_HP_LARGE_HEAL = 20;
export const HEALING_TEMP_HP_FIRST_POOL = 8;
export const HEALING_TEMP_HP_SMALLER_OFFER = 5;
export const HEALING_TEMP_HP_LARGER_OFFER = 12;
export const HEALING_TEMP_HP_INCOMING_DAMAGE = 15;

interface HealingTempHpActors {
  healer: CombatCharacter;
  ally: CombatCharacter;
}

const HEALING_WORD = healingWordData as Spell;
const CURE_WOUNDS = cureWoundsData as Spell;

// The temporary-HP comparison is an authored training action, not a claim that
// a named spell grants these three values. It still uses the canonical target
// resolver and consumes one live Action plus one finite level-1 resource.
const TEMPORARY_HP_TRAINING_ACTION: HitPointActionDefinition = {
  name: 'Protective Ward training action',
  targeting: {
    type: 'single',
    range: 60,
    rangeUnit: 'feet',
    validTargets: ['creatures'],
    lineOfSight: true,
  },
  cost: {
    type: 'action',
    spellSlotLevel: 1,
  },
};

// ============================================================================
// Live Actor Lookup And Initiative
// ============================================================================
// Controls never reposition or rebuild actors. Deterministic initiative makes
// the healer the reset turn owner while production End Turn remains authoritative.
// ============================================================================

function requireActors(
  application: PreviewCombatScenarioControlApplication,
): HealingTempHpActors | null {
  const healer = application.snapshot.characters.find(
    character => character.id === HEALING_TEMP_HP_HEALER_ID,
  );
  const ally = application.snapshot.characters.find(
    character => character.id === HEALING_TEMP_HP_ALLY_ID,
  );

  return healer && ally ? { healer, ally } : null;
}

export function getHealingTempHpInitiativeTotal(character: CombatCharacter): number {
  if (character.id === HEALING_TEMP_HP_HEALER_ID) return 20;
  if (character.id === HEALING_TEMP_HP_ALLY_ID) return 10;
  return character.initiative;
}

function replaceActors(
  characters: CombatCharacter[],
  actors: HealingTempHpActors,
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === actors.healer.id) return actors.healer;
    if (character.id === actors.ally.id) return actors.ally;
    return character;
  });
}

function withAlly(
  application: PreviewCombatScenarioControlApplication,
  actors: HealingTempHpActors,
  ally: CombatCharacter,
  logMessage: string,
): PreviewCombatScenarioControlPatch {
  return {
    characters: replaceActors(application.snapshot.characters, { ...actors, ally }),
    logMessage,
  };
}

function levelOneSlots(character: CombatCharacter | undefined): number {
  return character?.spellSlots?.level_1?.current ?? 0;
}

function describeRejection(
  resolution: HitPointActionResolution,
  actionName: string,
): string {
  const caster = resolution.casterBefore;
  const target = resolution.targetBefore;
  const targetFacts = target
    ? `${target.currentHP}/${target.maxHP} HP + ${target.tempHP ?? 0} temp`
    : 'target unavailable';
  const resources = caster
    ? `Action ${caster.actionEconomy.action.used ? 0 : 1}, Bonus ${caster.actionEconomy.bonusAction.used ? 0 : 1}, level-1 slots ${levelOneSlots(caster)}`
    : 'caster unavailable';

  return `${actionName} REJECTED (${resolution.reason}): ${resolution.targetRejectionMessage ?? 'validation or resources failed'}. ${targetFacts}; ${resources} unchanged.`;
}

function runTargetedAction(
  application: PreviewCombatScenarioControlApplication,
  actors: HealingTempHpActors,
  action: HitPointActionDefinition,
  mode: 'healing' | 'temporary_hit_points',
  amounts: number[],
): HitPointActionResolution | PreviewCombatScenarioControlPatch {
  if (!application.snapshot.turnState) {
    return {
      logMessage: `${action.name} REJECTED (missing_turn_state): live turn ownership is unavailable, so HP and resources remain unchanged.`,
    };
  }

  return resolveHitPointAction({
    characters: application.snapshot.characters,
    mapData: application.snapshot.mapData,
    turnState: application.snapshot.turnState,
    casterId: actors.healer.id,
    targetId: actors.ally.id,
    action,
    mode,
    amounts,
  });
}

// ============================================================================
// Canonical Health Transitions
// ============================================================================
// These actions narrate the production transaction receipt. The log therefore
// explains both HP state and finite payment without maintaining UI-only totals.
// ============================================================================

function applyHealingTempHpControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.value === false) {
    return { logMessage: '' };
  }
  if (application.value !== true) {
    return { logMessage: `Healing & Temporary HP control ${application.controlId} requires an action trigger.` };
  }

  const foundActors = requireActors(application);
  if (!foundActors) {
    return { logMessage: 'Healing & Temporary HP control skipped because its healer or wounded ally is unavailable.' };
  }

  const actors = foundActors;

  if (application.controlId === 'heal-wounds') {
    const action = createHitPointSpellAction(HEALING_WORD, actors.healer, 1);
    const resolution = runTargetedAction(application, actors, action, 'healing', [HEALING_TEMP_HP_SMALL_HEAL]);
    if (!('status' in resolution)) return resolution;
    if (resolution.status === 'rejected') return { logMessage: describeRejection(resolution, action.name) };
    return {
      characters: resolution.characters,
      logMessage: `Healing Word pays Bonus Action and level-1 slot ${levelOneSlots(resolution.casterBefore)} → ${levelOneSlots(resolution.casterAfter)}; fixed healing ${HEALING_TEMP_HP_SMALL_HEAL} restores ${resolution.appliedAmount}: Wounded Ally ${resolution.targetBefore?.currentHP} → ${resolution.targetAfter?.currentHP}/${resolution.targetAfter?.maxHP} HP. Temporary HP remains ${resolution.targetAfter?.tempHP ?? 0}.`,
    };
  }

  if (application.controlId === 'heal-to-maximum') {
    const action = createHitPointSpellAction(CURE_WOUNDS, actors.healer, 1);
    const resolution = runTargetedAction(application, actors, action, 'healing', [HEALING_TEMP_HP_LARGE_HEAL]);
    if (!('status' in resolution)) return resolution;
    if (resolution.status === 'rejected') return { logMessage: describeRejection(resolution, action.name) };
    return {
      characters: resolution.characters,
      logMessage: `Cure Wounds pays Action and level-1 slot ${levelOneSlots(resolution.casterBefore)} → ${levelOneSlots(resolution.casterAfter)}; fixed healing ${HEALING_TEMP_HP_LARGE_HEAL} restores only ${resolution.appliedAmount}: Wounded Ally ${resolution.targetBefore?.currentHP} → ${resolution.targetAfter?.currentHP}/${resolution.targetAfter?.maxHP} HP. Healing cannot exceed maximum HP.`,
    };
  }

  if (application.controlId === 'temporary-hp-replacement') {
    const resolution = runTargetedAction(
      application,
      actors,
      TEMPORARY_HP_TRAINING_ACTION,
      'temporary_hit_points',
      [HEALING_TEMP_HP_FIRST_POOL, HEALING_TEMP_HP_SMALLER_OFFER, HEALING_TEMP_HP_LARGER_OFFER],
    );
    if (!('status' in resolution)) return resolution;
    if (resolution.status === 'rejected') return { logMessage: describeRejection(resolution, TEMPORARY_HP_TRAINING_ACTION.name) };
    const [firstPool, afterSmaller, afterLarger] = resolution.temporaryHitPointSteps;
    return {
      characters: resolution.characters,
      logMessage: `Protective Ward pays Action and level-1 slot ${levelOneSlots(resolution.casterBefore)} → ${levelOneSlots(resolution.casterAfter)}. Temporary HP stays separate from ${resolution.targetAfter?.currentHP}/${resolution.targetAfter?.maxHP} HP: offer ${HEALING_TEMP_HP_FIRST_POOL} gives ${firstPool}; smaller offer ${HEALING_TEMP_HP_SMALLER_OFFER} keeps ${afterSmaller} instead of stacking; larger offer ${HEALING_TEMP_HP_LARGER_OFFER} replaces it with ${afterLarger}.`,
    };
  }

  if (application.controlId === 'damage-through-buffer') {
    const damagedAlly = applyDamageAndCheckDowned(actors.ally, HEALING_TEMP_HP_INCOMING_DAMAGE);
    const temporaryHpAbsorbed = Math.min(actors.ally.tempHP ?? 0, HEALING_TEMP_HP_INCOMING_DAMAGE);
    const hitPointDamage = actors.ally.currentHP - damagedAlly.currentHP;
    return withAlly(
      application,
      actors,
      damagedAlly,
      `Incoming damage ${HEALING_TEMP_HP_INCOMING_DAMAGE} uses the live pools: temporary HP ${actors.ally.tempHP ?? 0} → ${damagedAlly.tempHP ?? 0} absorbs ${temporaryHpAbsorbed}; ${hitPointDamage} reaches current HP ${actors.ally.currentHP} → ${damagedAlly.currentHP}/${damagedAlly.maxHP}. No action or slot is charged for the authored hazard.`,
    );
  }

  return { logMessage: `Unknown Healing & Temporary HP control: ${application.controlId}.` };
}

// ============================================================================
// Scenario Control Registration
// ============================================================================
// Four inert action buttons cover ordinary healing, the maximum-HP cap,
// non-stacking replacement, and temporary-HP-first damage absorption.
// ============================================================================

const healingTempHpScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'healing_temp_hp',
  controls: [
    {
      id: 'heal-wounds',
      label: 'Heal 8 HP',
      description: 'Cast Healing Word on the live ally, spending a Bonus Action and level-1 slot before restoring 8 HP.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'heal-to-maximum',
      label: 'Heal 20 (cap at 24)',
      description: 'Cast Cure Wounds on the adjacent live ally, spending an Action and slot while the maximum-HP cap stays authoritative.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'temporary-hp-replacement',
      label: 'Temp HP: 8 → 5 → 12',
      description: 'Pay one Action and slot for a training transaction: grant 8, keep it over 5, then replace it with 12.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'damage-through-buffer',
      label: 'Take 15 damage through 12 temp',
      description: 'Apply 15 authored hazard damage to whatever live HP and temporary-HP pools currently exist.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyHealingTempHpControl,
};

export default healingTempHpScenarioControls;
