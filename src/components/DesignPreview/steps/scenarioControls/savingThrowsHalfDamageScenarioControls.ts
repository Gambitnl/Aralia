// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 05:10:23
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the deterministic Saving Throws & Half Damage actions.
 *
 * Each action rebuilds the caster and two targets from the authored board facts,
 * then follows the same order as production spell damage: calculate the caster's
 * save DC, roll the target's saving throw, apply the source save outcome, apply
 * damage resistance, and finally update real combat HP. The Tactical Sandbox host
 * renders those returned characters in both 2D and 3D, so no browser-only health
 * total or parallel saving-throw resolver exists here.
 *
 * Called by: the Tactical Sandbox scenario-control registry.
 * Depends on: canonical save, damage-dice, resistance, and HP helpers.
 */

import type { CombatCharacter } from '../../../../types/combat';
import {
  calculateSaveDamage,
  calculateSpellDC,
  rollSavingThrow,
  type SaveEffectOutcome,
  type SavingThrowResult,
} from '../../../../utils/character/savingThrowUtils';
import { rollDamage } from '../../../../systems/dice/rollers';
import { applyDamageAndCheckDowned } from '../../../../utils/combat/deathSaveUtils';
import { ResistanceCalculator } from '../../../../utils/combat/resistanceUtils';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Auditable Board Facts
// ============================================================================
// Intelligence 18 at level 5 produces DC 15. The two targets deliberately have
// Dexterity -1 and +3, while 4d6 is pinned to 15 damage. These values make the
// d20 arithmetic, odd-number rounding, HP change, and resistance order readable.
// ============================================================================

export const SAVING_THROWS_CASTER_ID = 'saving_throws_half_damage-caster';
export const SAVING_THROWS_SLOW_TARGET_ID = 'saving_throws_half_damage-slow-target';
export const SAVING_THROWS_AGILE_TARGET_ID = 'saving_throws_half_damage-agile-target';

export const SAVING_THROWS_CASTER_START = { x: 4, y: 5 } as const;
export const SAVING_THROWS_SLOW_TARGET_START = { x: 8, y: 4 } as const;
export const SAVING_THROWS_AGILE_TARGET_START = { x: 8, y: 6 } as const;

export const SAVING_THROWS_TARGET_HP = 30;
export const SAVING_THROWS_DAMAGE_FORMULA = '4d6';
export const SAVING_THROWS_DAMAGE = 15;
export const SAVING_THROWS_DC = 15;

const FIRE_DAMAGE_TYPE = 'Fire' as const;
const FIXED_DAMAGE_FACES = [4, 4, 4, 3] as const;

interface SavingThrowsActors {
  caster: CombatCharacter;
  slowTarget: CombatCharacter;
  agileTarget: CombatCharacter;
}

interface ScenarioSaveRequest {
  controlLabel: string;
  targetId: string;
  d20Roll: number;
  saveEffect: SaveEffectOutcome;
  fireDefense: 'none' | 'resistance' | 'immunity';
  proveDowning?: boolean;
}

// ============================================================================
// Deterministic Dice Sources
// ============================================================================
// Dice helpers still parse and roll the canonical formulas. These tiny random
// streams only choose known faces so a tester can repeat the same proof exactly.
// ============================================================================

function createD20RandomSource(face: number): () => number {
  // A point halfway through the requested face's interval is stable against
  // floating-point boundaries in floor(random * 20) + 1.
  return () => (face - 0.5) / 20;
}

function createDamageRandomSource(): () => number {
  let faceIndex = 0;

  // The shared 4d6 parser asks for four values. Reusing the final face if a
  // future caller asks again keeps the helper deterministic without wrapping.
  return () => {
    const face = FIXED_DAMAGE_FACES[Math.min(faceIndex, FIXED_DAMAGE_FACES.length - 1)];
    faceIndex += 1;
    return (face - 0.5) / 6;
  };
}

// ============================================================================
// Repeatable Actor Setup
// ============================================================================
// Every button begins from the same 30-HP board. Unrelated combatants remain
// untouched, preserving future scenario expansion and cumulative campaign state.
// ============================================================================

