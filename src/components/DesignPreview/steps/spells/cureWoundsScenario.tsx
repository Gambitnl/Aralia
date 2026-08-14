// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 12:07:10
 * Dependents: components/DesignPreview/steps/spells/spellRegistry.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useState } from 'react';
import cureWoundsData from '@/data/spells/level-1/cure-wounds.json';
import type { BattleMapData, BattleMapTile, CombatCharacter, SpellSlots, TurnState } from '@/types/combat';
import type { ScalingFormula } from '@/types/spells';
import type { Spell } from '@/types/spells';
import { isHealingEffect } from '@/types/spells';
import { getAbilityModifierValue } from '@/utils/character/statUtils';
import { createMockCombatCharacter } from '@/utils/core';
import { rollDamage } from '@/utils/combat/combatUtils';
import { ScalingEngine } from '@/systems/spells/mechanics/ScalingEngine';
import {
  createHitPointSpellAction,
  resolveHitPointAction,
  type HitPointActionResolution,
} from '@/systems/spells/mechanics/healingTemporaryHitPointResolution';
import type { SpellScenarioComponentProps } from './types';

/**
 * This file renders the executable Cure Wounds starter scenario.
 *
 * It starts each control from a small map-backed caster and target fixture,
 * derives the healing formula from the canonical Cure Wounds record, and
 * sends the offered amount through the production hit-point transaction. The
 * preview displays the transaction's returned actors and resources, while its
 * ordered receipt clearly labels the small adapter projection used for prose.
 *
 * Called by: SpellsDomainShell.tsx through spellRegistry.ts.
 * Depends on: Cure Wounds JSON, ScalingEngine, rollDamage, and the atomic
 * hit-point action resolver.
 */

// ============================================================================
// Scenario Constants And Types
// ============================================================================
// These identities stay stable across controls so a human can compare the
// returned HP, downed-state, Action, and slot facts without hunting for a new
// actor after every button press.
// ============================================================================

const CURE_WOUNDS = cureWoundsData as Spell;
const CASTER_ID = 'cure-wounds-sandbox-caster';
const TARGET_ID = 'cure-wounds-sandbox-target';
const MAX_HP = 24;
const CAST_AT_LEVEL = 1;

type CureWoundsControl = 'heal-cap' | 'heal-downed' | 'reject-undead';

interface CureWoundsFixture {
  caster: CombatCharacter;
  target: CombatCharacter;
  mapData: BattleMapData;
  turnState: TurnState;
}

interface CureWoundsScenarioResult {
  control: CureWoundsControl;
  resolution: HitPointActionResolution;
  baseFormula: string;
  scaledFormula: string;
  offeredFormula: string;
  spellcastingModifier: number;
  rolledHealing: number;
  receipt: string[];
}

// ============================================================================
// Deterministic Map And Fixture
// ============================================================================
// TargetResolver requires map evidence for a line-of-sight spell. This map is
// deliberately boring: every tile is visible and the actors begin on adjacent
// squares, so the scenario proves Cure Wounds' touch boundary rather than a
// second terrain rule.
// ============================================================================

function createTile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'grass',
    elevation: 0,
    movementCost: 1,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < 8; x += 1) {
    for (let y = 0; y < 8; y += 1) {
      tiles.set(`${x}-${y}`, createTile(x, y));
    }
  }
  return {
    dimensions: { width: 8, height: 8 },
    tiles,
    theme: 'forest',
    seed: 13,
  };
}

function createSpellSlots(): SpellSlots {
  // SpellSlots is a complete level-one-through-nine resource record. Keeping
  // unused levels at zero makes the fixture satisfy the same canonical shape
  // as a live character without changing the level-one payment being shown.
  return {
    level_1: { current: 2, max: 2 },
    level_2: { current: 0, max: 0 },
    level_3: { current: 0, max: 0 },
    level_4: { current: 0, max: 0 },
    level_5: { current: 0, max: 0 },
    level_6: { current: 0, max: 0 },
    level_7: { current: 0, max: 0 },
    level_8: { current: 0, max: 0 },
    level_9: { current: 0, max: 0 },
  };
}

