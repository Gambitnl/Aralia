import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { findSubclass } from '../../../../../../data/classes/subclasses';
import { createPlayerCombatCharacter, resolveAttack } from '../../../../../../utils/combat/combatUtils';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';

/**
 * This component demonstrates the Fighter Champion's Improved Critical rule with a
 * fixed, visible d20 transaction. It exists so the Classes domain can prove the
 * canonical subclass-to-combat seam before Rules mounts the domain in 2D or 3D.
 * Called by: subclassDemoRegistry.ts through ClassesDomainShell.tsx.
 * Depends on: canonical class/subclass data, the quick character assembler, and the
 * production persistent-player-to-combat and attack-resolution helpers.
 */

// ============================================================================
// Deterministic Combat Fixture
// ============================================================================
// The controls intentionally cover only the two rolls needed to see the boundary:
// 18 is below a Champion's derived threshold, while 19 exercises the critical path.
const DEFAULT_ROLL = 18;
const ATTACK_MODIFIER = 0;
const TARGET_ARMOR_CLASS = 10;

/**
 * Build the exact level-three Champion used by the rendered demonstration.
 * The subclass id comes from the canonical lookup, while the combat conversion and
 * critical threshold remain entirely owned by production combat code.
 */
export function createChampionCombatCharacter() {
  const fighter = CLASSES_DATA.fighter;
  const champion = findSubclass(fighter.id, 'champion');

  // A missing canonical entry is a data-contract failure, not a reason to show a fake
  // threshold. Failing here keeps the preview honest until the source data is repaired.
  if (!champion) {
    throw new Error('Canonical Fighter Champion subclass is required for this demo.');
  }

  // Use the production sandbox assembler so ability scores, HP, speed, class levels,
  // and other player fields have the same shape as a real combat preview character.
  const player = createQuickCharacter({
    classId: fighter.id,
    raceId: 'human',
    level: 3,
    name: 'Champion Critical Tester',
    useRecommendedStats: true,
  });

  // The assembler validates canonical class and race ids; this guard prevents a silent
  // fallback from weakening the proof if that production helper changes its contract.
  if (!player) {
    throw new Error('Production quick character assembly failed for the Champion demo.');
  }

  // Attach the canonical level-three subclass choice before crossing the real combat
  // boundary. No Improved Critical threshold is calculated in this component.
  return createPlayerCombatCharacter({
    ...player,
    class: fighter,
    subclassId: champion.id,
  });
}

// ============================================================================
// Visible Result Copy
// ============================================================================
// Keep the event line concise so a reviewer can read the input and production outcome
// together without inferring hidden state from styling or a browser console.
function getOutcomeLabel(result: ReturnType<typeof resolveAttack>): string {
  if (result.isCritical) {
    return 'Critical hit';
  }

  return result.isHit ? 'Hit (not critical)' : 'Miss';
}

// ============================================================================
// Champion Demonstration Surface
// ============================================================================
// The component owns only the selected fixed roll. The derived threshold and outcome
// are recomputed from the combat character and production resolver on every selection.
export const ChampionDemo: React.FC = () => {
  const championCombatCharacter = useMemo(() => createChampionCombatCharacter(), []);
  const [selectedRoll, setSelectedRoll] = useState(DEFAULT_ROLL);
  const critThreshold = championCombatCharacter.critThreshold;

  // The production conversion must supply this field for every combat character. A
  // missing value is surfaced as an error rather than replaced with UI-only rules text.
  if (critThreshold === undefined) {
    throw new Error('Champion combat conversion did not derive a critical threshold.');
  }

  // Resolve the fixed roll through the same attack resolver used by combat actions.
  const result = resolveAttack(
    selectedRoll,
    ATTACK_MODIFIER,
    TARGET_ARMOR_CLASS,
    critThreshold,
  );
  const outcomeLabel = getOutcomeLabel(result);

  // Reset restores the same baseline as the first render, making repeated inspection
  // deterministic after either tester control has been used.
  const reset = (): void => setSelectedRoll(DEFAULT_ROLL);

  return (
    <section
      aria-label="Champion Improved Critical demonstration"
      data-testid="champion-improved-critical-demo"
      className="mt-4 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Production mechanic demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Improved Critical</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Level 3 Champion attack resolution with a fixed d20 input.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Fighter · Champion · Level 3
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Champion roll controls">
        {[18, 19].map((roll) => (
          <Button
            key={roll}
            type="button"
            variant={selectedRoll === roll ? 'action' : 'ghost'}
            size="sm"
            aria-pressed={selectedRoll === roll}
            onClick={() => setSelectedRoll(roll)}
            className={`rounded border px-3 py-2 text-xs font-semibold transition-colors ${
              selectedRoll === roll
                ? 'border-amber-300 bg-amber-500/20 text-amber-100'
                : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-400'
            }`}
          >
            Roll {roll}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-400"
        >
          Reset
        </Button>
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Raw d20 roll</dt>
          <dd data-testid="champion-raw-roll" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {selectedRoll}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Derived critical threshold</dt>
          <dd data-testid="champion-crit-threshold" className="mt-1 font-mono text-lg font-bold text-amber-200">
            {critThreshold}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Resolved result</dt>
          <dd data-testid="champion-result" className="mt-1 text-lg font-bold text-emerald-200">
            {outcomeLabel}
          </dd>
        </div>
      </dl>

      <p
        data-testid="champion-event-log"
        className="mt-3 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-amber-100"
      >
        Event: d20 {selectedRoll} → {outcomeLabel.toLowerCase()} (critical threshold {critThreshold}).
      </p>
    </section>
  );
};

export default ChampionDemo;
