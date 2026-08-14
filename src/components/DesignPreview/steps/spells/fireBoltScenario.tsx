// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 11:23:55
 * Dependents: components/DesignPreview/steps/spells/spellRegistry.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useState } from 'react';
import fireBoltData from '@/data/spells/level-0/fire-bolt.json';
import type { CombatCharacter, CombatLogEntry, CombatState } from '@/types/combat';
import { isDamageEffect, type DamageEffect, type Spell } from '@/types/spells';
import { calculateProficiencyBonus } from '@/utils/character/savingThrowUtils';
import { getAbilityModifierValue } from '@/utils/character/statUtils';
import { applyDamageAndCheckDowned } from '@/utils/combat/deathSaveUtils';
import { ResistanceCalculator } from '@/utils/combat/resistanceUtils';
import { resolveAttack, rollDamage } from '@/utils/combat';
import { createMockCombatCharacter, createMockCombatState } from '@/utils/core';
import type { SpellScenarioComponentProps } from './types';

/**
 * This file renders the first executable Fire Bolt scenario in the Tactical
 * Sandbox Spells domain.
 *
 * It creates a small deterministic caster-and-target fixture, composes the
 * production attack, dice, resistance, and HP helpers, and displays only the
 * facts returned by that canonical helper transaction. The Rules host reaches
 * this component through spellRegistry.ts.
 *
 * Called by: SpellsDomainShell.tsx through the Fire Bolt registry entry.
 * Depends on: the canonical Fire Bolt JSON record, shared combat helpers, and
 * the shared combat fixture factories used by other preview scenarios.
 */

// ============================================================================
// Scenario Constants And Types
// ============================================================================
// The controls intentionally change only the deterministic attack/damage input.
// The target, caster, spell, and helper path remain identical between outcomes.
// ============================================================================

const FIRE_BOLT = fireBoltData as Spell;
const CASTER_ID = 'fire-bolt-sandbox-caster';
const TARGET_ID = 'fire-bolt-sandbox-target';
const BASELINE_HP = 30;

type FireBoltControl = 'hit' | 'miss';

interface FireBoltScenarioResult {
  state: CombatState;
  targetBefore: CombatCharacter;
  targetAfter: CombatCharacter;
  attackLog?: CombatLogEntry;
  damageLogs: CombatLogEntry[];
}

// ============================================================================
// Deterministic Combat Fixture
// ============================================================================
// The fixture uses the shared combat-character/state factories so the helpers
// receive the same broad state shape as an ordinary combat execution. It does
// not seed a second HP or damage calculation in the component.
// ============================================================================

function createFireBoltFixture(): { caster: CombatCharacter; target: CombatCharacter; state: CombatState } {
  // The Intelligence score and level produce a normal level-one spell attack
  // bonus; AC 12 makes the two deterministic d20 controls visibly different.
  const caster = createMockCombatCharacter({
    id: CASTER_ID,
    name: 'Evoker',
    level: 1,
    team: 'player',
    position: { x: 2, y: 4 },
    spellcastingAbility: 'intelligence',
    stats: {
      ...createMockCombatCharacter().stats,
      intelligence: 16,
    },
  });

  // The target starts at a stable HP value so Reset can restore an exact
  // before/after comparison after either canonical command outcome.
  const target = createMockCombatCharacter({
    id: TARGET_ID,
    name: 'Training Dummy',
    team: 'enemy',
    armorClass: 12,
    currentHP: BASELINE_HP,
    maxHP: BASELINE_HP,
    position: { x: 7, y: 4 },
  });

  // The turn state marks the caster as active, matching the normal action
  // phase without adding an action-spending claim that this command path does
  // not return.
  const state = createMockCombatState({
    characters: [caster, target],
    turnState: {
      currentTurn: 1,
      turnOrder: [CASTER_ID, TARGET_ID],
      currentCharacterId: CASTER_ID,
      phase: 'action',
      actionsThisTurn: [],
    },
    combatLog: [],
  });

  return { caster, target, state };
}

// ============================================================================
// Canonical Fire Bolt Helper Transaction
// ============================================================================
// The helper transaction is the only source used for the visible attack
// outcome, damage value, and HP transition. The UI never replays the dice
// formula or subtracts damage itself. Its ordered receipt below is an
// adapter-created projection of those helper results, not engine-emitted log
// entries from SpellCommandFactory.
// ============================================================================