function createCureWoundsFixture(control: CureWoundsControl): CureWoundsFixture {
  // Intelligence 16 makes the stat contribution visible as the canonical +3
  // spellcasting modifier while keeping the level-one slot cost unchanged.
  const caster = createMockCombatCharacter({
    id: CASTER_ID,
    name: 'Field Cleric',
    level: 1,
    team: 'player',
    position: { x: 3, y: 3 },
    spellcastingAbility: 'intelligence',
    stats: {
      ...createMockCombatCharacter().stats,
      intelligence: 16,
    },
    spellSlots: createSpellSlots(),
  });

  // The cap control starts just below maximum HP. The downed control carries
  // the real dying markers so applyHealingAndRestore can prove their cleanup.
  const target = createMockCombatCharacter({
    id: TARGET_ID,
    name: 'Wounded Ally',
    team: 'player',
    position: { x: 4, y: 3 },
    currentHP: control === 'heal-downed' ? 0 : 20,
    maxHP: MAX_HP,
    creatureTypes: control === 'reject-undead' ? ['Undead'] : ['Humanoid'],
  });

  if (control === 'heal-downed') {
    // These are canonical downed-state fields, not UI-only labels. The shared
    // healing helper removes the dying state when the returned HP is positive.
    target.deathSaves = { successes: 1, failures: 2, isStable: false };
    target.statusEffects.push({
      id: 'unconscious',
      name: 'Unconscious',
      type: 'debuff',
      description: '',
      duration: 999,
      icon: '',
    });
    target.conditions = [{
      name: 'Unconscious',
      duration: { type: 'permanent' },
      appliedTurn: 1,
    }];
  }

  return {
    caster,
    target,
    mapData: createMap(),
    turnState: {
      currentTurn: 1,
      turnOrder: [CASTER_ID, TARGET_ID],
      currentCharacterId: CASTER_ID,
      phase: 'action',
      actionsThisTurn: [],
    },
  };
}

// ============================================================================
// Canonical Formula And Stat Projection
// ============================================================================
// The adapter reads the effect's authored dice and slot scaling, then uses the
// shared stat and dice helpers. It does not add HP itself; the resulting amount
// is only an input to resolveHitPointAction.
// ============================================================================

const SPELLCASTING_STAT_KEYS = {
  strength: 'strength',
  dexterity: 'dexterity',
  constitution: 'constitution',
  intelligence: 'intelligence',
  wisdom: 'wisdom',
  charisma: 'charisma',
} as const;

function getSpellcastingModifier(caster: CombatCharacter): number {
  // The spell factory defaults unknown or absent spellcasting ability to
  // Intelligence, so the scenario uses the same safe default for the formula.
  const requestedKey = String(caster.spellcastingAbility ?? 'intelligence').toLowerCase();
  const statKey = SPELLCASTING_STAT_KEYS[requestedKey as keyof typeof SPELLCASTING_STAT_KEYS] ?? 'intelligence';
  return getAbilityModifierValue(caster.stats[statKey]);
}

function getHealingEffect(): { dice: string; scaling: ScalingFormula } {
  const effect = CURE_WOUNDS.effects.find(isHealingEffect);
  if (!effect?.healing.dice || !effect.scaling) {
    throw new Error('Cure Wounds canonical data is missing its healing dice or slot scaling.');
  }
  return { dice: effect.healing.dice, scaling: effect.scaling };
}

// ============================================================================
// Canonical Cure Wounds Transaction
// ============================================================================
// The only state mutation in this scenario is the immutable roster returned by
// resolveHitPointAction. Fixed dice input keeps the UI repeatable without
// replacing Math.random globally or bypassing the production dice parser.
// ============================================================================

