// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 11:49:10
 * Dependents: components/DesignPreview/steps/spells/spellRegistry.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useState } from 'react';
import thunderwaveData from '@/data/spells/level-1/thunderwave.json';
import type { CombatCharacter, TurnState } from '@/types/combat';
import type { Spell } from '@/types/spells';
import {
  createDamageSpellCastAction,
  resolveDamageSpellCast,
  type DamageSpellCastResolution,
} from '@/systems/spells/mechanics/directDamageSpellCastResolution';
import { createMockCombatCharacter } from '@/utils/core';
import type { SpellScenarioComponentProps } from './types';

/**
 * This file renders the Thunderwave starter scenario for the Tactical Sandbox.
 *
 * It creates two deterministic combatants, sends the cast through the atomic
 * save-based damage transaction, and displays the transaction facts returned by
 * that production resolver. It deliberately does not recreate SpellCommandFactory's
 * movement bridge because that bridge does not accept deterministic RNG inputs.
 *
 * Called by: SpellsDomainShell.tsx through spellRegistry.ts.
 * Depends on: canonical Thunderwave JSON, the shared combat factories, and
 * resolveDamageSpellCast/createDamageSpellCastAction.
 */

// ============================================================================
// Scenario Constants And Types
// ============================================================================
// These values make the three visible controls repeatable while leaving the
// target and caster inside the same 15-foot cube represented by the spell data.
// ============================================================================

const THUNDERWAVE = thunderwaveData as Spell;
const CASTER_ID = 'thunderwave-sandbox-caster';
const TARGET_ID = 'thunderwave-sandbox-target';
const BASELINE_HP = 30;
const BASELINE_LEVEL_ONE_SLOTS = 1;

type ThunderwaveControl = 'failed-save' | 'successful-save';

interface ThunderwaveFixture {
  caster: CombatCharacter;
  target: CombatCharacter;
  turnState: TurnState;
}

interface ThunderwaveScenarioResult {
  resolution: DamageSpellCastResolution;
  receipt: string[];
}

// ============================================================================
// Deterministic Dice Sources
// ============================================================================
// The production dice helpers still parse and roll the authored formulas. Only
// their random source is pinned so each control demonstrates one known result.
// ============================================================================

function fixedFace(face: number, sides: number): () => number {
  // A midpoint in the requested face's interval gives rollDice the exact face
  // without changing the process-wide random number generator.
  return () => (face - 0.5) / sides;
}

// ============================================================================
// Deterministic Combat Fixture
// ============================================================================
// The caster and target share a square because canonical Thunderwave is an area
// spell with a zero numeric targeting range; the target is still treated as an
// enemy creature inside the authored cube by the resolver's area targeting path.
// ============================================================================

function createThunderwaveFixture(): ThunderwaveFixture {
  // Intelligence 16 gives the level-one caster a canonical spell DC of 13.
  const caster = createMockCombatCharacter({
    id: CASTER_ID,
    name: 'Thunder Adept',
    level: 1,
    team: 'player',
    position: { x: 0, y: 0 },
    spellcastingAbility: 'intelligence',
    stats: {
      ...createMockCombatCharacter().stats,
      intelligence: 16,
    },
    spellSlots: {
      level_1: { current: BASELINE_LEVEL_ONE_SLOTS, max: BASELINE_LEVEL_ONE_SLOTS },
      level_2: { current: 0, max: 0 },
      level_3: { current: 0, max: 0 },
      level_4: { current: 0, max: 0 },
      level_5: { current: 0, max: 0 },
      level_6: { current: 0, max: 0 },
      level_7: { current: 0, max: 0 },
      level_8: { current: 0, max: 0 },
      level_9: { current: 0, max: 0 },
    },
  });

  // Constitution 10 and the default Wizard save proficiencies produce a plain
  // Constitution modifier of zero, so the save controls differ only by d20.
  const target = createMockCombatCharacter({
    id: TARGET_ID,
    name: 'Training Dummy',
    level: 1,
    team: 'enemy',
    currentHP: BASELINE_HP,
    maxHP: BASELINE_HP,
    position: { x: 0, y: 0 },
    stats: {
      ...createMockCombatCharacter().stats,
      constitution: 10,
    },
  });

  // The turn state grants exactly one Action to the caster and matches the
  // transaction's off-turn validation contract.
  const turnState: TurnState = {
    currentTurn: 1,
    turnOrder: [CASTER_ID, TARGET_ID],
    currentCharacterId: CASTER_ID,
    phase: 'action',
    actionsThisTurn: [],
  };

  return { caster, target, turnState };
}