function executeFireBolt(control: FireBoltControl): FireBoltScenarioResult {
  const fixture = createFireBoltFixture();

  // Read the damage row from canonical spell data. Fire Bolt is run at level
  // one here, so the authored 1d10 formula is the exact base formula required
  // by this starter fixture.
  const damageEffect = FIRE_BOLT.effects.find(isDamageEffect) as DamageEffect | undefined;
  if (!damageEffect) {
    throw new Error('Fire Bolt canonical data has no damage effect.');
  }

  // This mirrors SpellCommandFactory's spell-attack bonus calculation while
  // keeping the deterministic d20 explicit because the factory API does not
  // currently expose its CommandContext attackRollRng/damageRng inputs.
  const attackModifier = getAbilityModifierValue(fixture.caster.stats.intelligence) + calculateProficiencyBonus(fixture.caster.level);
  const attackRoll = control === 'hit' ? 16 : 2;
  const attack = resolveAttack(attackRoll, attackModifier, fixture.target.armorClass ?? 10);
  // These entries reuse CombatLogEntry's display shape so the receipt remains
  // easy to read beside ordinary combat history, but the adapter creates them
  // from helper results; SpellCommandFactory did not emit these records.
  const attackLog: CombatLogEntry = {
    id: 'fire-bolt-attack-log',
    timestamp: 1,
    type: 'action',
    message: `${fixture.caster.name} casts ${FIRE_BOLT.name} at ${fixture.target.name}. ${attackRoll} + ${attackModifier} = ${attack.total} vs AC ${fixture.target.armorClass ?? 10}. ${attack.isHit ? 'HIT!' : 'MISS.'}`,
    characterId: fixture.caster.id,
    targetIds: [fixture.target.id],
    data: {
      spellId: FIRE_BOLT.id,
      spellName: FIRE_BOLT.name,
      attackType: 'spell',
      isHit: attack.isHit,
      isCrit: attack.isCritical,
      isAutoMiss: attack.isAutoMiss,
      rollResult: attackRoll,
      attackModifier,
      attackTotal: attack.total,
    },
  };

  let targetAfter = fixture.target;
  const damageLogs: CombatLogEntry[] = [];

  // Hit-conditioned damage uses the canonical dice roller, explicit RNG, the
  // canonical resistance calculator, and the shared HP/downing transition.
  if (attack.isHit) {
    const rawDamage = rollDamage(damageEffect.damage.dice, attack.isCritical, 1, () => 0.75);
    const finalDamage = ResistanceCalculator.applyResistances(
      rawDamage,
      damageEffect.damage.type,
      fixture.target,
      fixture.caster,
      true,
    );
    targetAfter = applyDamageAndCheckDowned(fixture.target, finalDamage, attack.isCritical);
    damageLogs.push({
      id: 'fire-bolt-damage-log',
      timestamp: 2,
      type: 'damage',
      message: `${fixture.caster.name} hits ${fixture.target.name} with ${FIRE_BOLT.name} for ${finalDamage} ${damageEffect.damage.type} damage`,
      characterId: fixture.target.id,
      targetIds: [fixture.target.id],
      data: {
        value: finalDamage,
        type: damageEffect.damage.type,
        damageType: damageEffect.damage.type,
        damageEventBoundary: 'post_hp',
        sourceCharacterId: fixture.caster.id,
        targetCharacterId: fixture.target.id,
        hitConfirmed: true,
        rawDamage,
        finalDamage,
        hitPointsBefore: fixture.target.currentHP,
        hitPointsAfter: targetAfter.currentHP,
        temporaryHitPointsBefore: fixture.target.tempHP ?? 0,
        temporaryHitPointsAfter: targetAfter.tempHP ?? 0,
        targetDownedAfter: targetAfter.currentHP <= 0,
      },
    });
  }

  // The adapter records the helper facts in the same ordered display shape that
  // the preview receipt consumes; it never invents an object ignition entry
  // because the full factory path does not return that state today.
  const state: CombatState = {
    ...fixture.state,
    characters: fixture.state.characters.map(character => character.id === targetAfter.id ? targetAfter : character),
    combatLog: [attackLog, ...damageLogs],
  };

  return { state, targetBefore: fixture.target, targetAfter, attackLog, damageLogs };
}

// ============================================================================
// Rendered Scenario Surface
// ============================================================================
// This surface keeps the scenario readable in both the shell and the retained
// Rules host. Reset clears the returned canonical transaction and recreates the
// exact baseline view rather than inventing a reverse damage operation.
// ============================================================================