function executeCureWounds(control: CureWoundsControl): CureWoundsScenarioResult {
  const fixture = createCureWoundsFixture(control);
  const healingEffect = getHealingEffect();
  const action = createHitPointSpellAction(CURE_WOUNDS, fixture.caster, CAST_AT_LEVEL);
  const spellcastingModifier = getSpellcastingModifier(fixture.caster);
  const scaledFormula = ScalingEngine.scaleEffect(
    healingEffect.dice,
    healingEffect.scaling,
    CAST_AT_LEVEL,
    fixture.caster.level,
    CURE_WOUNDS.level,
  );
  const offeredFormula = `${scaledFormula}${spellcastingModifier >= 0 ? '+' : ''}${spellcastingModifier}`;

  // Every d8 resolves to seven through the shared rollDamage parser and an
  // injected face source, making the offered level-one amount 2d8+3 = 17.
  const rolledHealing = rollDamage(offeredFormula, false, 1, () => 0.75);
  const resolution = resolveHitPointAction({
    characters: [fixture.caster, fixture.target],
    mapData: fixture.mapData,
    turnState: fixture.turnState,
    casterId: CASTER_ID,
    targetId: TARGET_ID,
    action,
    mode: 'healing',
    amounts: [rolledHealing],
  });

  const casterBefore = resolution.casterBefore;
  const casterAfter = resolution.casterAfter;
  const targetBefore = resolution.targetBefore;
  const targetAfter = resolution.targetAfter;
  const receipt = [
    `Production return: resolveHitPointAction ${resolution.status} (${resolution.reason}).`,
    `Production return: ${targetBefore?.name ?? 'unknown target'} HP ${targetBefore?.currentHP ?? 0} -> ${targetAfter?.currentHP ?? 0}; downed ${targetBefore?.currentHP === 0 ? 'yes' : 'no'} -> ${targetAfter?.currentHP === 0 ? 'yes' : 'no'}.`,
    `Adapter projection: ${offeredFormula} offered ${rolledHealing}; requested ${rolledHealing}, applied ${resolution.appliedAmount} (max HP ${targetAfter?.maxHP ?? MAX_HP}).`,
    `Production return: Action ${casterBefore?.actionEconomy.action.remaining ?? 0} -> ${casterAfter?.actionEconomy.action.remaining ?? 0}; level-1 slot ${casterBefore?.spellSlots?.level_1?.current ?? 0} -> ${casterAfter?.spellSlots?.level_1?.current ?? 0}.`,
    'Adapter projection: receipt prose is derived from returned resolver fields; no engine combat-log entry is fabricated.',
  ];

  return {
    control,
    resolution,
    baseFormula: healingEffect.dice,
    scaledFormula,
    offeredFormula,
    spellcastingModifier,
    rolledHealing,
    receipt,
  };
}

// ============================================================================
// Rendered Scenario Surface
// ============================================================================
// Reset clears the returned transaction and recreates the exact fixture view.
// This avoids a hand-written reverse-heal path that could drift from canonical
// HP caps, death-save cleanup, or resource payment rules.
// ============================================================================