function requireActors(
  application: PreviewCombatScenarioControlApplication,
): SavingThrowsActors | null {
  const caster = application.snapshot.characters.find(
    character => character.id === SAVING_THROWS_CASTER_ID,
  );
  const slowTarget = application.snapshot.characters.find(
    character => character.id === SAVING_THROWS_SLOW_TARGET_ID,
  );
  const agileTarget = application.snapshot.characters.find(
    character => character.id === SAVING_THROWS_AGILE_TARGET_ID,
  );

  return caster && slowTarget && agileTarget
    ? { caster, slowTarget, agileTarget }
    : null;
}

function prepareTarget(
  target: CombatCharacter,
  name: string,
  dexterity: number,
  position: { x: number; y: number },
): CombatCharacter {
  return {
    ...target,
    name,
    position: { ...position },
    team: 'enemy',
    currentHP: SAVING_THROWS_TARGET_HP,
    maxHP: SAVING_THROWS_TARGET_HP,
    tempHP: 0,
    damagedThisTurn: false,
    deathSaves: undefined,
    statusEffects: [],
    conditions: [],
    stats: {
      ...target.stats,
      dexterity,
      saveBonuses: undefined,
    },
    savingThrowProficiencies: [],
    resistances: [],
    immunities: [],
    vulnerabilities: [],
  };
}

function prepareActors(actors: SavingThrowsActors): SavingThrowsActors {
  return {
    caster: {
      ...actors.caster,
      name: 'Pyromancer (DC 15 · 4d6 = 15)',
      level: 5,
      position: { ...SAVING_THROWS_CASTER_START },
      team: 'player',
      stats: {
        ...actors.caster.stats,
        intelligence: 18,
      },
    },
    slowTarget: prepareTarget(
      actors.slowTarget,
      'Slow Guard (DEX -1 · 30 HP)',
      8,
      SAVING_THROWS_SLOW_TARGET_START,
    ),
    agileTarget: prepareTarget(
      actors.agileTarget,
      'Agile Scout (DEX +3 · 30 HP)',
      16,
      SAVING_THROWS_AGILE_TARGET_START,
    ),
  };
}

function replaceActors(
  characters: CombatCharacter[],
  actors: SavingThrowsActors,
): CombatCharacter[] {
  const replacements = new Map<string, CombatCharacter>([
    [actors.caster.id, actors.caster],
    [actors.slowTarget.id, actors.slowTarget],
    [actors.agileTarget.id, actors.agileTarget],
  ]);

  return characters.map(character => replacements.get(character.id) ?? character);
}

// ============================================================================
// Canonical Save And Damage Resolution
// ============================================================================
// This orchestration mirrors DamageCommand's rule order. It does not recalculate
// save success, half damage, resistance, or HP locally; it only narrates the
// inputs and outputs returned by the shared engine helpers.
// ============================================================================