export const FireBoltScenario: React.FC<SpellScenarioComponentProps> = ({ spell }) => {
  const baseline = useMemo(createFireBoltFixture, []);
  const [result, setResult] = useState<FireBoltScenarioResult | null>(null);
  const [runningControl, setRunningControl] = useState<FireBoltControl | null>(null);

  // The preview controls expose the helper transaction only after it returns.
  // A failed transaction leaves the prior visible result intact.
  const runControl = (control: FireBoltControl) => {
    setRunningControl(control);
    try {
      setResult(executeFireBolt(control));
    } finally {
      setRunningControl(null);
    }
  };

  // Reset removes the prior transaction snapshot. Because each cast starts
  // from a fresh fixture, this returns every displayed HP/log fact exactly to
  // the canonical baseline without undoing state by hand.
  const reset = () => {
    setResult(null);
    setRunningControl(null);
  };

  const targetBefore = result?.targetBefore ?? baseline.target;
  const targetAfter = result?.targetAfter ?? baseline.target;
  const attack = result?.attackLog?.data;
  const damage = result?.damageLogs[0]?.data;
  const orderedLog = result?.state.combatLog ?? [];

  return (
    <div data-testid="fire-bolt-scenario" className="space-y-4">
      <div className="rounded-lg border border-orange-400/35 bg-orange-950/25 p-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-300">Canonical Fire Bolt scenario</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          {spell.name} uses a production-helper transaction for spell attack, hit-conditioned Fire damage, resistance, and HP resolution.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3" data-testid="fire-bolt-identities">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Actors and HP</p>
          <p className="mt-2 text-sm text-slate-200">Caster: <span className="font-bold">{baseline.caster.name}</span></p>
          <p className="text-sm text-slate-200">Target: <span className="font-bold">{targetAfter.name}</span></p>
          <p data-testid="fire-bolt-target-hp" className="mt-2 text-sm text-slate-100">
            Target HP: <span className="font-bold">{targetBefore.currentHP}</span> before → <span className="font-bold">{targetAfter.currentHP}</span> after
          </p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3" data-testid="fire-bolt-outcome">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Canonical outcome</p>
          <p className="mt-2 text-sm text-slate-200">
            Attack: <span className="font-bold">{attack ? (attack.isHit ? 'HIT' : 'MISS') : 'Not cast'}</span>
            {attack?.rollResult !== undefined ? ` (${attack.rollResult} + ${attack.attackModifier ?? '—'} = ${attack.attackTotal ?? '—'})` : ''}
          </p>
          <p className="text-sm text-slate-200">
            Fire damage: <span className="font-bold">{damage?.finalDamage ?? 0}</span>
            {damage ? ` (${damage.damageType})` : ' (no hit-conditioned damage)'}
          </p>
          <p data-testid="fire-bolt-resource" className="mt-2 text-xs text-emerald-300">Spell slot: none consumed — level 0 cantrip.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Fire Bolt deterministic controls">
        <button
          type="button"
          onClick={() => runControl('hit')}
          disabled={runningControl !== null}
          className="rounded-lg border border-emerald-400/50 bg-emerald-950/50 px-3 py-2 text-xs font-bold text-emerald-100 disabled:opacity-50"
        >
          {runningControl === 'hit' ? 'Resolving hit…' : 'Resolve deterministic hit'}
        </button>
        <button
          type="button"
          onClick={() => runControl('miss')}
          disabled={runningControl !== null}
          className="rounded-lg border border-amber-400/50 bg-amber-950/50 px-3 py-2 text-xs font-bold text-amber-100 disabled:opacity-50"
        >
          {runningControl === 'miss' ? 'Resolving miss…' : 'Resolve deterministic miss'}
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
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Ordered helper receipt</p>
        <ol aria-label="Fire Bolt helper receipt" className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-300">
          {orderedLog.length > 0 ? orderedLog.map(entry => <li key={entry.id}>{entry.message}</li>) : <li>No helper transaction yet.</li>}
        </ol>
      </div>

      <p data-testid="fire-bolt-unsupported-boundary" className="text-xs leading-relaxed text-amber-200/80">
        Runtime boundary: the canonical Fire Bolt record includes an environmental object-ignition rider, but this helper path does not return an object state change. The full SpellCommandFactory path also does not expose deterministic RNG inputs, so this scenario proves the supported creature attack and damage helpers only.
      </p>
    </div>
  );
};

export default FireBoltScenario;
