// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 12:21:15
 * Dependents: components/DesignPreview/steps/spells/spellRegistry.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useState } from 'react';
import shieldData from '@/data/spells/level-1/shield.json';
import type { CombatCharacter, CombatState, TurnState, Ability } from '@/types/combat';
import type { GameState } from '@/types';
import type { Spell } from '@/types/spells';
import { AbilityCommandFactory } from '@/commands/factory/AbilityCommandFactory';
import { createMockCombatCharacter, createMockCombatState } from '@/utils/core';
import type { SpellSlots } from '@/types/character';
import type { SpellScenarioComponentProps } from './types';

/**
 * This file renders the executable Shield starter scenario for the Tactical
 * Sandbox Spells domain.
 *
 * It creates a fixed attack that initially hits, sends that attack through
 * AbilityCommandFactory, and displays the returned reaction, AC, hit, resource,
 * active-effect, and HP facts. The preview never calculates a second outcome
 * locally: Shield cancellation and payment come from the production command
 * path, while the Magic Missile row is called out as an unproven seam because
 * the current factory arbitration only offers `when_hit` defensive effects.
 *
 * Called by: SpellsDomainShell.tsx through spellRegistry.ts.
 * Depends on: canonical Shield JSON, AbilityCommandFactory, DefensiveCommand,
 * DamageCommand, and the shared combat fixture factories.
 */

// ============================================================================
// Scenario Constants And Types
// ============================================================================
// These values make the initial hit deterministic: d20 12 plus modifier 0
// equals the defender's base AC 12, so the same attack can be accepted or
// cancelled by the reaction arbiter.
// ============================================================================

const SHIELD = shieldData as Spell;
const ATTACKER_ID = 'shield-sandbox-attacker';
const DEFENDER_ID = 'shield-sandbox-defender';
const BASE_AC = 12;
const SHIELD_AC_BONUS = 5;
const ATTACK_D20_FACE = 12;
const ATTACK_MODIFIER = 0;
const BASELINE_HP = 20;
const BASELINE_LEVEL_ONE_SLOTS = 1;

type ShieldControl = 'choose-shield' | 'decline-shield';

interface ShieldFixture {
  attacker: CombatCharacter;
  defender: CombatCharacter;
  attack: Ability;
  state: CombatState;
}

export interface ShieldScenarioResult {
  control: ShieldControl;
  rawRoll: number;
  modifier: number;
  attackTotal: number;
  initialAC: number;
  finalAC: number;
  initialHit: boolean;
  finalHit: boolean;
  targetHpBefore: number;
  targetHpAfter: number;
  reactionBefore: boolean;
  reactionAfter: boolean;
  slotBefore: number;
  slotAfter: number;
  activeEffectDuration: string;
  receipt: string[];
  magicMissileBoundary: string;
}

// ============================================================================
// Deterministic Resource And Dice Sources
// ============================================================================
// The factory accepts an attack-roll source, so this scenario pins the d20
// without replacing or spying on process-wide Math.random. The full slot map
// is supplied because consumeActionCost reads the requested level directly.
// ============================================================================