export const CureWoundsScenario: React.FC<SpellScenarioComponentProps> = ({ spell }) => {
  const baseline = useMemo(() => createCureWoundsFixture('heal-cap'), []);
  const [result, setResult] = useState<CureWoundsScenarioResult | null>(null);
  const [runningControl, setRunningControl] = useState<CureWoundsControl | null>(null);

  // Each control executes once against a fresh fixture, so repeated clicks do
  // not accidentally spend two slots or hide which transaction was inspected.
  const runControl = (control: CureWoundsControl) => {
    setRunningControl(control);
    try {
      setResult(executeCureWounds(control));
    } finally {
      setRunningControl(null);
    }
  };

  // Reset returns every displayed identity, HP, Action, and slot fact to the
  // exact cap-control baseline shown on first render.
  const reset = () => {
    setResult(null);
    setRunningControl(null);
  };

  const resolution = result?.resolution;
  const casterBefore = resolution?.casterBefore ?? baseline.caster;
  const casterAfter = resolution?.casterAfter ?? baseline.caster;
  const targetBefore = resolution?.targetBefore ?? baseline.target;
  const targetAfter = resolution?.targetAfter ?? baseline.target;
  const targetDownedBefore = targetBefore.currentHP === 0;
  const targetDownedAfter = targetAfter.currentHP === 0;
  const actionBefore = casterBefore.actionEconomy.action.remaining;
  const actionAfter = casterAfter.actionEconomy.action.remaining;
  const slotBefore = casterBefore.spellSlots?.level_1?.current ?? 0;
  const slotAfter = casterAfter.spellSlots?.level_1?.current ?? 0;

  return (
    <div data-testid="cure-wounds-scenario" className="space-y-4">
      <div className="rounded-lg border border-emerald-400/35 bg-emerald-950/25 p-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Canonical Cure Wounds scenario</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          {spell.name} uses the production atomic hit-point transaction for touch targeting, HP restoration, downed cleanup, Action payment, and slot payment.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3" data-testid="cure-wounds-identities">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Actors and HP</p>
          <p className="mt-2 text-sm text-slate-200">Caster: <span className="font-bold">{casterAfter.name}</span></p>
          <p className="text-sm text-slate-200">Target: <span className="font-bold">{targetAfter.name}</span></p>
          <p data-testid="cure-wounds-target-hp" className="mt-2 text-sm text-slate-100">
            Target HP: <span className="font-bold">{targetBefore.currentHP}</span> before → <span className="font-bold">{targetAfter.currentHP}</span> after
          </p>
          <p data-testid="cure-wounds-downed" className="text-xs text-slate-300">
            Downed: {targetDownedBefore ? 'yes' : 'no'} before → {targetDownedAfter ? 'yes' : 'no'} after
          </p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3" data-testid="cure-wounds-outcome">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Canonical outcome</p>
          <p data-testid="cure-wounds-formula" className="mt-2 text-sm text-slate-200">
            Formula: <span className="font-bold">{result?.offeredFormula ?? '2d8+3'}</span> ({result?.baseFormula ?? '2d8'} → {result?.scaledFormula ?? '2d8'} at level 1)
          </p>
          <p data-testid="cure-wounds-healing" className="text-sm text-slate-200">
            Healing: <span className="font-bold">{result?.rolledHealing ?? 0}</span> rolled; requested <span className="font-bold">{result?.rolledHealing ?? 0}</span>, applied <span className="font-bold">{resolution?.appliedAmount ?? 0}</span> (max {targetAfter.maxHP})
          </p>
          <p data-testid="cure-wounds-payment" className="mt-2 text-xs text-emerald-300">
            Action: {actionBefore} before → {actionAfter} after; level-1 slot: {slotBefore} before → {slotAfter} after
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Cure Wounds deterministic controls">
        <button
          type="button"
          onClick={() => runControl('heal-cap')}
          disabled={runningControl !== null}
          className="rounded-lg border border-emerald-400/50 bg-emerald-950/50 px-3 py-2 text-xs font-bold text-emerald-100 disabled:opacity-50"
        >
          {runningControl === 'heal-cap' ? 'Resolving cap heal…' : 'Heal wounded target (max cap)'}
        </button>
        <button
          type="button"
          onClick={() => runControl('heal-downed')}
          disabled={runningControl !== null}
          className="rounded-lg border border-cyan-400/50 bg-cyan-950/50 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-50"
        >
          {runningControl === 'heal-downed' ? 'Resolving downed heal…' : 'Heal downed living target'}
        </button>
        <button
          type="button"
          onClick={() => runControl('reject-undead')}
          disabled={runningControl !== null}
          className="rounded-lg border border-rose-400/50 bg-rose-950/50 px-3 py-2 text-xs font-bold text-rose-100 disabled:opacity-50"
        >
          {runningControl === 'reject-undead' ? 'Checking target…' : 'Reject Undead target'}
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
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Ordered transaction receipt</p>
        <ol aria-label="Cure Wounds transaction receipt" className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-300">
          {result?.receipt.map(entry => <li key={entry}>{entry}</li>) ?? <li>No canonical transaction yet.</li>}
        </ol>
        <p data-testid="cure-wounds-receipt-source" className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Receipt source: production-return fields from resolveHitPointAction plus explicitly labelled adapter projection; these are not engine-emitted combat-log entries.
        </p>
      </div>

      <p data-testid="cure-wounds-eligibility-boundary" className="text-xs leading-relaxed text-amber-200/80">
        Eligibility boundary: the canonical TargetResolver rejects Undead and Constructs before payment. The rejected-target control proves the Undead branch; Construct coverage remains the same data-driven exclusion and is covered by the canonical resolver contract.
      </p>
    </div>
  );
};

export default CureWoundsScenario;
