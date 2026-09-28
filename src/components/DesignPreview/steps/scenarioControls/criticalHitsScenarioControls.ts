// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 04:15:27
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns deterministic inputs and baseline facts for CS21.
 *
 * Controls do not resolve attacks or mutate HP. They request one mounted
 * production ability transaction, which owns turn validation, payment, attack
 * truth, critical riders, defenses, downing, and combat logs. Reset Board calls
 * the exported preparer to restore only this scenario's authored resources.
 */

import type { Ability, ActiveRider, CombatCharacter } from '../../../../types/combat';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Auditable Board Facts
// ============================================================================
// The three AC values prove both natural-roll overrides and an ordinary AC
// threshold. The fortress HP, Fire resistance, and named hit rider make the
// critical damage and downing path visible in 2D, 3D, and text output.
// ============================================================================

export const CRITICAL_HITS_ATTACKER_ID = 'critical_hits-tester';
export const CRITICAL_HITS_FORTRESS_TARGET_ID = 'critical_hits-fortress-target';
export const CRITICAL_HITS_STANDARD_TARGET_ID = 'critical_hits-standard-target';
export const CRITICAL_HITS_OPEN_TARGET_ID = 'critical_hits-open-target';

export const CRITICAL_HITS_ATTACKER_START = { x: 4, y: 5 } as const;
export const CRITICAL_HITS_FORTRESS_START = { x: 10, y: 3 } as const;
export const CRITICAL_HITS_STANDARD_START = { x: 10, y: 5 } as const;
export const CRITICAL_HITS_OPEN_START = { x: 10, y: 7 } as const;

export const CRITICAL_HITS_FORTRESS_AC = 30;
export const CRITICAL_HITS_STANDARD_AC = 18;
export const CRITICAL_HITS_OPEN_AC = 5;
export const CRITICAL_HITS_TARGET_HP = 40;
export const CRITICAL_HITS_FORTRESS_HP = 17;
export const CRITICAL_HITS_DAMAGE_FORMULA = '1d8+3';
export const CRITICAL_HITS_RIDER_ID = 'critical-hits-flame-rider';

interface ScenarioAttackRequest {
  controlLabel: string;
  d20Roll: number;
  targetId: string;
}

function createCriticalHitsRider(): ActiveRider {
  return {
    id: CRITICAL_HITS_RIDER_ID,
    spellId: 'critical-hits-flame-mark',
    casterId: CRITICAL_HITS_ATTACKER_ID,
    sourceName: 'Flame Mark',
    targetId: CRITICAL_HITS_FORTRESS_TARGET_ID,
    effect: {
      type: 'DAMAGE',
      trigger: { type: 'on_attack_hit' },
      condition: { type: 'hit' },
      damage: { dice: '1d6', type: 'Fire' },
    },
    consumption: 'first_hit',
    attackFilter: { weaponType: 'ranged', attackType: 'weapon' },
    usedThisTurn: false,
    duration: { type: 'minutes', value: 1 },
  };
}

// ============================================================================
// Scenario-Only Reset Baseline
// ============================================================================
// Reset Board calls this once during scenario initialization. Controls never
// call it, so a second attack encounters the exhausted live action before any
// deterministic random source, damage command, or rider can run.
// ============================================================================

export function prepareCriticalHitsCharacters(characters: CombatCharacter[]): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === CRITICAL_HITS_ATTACKER_ID) {
      return {
        ...character,
        name: 'Longbow Archer · +5 · 1d8+3 · Action 1/1 · Flame Mark',
        team: 'enemy',
        level: 5,
        position: { ...CRITICAL_HITS_ATTACKER_START },
        stats: {
          ...character.stats,
          dexterity: 14,
          // The dungeon board is dark by default. Authored darkvision keeps
          // CS21 focused on raw d20/AC truth instead of adding an unrelated
          // unseen-target disadvantage roll.
          senses: { ...character.stats.senses, darkvision: 120 },
        },
        // Generated quick characters can carry background-specific advantage or
        // disadvantage. CS21 isolates the raw d20 rules, so its reset removes
        // those unrelated roll shapers without touching normal combat actors.
        modifiers: {
          ...character.modifiers,
          advantage: [],
          disadvantage: [],
        },
        activeEffects: [],
        statusEffects: [],
        conditions: [],
        riders: [createCriticalHitsRider()],
        actionEconomy: {
          ...character.actionEconomy,
          action: { used: false, remaining: 1 },
        },
      };
    }

    const targetFacts = character.id === CRITICAL_HITS_FORTRESS_TARGET_ID
      ? {
          name: 'Fortress Guard · AC 30 · HP 17 · Fire Resistance',
          position: CRITICAL_HITS_FORTRESS_START,
          hp: CRITICAL_HITS_FORTRESS_HP,
          armorClass: CRITICAL_HITS_FORTRESS_AC,
          resistances: ['Fire'],
        }
      : character.id === CRITICAL_HITS_STANDARD_TARGET_ID
        ? {
            name: 'Standard Guard · AC 18 · HP 40',
            position: CRITICAL_HITS_STANDARD_START,
            hp: CRITICAL_HITS_TARGET_HP,
            armorClass: CRITICAL_HITS_STANDARD_AC,
            resistances: [],
          }
        : character.id === CRITICAL_HITS_OPEN_TARGET_ID
          ? {
              name: 'Open Target · AC 5 · HP 40',
              position: CRITICAL_HITS_OPEN_START,
              hp: CRITICAL_HITS_TARGET_HP,
              armorClass: CRITICAL_HITS_OPEN_AC,
              resistances: [],
            }
          : null;

    if (!targetFacts) return character;

    return {
      ...character,
      name: targetFacts.name,
      // Player-side targets use the canonical downed/death-save transition at
      // 0 HP; enemies instead leave combat as defeated without Unconscious.
      team: 'player',
      position: { ...targetFacts.position },
      currentHP: targetFacts.hp,
      maxHP: targetFacts.hp,
      tempHP: 0,
      armorClass: targetFacts.armorClass,
      baseAC: targetFacts.armorClass,
      resistances: targetFacts.resistances,
      immunities: [],
      vulnerabilities: [],
      damagedThisTurn: false,
      deathSaves: { successes: 0, failures: 0, stable: false },
      statusEffects: (character.statusEffects ?? []).filter(effect => effect.name !== 'Unconscious'),
      conditions: (character.conditions ?? []).filter(condition => condition.name !== 'Unconscious'),
    };
  });
}