// ============================================================================
// Canonical Thunderwave Transaction Adapter
// ============================================================================
// The resolver owns validation, scaling, save outcome, resistance, HP/downing,
// Action payment, and slot payment. This adapter only chooses deterministic
// inputs and projects the returned receipt for the preview.
// ============================================================================

function executeThunderwave(control: ThunderwaveControl): ThunderwaveScenarioResult {
  // Each cast starts from the exact baseline so the controls remain comparable
  // and Reset can recreate the same state without reversing damage manually.
  const fixture = createThunderwaveFixture();

  // The canonical character/action factory creates the spell ability and exact
  // level-one slot cost used by the atomic damage transaction.
  const action = createDamageSpellCastAction(THUNDERWAVE, fixture.caster, 1);
  fixture.caster.abilities = [action.ability];

  // Failed-save and successful-save controls pin only the Constitution d20;
  // every 2d8 Thunder damage die is pinned to eight through the shared roller.
  const saveFace = control === 'failed-save' ? 5 : 15;
  const resolution = resolveDamageSpellCast({
    characters: [fixture.caster, fixture.target],
    mapData: null,
    turnState: fixture.turnState,
    casterId: CASTER_ID,
    targetId: TARGET_ID,
    action,
    damageRng: fixedFace(8, 8),
    saveRng: fixedFace(saveFace, 20),
  });

  // No engine combat log is returned by resolveDamageSpellCast. These ordered
  // lines are therefore an adapter projection of its returned canonical receipt,
  // not pretend SpellCommandFactory log entries.
  const casterBefore = resolution.casterBefore;
  const casterAfter = resolution.casterAfter;
  const targetBefore = resolution.targetBefore;
  const targetAfter = resolution.targetAfter;
  const saveOutcome = resolution.saveTotal !== undefined && resolution.saveDC !== undefined
    ? `${resolution.saveTotal >= resolution.saveDC ? 'success' : 'failure'} (${resolution.saveTotal} vs DC ${resolution.saveDC})`
    : 'not returned';
  const actionBefore = casterBefore?.actionEconomy.action.remaining ?? 0;
  const actionAfter = casterAfter?.actionEconomy.action.remaining ?? actionBefore;
  const slotBefore = casterBefore?.spellSlots?.level_1?.current ?? 0;
  const slotAfter = casterAfter?.spellSlots?.level_1?.current ?? slotBefore;

  const receipt = [
    `resolveDamageSpellCast: ${resolution.status} (${resolution.reason}).`,
    `Targeting and save: ${targetBefore?.name ?? 'unknown target'} Constitution save ${saveOutcome}.`,
    `Damage: ${resolution.rolledDamage} rolled -> ${resolution.damageAfterSave} after save -> ${resolution.finalDamage} final after resistance.`,
    `Payment: Action ${actionBefore} -> ${actionAfter}; level-1 slot ${slotBefore} -> ${slotAfter}.`,
    `HP: ${targetBefore?.currentHP ?? BASELINE_HP} -> ${targetAfter?.currentHP ?? BASELINE_HP}.`,
  ];

  return { resolution, receipt };
}

// ============================================================================
// Rendered Scenario Surface
// ============================================================================
// The UI exposes only the returned transaction facts and an exact baseline
// Reset. It names the movement gap instead of showing a fabricated displacement.
// ============================================================================