function createLevelOneSlots(): SpellSlots {
  // Every level has a real resource vial so the fixture matches the combat
  // character contract even though Shield only consumes a level-one slot.
  return {
    level_1: { current: BASELINE_LEVEL_ONE_SLOTS, max: BASELINE_LEVEL_ONE_SLOTS },
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

function fixedFace(face: number, sides: number): () => number {
  // Returning the midpoint of one die face gives rollD20 the requested face
  // while leaving ordinary combat randomness untouched.
  return () => (face - 0.5) / sides;
}

// ============================================================================
// Deterministic Combat Fixture
// ============================================================================
// The fixture carries the actual Shield spell on the defender's ability list.
// That is what makes the factory discover the reaction through its normal
// affordability and `when_hit` filtering instead of through preview metadata.
// ============================================================================

function createShieldFixture(): ShieldFixture {
  // The attacker uses an explicit +0 attack bonus so the roll facts remain
  // visible and independent of proficiency or ability-score inference.
  const attacker = createMockCombatCharacter({
    id: ATTACKER_ID,
    name: 'Shield Test Attacker',
    team: 'enemy',
    level: 1,
  });

  // The defender has exactly one reaction and one level-one slot, matching the
  // resources the production arbiter is expected to consume on acceptance.
  const defender = createMockCombatCharacter({
    id: DEFENDER_ID,
    name: 'Shield Test Defender',
    team: 'player',
    armorClass: BASE_AC,
    currentHP: BASELINE_HP,
    maxHP: BASELINE_HP,
    abilities: [{ id: 'shield-ability', type: 'spell', spell: SHIELD }],
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      legendary: { used: 0, total: 0 },
      movement: { used: 0, total: 30 },
      freeActions: 1,
    },
    spellSlots: createLevelOneSlots(),
  });

  // The damage row is intentionally small so the decline branch visibly
  // proves the same accepted production attack reaches DamageCommand.
  const attack: Ability = {
    id: 'shield-sandbox-attack',
    name: 'Borderline Strike',
    description: 'A deterministic attack that initially hits at base AC.',
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: 1,
    attackBonus: ATTACK_MODIFIER,
    effects: [{ type: 'damage', value: 4, damageType: 'slashing' }],
  };

  // The turn state is real combat state needed by DefensiveCommand when it
  // records the effect's start turn and duration.
  const turnState: TurnState = {
    currentTurn: 1,
    turnOrder: [ATTACKER_ID, DEFENDER_ID],
    currentCharacterId: ATTACKER_ID,
    phase: 'action',
    actionsThisTurn: [],
  };

  return {
    attacker,
    defender,
    attack,
    state: createMockCombatState({
      characters: [attacker, defender],
      turnState,
      combatLog: [],
    }),
  };
}

// ============================================================================
// Production Reaction Transaction
// ============================================================================
// This adapter selects only the user-facing reaction answer and forwards the
// attack to AbilityCommandFactory. The returned CombatState and production
// attack log remain the sole source of final hit, AC, resource, effect, and HP
// facts displayed below.
// ============================================================================

export async function executeShieldScenario(control: ShieldControl): Promise<ShieldScenarioResult> {
  // Each control starts from the same baseline, so Reset and side-by-side
  // comparisons never depend on the previous button press.
  const fixture = createShieldFixture();
  const requestReaction = async (): Promise<string | null> =>
    control === 'choose-shield' ? SHIELD.id : null;

  // The public factory method accepts the deterministic attack-roll source;
  // this keeps the canonical d20 path intact without touching Math.random.
  const commands = AbilityCommandFactory.createCommands(
    fixture.attack,
    fixture.attacker,
    [fixture.defender],
    {} as GameState,
    undefined,
    requestReaction,
    { attackRollRng: fixedFace(ATTACK_D20_FACE, 20) },
  );

  // The returned state is the production transaction. No local AC comparison
  // is used to decide whether damage landed or whether the reaction was paid.
  const returnedState = await commands[0].execute(fixture.state);
  const returnedDefender = returnedState.characters.find(character => character.id === DEFENDER_ID) ?? fixture.defender;
  const finalAttackLog = [...returnedState.combatLog]
    .reverse()
    .find(entry => entry.characterId === ATTACKER_ID && entry.data?.attackTotal !== undefined);
  const finalHit = finalAttackLog?.data?.isHit ?? true;
  const finalAttackTotal = finalAttackLog?.data?.attackTotal ?? ATTACK_D20_FACE + ATTACK_MODIFIER;
  const initialHit = ATTACK_D20_FACE + ATTACK_MODIFIER >= BASE_AC;
  const activeShieldEffect = returnedDefender.activeEffects?.find(effect =>
    effect.spellId === SHIELD.id && effect.mechanics?.acBonus === SHIELD_AC_BONUS,
  );
  const durationValue = activeShieldEffect?.duration?.value;
  const activeEffectDuration = activeShieldEffect
    ? `until the start of the next turn (production effect duration: ${durationValue ?? 1} round)`
    : 'not applied';
  const reactionAfter = returnedDefender.actionEconomy.reaction.used;
  const slotAfter = returnedDefender.spellSlots?.level_1.current ?? 0;
  const targetHpAfter = returnedDefender.currentHP;
  const magicMissileBoundary =
    'Canonical Shield data declares force immunity against Magic Missile, but AbilityCommandFactory arbitration currently accepts only when_hit defensive rows; this starter does not claim Magic Missile execution.';

  // These ordered lines label each fact by its returned production source.
  // They are a readable receipt projection, not fabricated combat-log entries.
  const receipt = [
    `AbilityCommandFactory: ${fixture.attacker.name} attacks ${fixture.defender.name}.`,
    `AbilityCommandFactory (initial): raw d20 ${ATTACK_D20_FACE} + modifier ${ATTACK_MODIFIER} = ${ATTACK_D20_FACE + ATTACK_MODIFIER} vs base AC ${BASE_AC} -> ${initialHit ? 'HIT' : 'MISS'}.`,
    `requestReaction (scenario choice): ${control === 'choose-shield' ? 'Shield selected' : 'Shield declined'}.`,
    `DefensiveCommand / AbilityCommandFactory (returned state): AC ${fixture.defender.armorClass ?? BASE_AC} -> ${returnedDefender.armorClass ?? BASE_AC}; final AC ${finalAttackLog?.data?.targetArmorClass ?? returnedDefender.armorClass ?? BASE_AC}.`,
    `AbilityCommandFactory combat log (returned): final attack total ${finalAttackTotal} -> ${finalHit ? 'HIT' : 'MISS'}.`,
    `Reaction economy (returned state): used ${fixture.defender.actionEconomy.reaction.used} -> ${reactionAfter}.`,
    `Level-1 slot (returned state): ${BASELINE_LEVEL_ONE_SLOTS} -> ${slotAfter}.`,
    `HP (returned state): ${fixture.defender.currentHP} -> ${targetHpAfter}; ${finalHit ? 'DamageCommand applied the attack damage.' : 'Damage is outside this arbitration receipt because the hit was cancelled before damage.'}`,
    `Defensive effect (returned state): ${activeEffectDuration}.`,
  ];

  return {
    control,
    rawRoll: finalAttackLog?.data?.attackRoll ?? ATTACK_D20_FACE,
    modifier: finalAttackLog?.data?.attackModifier ?? ATTACK_MODIFIER,
    attackTotal: finalAttackTotal,
    initialAC: BASE_AC,
    finalAC: finalAttackLog?.data?.targetArmorClass ?? returnedDefender.armorClass ?? BASE_AC,
    initialHit,
    finalHit,
    targetHpBefore: fixture.defender.currentHP,
    targetHpAfter,
    reactionBefore: fixture.defender.actionEconomy.reaction.used,
    reactionAfter,
    slotBefore: BASELINE_LEVEL_ONE_SLOTS,
    slotAfter,
    activeEffectDuration,
    receipt,
    magicMissileBoundary,
  };
}

// ============================================================================
// Rendered Scenario Surface
// ============================================================================
// The controls expose the two reaction outcomes plus an exact Reset. Every
// displayed result is either a fixture baseline or a field returned by the
// production command transaction above.
// ============================================================================

export const ShieldScenario: React.FC<SpellScenarioComponentProps> = ({ spell }) => {
  // Memoizing the fixture provides stable baseline actor identity and resource
  // values while each control still receives a fresh transaction fixture.
  const baseline = useMemo(createShieldFixture, []);
  const [result, setResult] = useState<ShieldScenarioResult | null>(null);
  const [runningControl, setRunningControl] = useState<ShieldControl | null>(null);

  // The async handler waits for the same command promise used by the runtime
  // path before publishing the returned state to the preview.
  const runControl = async (control: ShieldControl) => {
    setRunningControl(control);
    try {
      setResult(await executeShieldScenario(control));
    } finally {
      setRunningControl(null);
    }
  };

  // Reset clears only the displayed transaction; the next control recreates
  // the exact baseline rather than reversing a prior state mutation.
  const reset = () => {
    setResult(null);
    setRunningControl(null);
  };

  const target = result ? result : null;
  const displayedAC = target?.finalAC ?? baseline.defender.armorClass ?? BASE_AC;

  return (
    <div data-testid="shield-scenario" className="space-y-4">
      <div className="rounded-lg border border-violet-400/35 bg-violet-950/25 p-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">Canonical Shield scenario</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          {spell.name} runs a deterministic initial hit through the production reaction arbitration and defensive command path.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3" data-testid="shield-identities">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Actors and AC</p>
          <p className="mt-2 text-sm text-slate-200">Attacker: <span className="font-bold">{baseline.attacker.name}</span></p>
          <p className="text-sm text-slate-200">Defender: <span className="font-bold">{baseline.defender.name}</span></p>
          <p className="mt-2 text-sm text-slate-100">Base AC: <span className="font-bold">{BASE_AC}</span></p>
          <p data-testid="shield-ac" className="text-sm text-slate-100">Shield AC: <span className="font-bold">{result ? `${displayedAC} (+${SHIELD_AC_BONUS})` : 'not applied'}</span></p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3" data-testid="shield-outcome">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Returned arbitration outcome</p>
          <p data-testid="shield-roll" className="mt-2 text-sm text-slate-200">Raw roll / modifier / total: <span className="font-bold">{result ? `${result.rawRoll} / +${result.modifier} / ${result.attackTotal}` : 'not cast'}</span></p>
          <p data-testid="shield-hit-result" className="text-sm text-slate-200">Initial hit: <span className="font-bold">{result ? (result.initialHit ? 'HIT' : 'MISS') : 'not cast'}</span> · Final hit: <span className="font-bold">{result ? (result.finalHit ? 'HIT' : 'MISS') : 'not cast'}</span></p>
          <p data-testid="shield-payment" className="mt-2 text-xs text-emerald-300">Reaction: {result ? `${result.reactionBefore} -> ${result.reactionAfter}` : 'false -> not cast'} · level-1 slot: {result ? `${result.slotBefore} -> ${result.slotAfter}` : `${BASELINE_LEVEL_ONE_SLOTS} -> not cast`}</p>
          <p data-testid="shield-hp" className="text-xs text-slate-300">Target HP: {result ? `${result.targetHpBefore} -> ${result.targetHpAfter}` : `${BASELINE_HP} -> not cast`}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Shield deterministic controls">
        <button
          type="button"
          onClick={() => void runControl('choose-shield')}
          disabled={runningControl !== null}
          className="rounded-lg border border-violet-400/50 bg-violet-950/50 px-3 py-2 text-xs font-bold text-violet-100 disabled:opacity-50"
        >
          {runningControl === 'choose-shield' ? 'Resolving Shield…' : 'Choose Shield: cancel the hit'}
        </button>
        <button
          type="button"
          onClick={() => void runControl('decline-shield')}
          disabled={runningControl !== null}
          className="rounded-lg border border-rose-400/50 bg-rose-950/50 px-3 py-2 text-xs font-bold text-rose-100 disabled:opacity-50"
        >
          {runningControl === 'decline-shield' ? 'Resolving decline…' : 'Decline Shield: preserve the hit'}
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
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Ordered production receipt projection</p>
        <ol aria-label="Shield transaction receipt" className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-300">
          {result?.receipt.map(entry => <li key={entry}>{entry}</li>) ?? <li>No canonical transaction yet.</li>}
        </ol>
        <p data-testid="shield-receipt-source" className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Receipt source: returned CombatState and production combat log fields from AbilityCommandFactory; the ordered lines are an adapter projection, not fabricated engine log entries.
        </p>
      </div>

      <p data-testid="shield-effect-duration" className="text-xs leading-relaxed text-emerald-200/80">Defensive status/effect: {result?.activeEffectDuration ?? 'not applied; choose Shield to execute DefensiveCommand.'}</p>
      <p data-testid="shield-magic-missile-boundary" className="text-xs leading-relaxed text-amber-200/80">Magic Missile boundary: {result?.magicMissileBoundary ?? 'Canonical data declares force immunity, but this when-hit arbitration starter does not claim Magic Missile execution.'}</p>
    </div>
  );
};

export default ShieldScenario;