function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+ ${modifier}` : `- ${Math.abs(modifier)}`;
}

function formatSaveMath(save: SavingThrowResult): string {
  const roll = save.roll ?? 0;
  const modifier = save.total - roll;
  return `d20 ${roll} ${formatModifier(modifier)} = ${save.total} vs DC ${save.dc}`;
}

function resolveScenarioSave(
  application: PreviewCombatScenarioControlApplication,
  request: ScenarioSaveRequest,
): PreviewCombatScenarioControlPatch {
  const foundActors = requireActors(application);

  if (!foundActors) {
    return { logMessage: 'Saving Throws control skipped because its caster or two authored targets are unavailable.' };
  }

  const actors = prepareActors(foundActors);
  const baseTarget = request.targetId === actors.slowTarget.id
    ? actors.slowTarget
    : request.targetId === actors.agileTarget.id
      ? actors.agileTarget
      : null;

  if (!baseTarget) {
    return { logMessage: `Saving Throws control skipped because target ${request.targetId} is unavailable.` };
  }

  // Each defense control writes a real target defense before calling the same
  // resistance calculator used by DamageCommand. The downing boundary authors
  // 15 current HP on a player-side target because the shared death-save helper
  // only starts player death saves; ordinary controls retain the 30-HP enemy.
  const target: CombatCharacter = {
    ...baseTarget,
    name: request.proveDowning
      ? 'Downing Guard (DEX -1 · 15/30 HP)'
      : baseTarget.name,
    team: request.proveDowning ? 'player' : baseTarget.team,
    currentHP: request.proveDowning ? SAVING_THROWS_DAMAGE : baseTarget.currentHP,
    resistances: request.fireDefense === 'resistance' ? [FIRE_DAMAGE_TYPE] : [],
    immunities: request.fireDefense === 'immunity' ? [FIRE_DAMAGE_TYPE] : [],
  };
  const dc = calculateSpellDC(actors.caster);
  const save = rollSavingThrow(
    target,
    'Dexterity',
    dc,
    undefined,
    { damageType: 'fire', tags: ['magic', 'area'] },
    undefined,
    { rng: createD20RandomSource(request.d20Roll) },
  );
  const rolledDamage = rollDamage(
    SAVING_THROWS_DAMAGE_FORMULA,
    false,
    1,
    createDamageRandomSource(),
  );
  const damageAfterSave = calculateSaveDamage(rolledDamage, save, request.saveEffect);
  const finalDamage = ResistanceCalculator.applyResistances(
    damageAfterSave,
    FIRE_DAMAGE_TYPE,
    target,
    actors.caster,
    true,
  );
  const damagedTarget = applyDamageAndCheckDowned(target, finalDamage);
  const resolvedActors: SavingThrowsActors = {
    ...actors,
    slowTarget: target.id === actors.slowTarget.id ? damagedTarget : actors.slowTarget,
    agileTarget: target.id === actors.agileTarget.id ? damagedTarget : actors.agileTarget,
  };
  const saveMath = formatSaveMath(save);
  const hpMath = `${target.currentHP} → ${damagedTarget.currentHP}/${damagedTarget.maxHP} HP`;

  if (request.fireDefense === 'resistance') {
    return {
      characters: replaceActors(application.snapshot.characters, resolvedActors),
      logMessage: `${request.controlLabel}: ${saveMath} succeeds exactly. ${SAVING_THROWS_DAMAGE_FORMULA} = ${rolledDamage} → ${damageAfterSave} after save (rounded down) → ${finalDamage} after Fire resistance (rounded down); ${target.name} ${hpMath}.`,
    };
  }

  if (request.fireDefense === 'immunity') {
    return {
      characters: replaceActors(application.snapshot.characters, resolvedActors),
      logMessage: `${request.controlLabel}: ${saveMath} succeeds exactly. ${SAVING_THROWS_DAMAGE_FORMULA} = ${rolledDamage} → ${damageAfterSave} after save (rounded down) → ${finalDamage} from Fire immunity; ${target.name} ${hpMath}.`,
    };
  }

  if (request.proveDowning) {
    const deathSaves = damagedTarget.deathSaves;
    const isUnconscious = damagedTarget.statusEffects.some(effect => (
      effect.name.toLowerCase() === 'unconscious'
    ));

    return {
      characters: replaceActors(application.snapshot.characters, resolvedActors),
      logMessage: `${request.controlLabel}: ${saveMath} fails. ${SAVING_THROWS_DAMAGE_FORMULA} = ${rolledDamage} Fire stays full; ${target.name} ${hpMath}. Canonical downing starts death saves ${deathSaves?.successes ?? 0}S/${deathSaves?.failures ?? 0}F and Unconscious ${isUnconscious ? 'applies' : 'is absent'}.`,
    };
  }

  return {
    characters: replaceActors(application.snapshot.characters, resolvedActors),
    logMessage: save.success
      ? `${request.controlLabel}: ${saveMath} succeeds${save.total === dc ? ' exactly' : ''}. ${SAVING_THROWS_DAMAGE_FORMULA} = ${rolledDamage} → ${damageAfterSave} Fire after half damage, rounded down; ${target.name} ${hpMath}.`
      : `${request.controlLabel}: ${saveMath} fails. ${SAVING_THROWS_DAMAGE_FORMULA} = ${rolledDamage} Fire stays full; ${target.name} ${hpMath}.`,
  };
}

// ============================================================================
// Control Routing And Registration
// ============================================================================
// Six inert actions isolate failure, ordinary success, the exact-DC boundary,
// defense ordering, immunity, and the canonical zero-HP transition. They are
// deterministic rule probes rather than spell casts, so they intentionally do
// not claim turn ownership or spend action/slot resources.
// ============================================================================

function applySavingThrowsControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.value === false) {
    return { logMessage: '' };
  }
  if (application.value !== true) {
    return { logMessage: `Saving Throws control ${application.controlId} requires an action trigger.` };
  }

  if (application.controlId === 'failed-save-full') {
    return resolveScenarioSave(application, {
      controlLabel: 'Failed save · full damage',
      targetId: SAVING_THROWS_SLOW_TARGET_ID,
      d20Roll: 10,
      saveEffect: 'half',
      fireDefense: 'none',
    });
  }
  if (application.controlId === 'successful-save-half') {
    return resolveScenarioSave(application, {
      controlLabel: 'Successful save · half damage',
      targetId: SAVING_THROWS_AGILE_TARGET_ID,
      d20Roll: 14,
      saveEffect: 'half',
      fireDefense: 'none',
    });
  }
  if (application.controlId === 'exact-dc-success') {
    return resolveScenarioSave(application, {
      controlLabel: 'Exact DC · success',
      targetId: SAVING_THROWS_SLOW_TARGET_ID,
      d20Roll: 16,
      saveEffect: 'half',
      fireDefense: 'none',
    });
  }
  if (application.controlId === 'save-then-resistance') {
    return resolveScenarioSave(application, {
      controlLabel: 'Save then resistance',
      targetId: SAVING_THROWS_AGILE_TARGET_ID,
      d20Roll: 12,
      saveEffect: 'half',
      fireDefense: 'resistance',
    });
  }
  if (application.controlId === 'save-then-immunity') {
    return resolveScenarioSave(application, {
      controlLabel: 'Save then immunity',
      targetId: SAVING_THROWS_AGILE_TARGET_ID,
      d20Roll: 12,
      saveEffect: 'half',
      fireDefense: 'immunity',
    });
  }
  if (application.controlId === 'failed-save-downing') {
    return resolveScenarioSave(application, {
      controlLabel: 'Failed save · downing',
      targetId: SAVING_THROWS_SLOW_TARGET_ID,
      d20Roll: 10,
      saveEffect: 'half',
      fireDefense: 'none',
      proveDowning: true,
    });
  }

  return { logMessage: `Unknown Saving Throws control: ${application.controlId}.` };
}

const savingThrowsHalfDamageScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'saving_throws_half_damage',
  controls: [
    {
      id: 'failed-save-full',
      label: 'Fail: 10 - 1 vs DC 15',
      description: 'The Slow Guard fails and takes the full deterministic 15 Fire damage.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'successful-save-half',
      label: 'Save: 14 + 3 vs DC 15',
      description: 'The Agile Scout succeeds and takes 7 from odd 15 damage, rounded down.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'exact-dc-success',
      label: 'Exact DC: 16 - 1 = 15',
      description: 'Meeting the save DC succeeds and halves the Slow Guard damage to 7.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'save-then-resistance',
      label: 'Save + Fire resistance',
      description: 'Prove production ordering: 15 becomes 7 after the save, then 3 after resistance.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'save-then-immunity',
      label: 'Save + Fire immunity',
      description: 'Prove immunity wins after the save reduction: 15 becomes 7, then 0.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: 'failed-save-downing',
      label: 'Down: 10 - 1 vs DC 15',
      description: 'A 15-HP player target fails, reaches 0 HP, starts death saves, and becomes Unconscious.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applySavingThrowsControl,
};

export default savingThrowsHalfDamageScenarioControls;