export const ThunderwaveScenario: React.FC<SpellScenarioComponentProps> = ({ spell }) => {
  // The memoized fixture is the exact no-cast baseline shown after mount/reset.
  const baseline = useMemo(createThunderwaveFixture, []);
  const [result, setResult] = useState<ThunderwaveScenarioResult | null>(null);
  const [runningControl, setRunningControl] = useState<ThunderwaveControl | null>(null);

  // Running a control replaces the visible receipt with the fresh canonical
  // transaction; no UI state is used to simulate a second cast or movement.
  const runControl = (control: ThunderwaveControl) => {
    setRunningControl(control);
    try {
      setResult(executeThunderwave(control));
    } finally {
      setRunningControl(null);
    }
  };

  // Reset removes the transaction snapshot and returns every displayed fact to
  // the original caster, target, Action, slot, HP, and movement baseline.
  const reset = () => {
    setResult(null);
    setRunningControl(null);
  };

  const resolution = result?.resolution;
  const casterBefore = resolution?.casterBefore ?? baseline.caster;
  const casterAfter = resolution?.casterAfter ?? baseline.caster;
  const targetBefore = resolution?.targetBefore ?? baseline.target;
  const targetAfter = resolution?.targetAfter ?? baseline.target;
  const saveWasReturned = resolution?.saveTotal !== undefined && resolution.saveDC !== undefined;
  const saveSucceeded = saveWasReturned ? resolution.saveTotal! >= resolution.saveDC! : null;
  const actionBefore = casterBefore.actionEconomy.action.remaining;
  const actionAfter = casterAfter.actionEconomy.action.remaining;
  const slotBefore = casterBefore.spellSlots?.level_1?.current ?? 0;
  const slotAfter = casterAfter.spellSlots?.level_1?.current ?? 0;

  return (
    <div data-testid="thunderwave-scenario" className="space-y-4">
      <div className="rounded-lg border border-cyan-400/35 bg-cyan-950/25 p-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Canonical Thunderwave scenario</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          {spell.name} uses the production atomic damage-spell transaction for its Constitution save, half damage, resistance, HP, Action, and slot outcome.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3" data-testid="thunderwave-identities">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Actors and HP</p>
          <p className="mt-2 text-sm text-slate-200">Caster: <span className="font-bold">{baseline.caster.name}</span></p>
          <p className="text-sm text-slate-200">Target: <span className="font-bold">{targetAfter.name}</span></p>
          <p data-testid="thunderwave-target-hp" className="mt-2 text-sm text-slate-100">
            Target HP: <span className="font-bold">{targetBefore.currentHP}</span> before → <span className="font-bold">{targetAfter.currentHP}</span> after
          </p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3" data-testid="thunderwave-outcome">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Canonical outcome</p>
          <p data-testid="thunderwave-save" className="mt-2 text-sm text-slate-200">
            Constitution save: <span className="font-bold">{saveWasReturned ? `${resolution.saveTotal} vs DC ${resolution.saveDC} (${saveSucceeded ? 'SUCCESS' : 'FAILURE'})` : 'Not cast'}</span>
          </p>
          <p data-testid="thunderwave-damage" className="text-sm text-slate-200">
            Damage: <span className="font-bold">{resolution?.rolledDamage ?? 0}</span> rolled → <span className="font-bold">{resolution?.damageAfterSave ?? 0}</span> after save → <span className="font-bold">{resolution?.finalDamage ?? 0}</span> final Thunder
          </p>
          <p data-testid="thunderwave-payment" className="mt-2 text-xs text-emerald-300">
            Action: {actionBefore} before → {actionAfter} after; level-1 slot: {slotBefore} before → {slotAfter} after
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Thunderwave deterministic controls">
        <button
          type="button"
          onClick={() => runControl('failed-save')}
          disabled={runningControl !== null}
          className="rounded-lg border border-rose-400/50 bg-rose-950/50 px-3 py-2 text-xs font-bold text-rose-100 disabled:opacity-50"
        >
          {runningControl === 'failed-save' ? 'Resolving failed save…' : 'Resolve failed Constitution save'}
        </button>
        <button
          type="button"
          onClick={() => runControl('successful-save')}
          disabled={runningControl !== null}
          className="rounded-lg border border-emerald-400/50 bg-emerald-950/50 px-3 py-2 text-xs font-bold text-emerald-100 disabled:opacity-50"
        >
          {runningControl === 'successful-save' ? 'Resolving successful save…' : 'Resolve successful Constitution save'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200"
        >
          Reset scenario
        </button>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Ordered transaction receipt projection</p>
        <ol aria-label="Thunderwave transaction receipt" className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-300">
          {result?.receipt.map(entry => <li key={entry}>{entry}</li>) ?? <li>No canonical transaction yet.</li>}
        </ol>
        <p data-testid="thunderwave-receipt-source" className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Receipt source: adapter projection of returned resolveDamageSpellCast fields; these are not engine-emitted combat log entries.
        </p>
      </div>

      <p data-testid="thunderwave-forced-movement-boundary" className="text-xs leading-relaxed text-amber-200/80">
        Forced-movement boundary: canonical Thunderwave data and the SpellCommandFactory bridge define a 10-foot push on a failed save, but resolveDamageSpellCast returns no position or movement receipt. This deterministic leaf therefore proves no displacement and does not claim the push is executed here.
      </p>
    </div>
  );
};

export default ThunderwaveScenario;