export function getCriticalHitsInitiativeTotal(character: CombatCharacter): number {
  if (character.id === CRITICAL_HITS_ATTACKER_ID) return 18;
  if (character.id === CRITICAL_HITS_FORTRESS_TARGET_ID) return 14;
  if (character.id === CRITICAL_HITS_STANDARD_TARGET_ID) return 12;
  if (character.id === CRITICAL_HITS_OPEN_TARGET_ID) return 10;
  return 0;
}

export const CRITICAL_HITS_LONGBOW: Ability = {
  id: 'critical-hits-longbow',
  name: 'Longbow',
  description: 'A sandbox shot resolved by the production ability transaction.',
  type: 'attack',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 30,
  isProficient: true,
  attackBonus: 5,
  attackType: 'weapon',
  effects: [{ type: 'damage', dice: CRITICAL_HITS_DAMAGE_FORMULA, damageType: 'piercing' }],
};

// Halfway through each interval rolls 5 on d8 and 4 on d6. A critical longbow
// is 2d8 + 3 = 13, while its critical rider is 2d6 = 8 before resistance.
const FIXED_DAMAGE_RNG = (): number => 0.5;

function fixedD20Rng(roll: number): () => number {
  return () => (roll - 0.5) / 20;
}

// ============================================================================
// Production Transaction Requests
// ============================================================================
// The adapter selects the actor, target, ability, and deterministic inputs.
// The host sends that request through useAbilitySystem; no result is authored
// here, and production combat logs remain the only outcome explanation.
// ============================================================================

function applyCriticalHitsControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.value === false) return { logMessage: '' };
  if (application.value !== true) {
    return { logMessage: `Critical Hits control ${application.controlId} requires an action trigger.` };
  }

  const attacker = application.snapshot.characters.find(
    character => character.id === CRITICAL_HITS_ATTACKER_ID,
  );
  if (!attacker) {
    return { logMessage: 'Critical-hit control skipped because its authored attacker is unavailable.' };
  }

  const requests: Record<string, ScenarioAttackRequest> = {
    'natural-20': { controlLabel: 'Natural 20', d20Roll: 20, targetId: CRITICAL_HITS_FORTRESS_TARGET_ID },
    'natural-1': { controlLabel: 'Natural 1', d20Roll: 1, targetId: CRITICAL_HITS_OPEN_TARGET_ID },
    'ordinary-hit': { controlLabel: 'Ordinary hit', d20Roll: 13, targetId: CRITICAL_HITS_STANDARD_TARGET_ID },
    'ordinary-miss': { controlLabel: 'Ordinary miss', d20Roll: 12, targetId: CRITICAL_HITS_STANDARD_TARGET_ID },
  };
  const request = requests[application.controlId];
  if (!request) return { logMessage: `Unknown Critical Hits control: ${application.controlId}.` };

  const targetExists = application.snapshot.characters.some(character => character.id === request.targetId);
  if (!targetExists) {
    return { logMessage: `${request.controlLabel} skipped because target ${request.targetId} is unavailable.` };
  }

  return {
    abilityExecution: {
      ability: CRITICAL_HITS_LONGBOW,
      casterId: attacker.id,
      targetId: request.targetId,
      attackRollRng: fixedD20Rng(request.d20Roll),
      damageRng: FIXED_DAMAGE_RNG,
    },
    logMessage: '',
  };
}

const criticalHitsScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'critical_hits',
  controls: [
    {
      id: 'natural-20',
      label: 'Natural 20 vs AC 30',
      description: 'Spend the live Attack action: 2d8 + 3 plus a critical 2d6 Fire rider meets resistance and downs the 17 HP guard.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'natural-1',
      label: 'Natural 1 vs AC 5',
      description: 'Spend the live Attack action but reject damage and the hit-only rider despite total 6 exceeding AC 5.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'ordinary-hit',
      label: 'Ordinary 18 vs AC 18',
      description: 'Spend the live Attack action and resolve d20 13 + 5 as a normal 1d8 + 3 hit on the AC tie.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'ordinary-miss',
      label: 'Ordinary 17 vs AC 18',
      description: 'Spend the live Attack action and resolve d20 12 + 5 as a normal miss one point below AC.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyCriticalHitsControl,
};

export default criticalHitsScenarioControls;
