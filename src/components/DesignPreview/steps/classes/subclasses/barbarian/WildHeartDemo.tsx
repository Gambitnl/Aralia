// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 23:48:18
 * Dependents: components/DesignPreview/steps/classes/subclassDemoRegistry.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { applyImmediateAbilityTurnEffects } from '../../../../../../hooks/combat/useActionExecutor';
import { ResistanceCalculator } from '../../../../../../utils/combat/resistanceUtils';
import { createPlayerCombatCharacter } from '../../../../../../utils/combat/combatUtils';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { CombatCharacter, CombatLogEntry } from '../../../../../../types/combat';
import ClassBattlefieldDemo from '../../ClassBattlefieldDemo';

/**
 * This component demonstrates the canonical Barbarian Path of the Wild Heart at
 * level 3 by running the production Bear Spirit Rage transaction. It exists so the
 * Classes preview can show the actual subclass feature, ability tag, status effect,
 * resistance calculation, and production log together without inventing a second
 * combat rule. Called by: subclassDemoRegistry.ts through the Classes domain shell.
 * Depends on: canonical class/subclass data, the quick-character assembler, the
 * player-to-combat factory, the immediate ability executor, and ResistanceCalculator.
 */

// ============================================================================
// Canonical Wild Heart fixture
// ============================================================================
// The fixed damage inputs make the returned production resistance results easy to
// inspect. The component never applies the resistance itself.
const BARBARIAN_ID = 'barbarian';
const WILD_HEART_ID = 'wild_heart';
const FIRE_DAMAGE = 10;
const PSYCHIC_DAMAGE = 10;

type WildHeartRuntime = {
  character: CombatCharacter;
  logs: CombatLogEntry[];
};

/** Resolve Wild Heart and its authored level-3 feature before assembling the fixture. */
function requireWildHeart() {
  const barbarian = CLASSES_DATA[BARBARIAN_ID];
  const wildHeart = findSubclass(barbarian.id, WILD_HEART_ID);
  const feature = wildHeart?.features.find(candidate => candidate.id === 'rage_of_the_wilds');

  // Missing source data is a contract failure. The preview must not replace it with
  // a UI-only subclass label or feature description.
  if (
    !wildHeart ||
    !subclassesForClass(barbarian.id).some(subclass => subclass.id === wildHeart.id) ||
    !feature
  ) {
    throw new Error('Canonical Barbarian Path of the Wild Heart subclass is required for this demo.');
  }

  return { barbarian, wildHeart, feature };
}

/** Assemble the exact level-3 player and cross the production combat boundary. */
export function createWildHeartCombatCharacter(): CombatCharacter {
  const { barbarian, wildHeart } = requireWildHeart();
  const player = createQuickCharacter({
    classId: barbarian.id,
    raceId: 'human',
    level: 3,
    name: 'Wild Heart Rage Tester',
    useRecommendedStats: true,
  });

  // A null quick-character result means the production fixture could not be built;
  // failing here prevents a fabricated combat character from reaching the preview.
  if (!player) {
    throw new Error('Production quick character assembly failed for the Wild Heart demo.');
  }

  // The subclass id is canonical source data attached before the real combat factory
  // derives the level-3 Rage ability and its Bear Spirit tag.
  return createPlayerCombatCharacter({
    ...player,
    class: barbarian,
    subclassId: wildHeart.id,
  });
}

/** Start from a newly assembled character with no Rage status or production log. */
function createBaselineRuntime(): WildHeartRuntime {
  return { character: createWildHeartCombatCharacter(), logs: [] };
}

/** Execute the exact production Rage ability and preserve only its returned facts. */
function activateBearRage(runtime: WildHeartRuntime): WildHeartRuntime {
  const rage = runtime.character.abilities.find(ability => ability.id === 'rage');

  // The factory must provide this ability and tag; silently substituting an ability
  // would hide a production regression and make the preview's claim untrustworthy.
  if (!rage || !rage.tags?.includes('wild_heart_bear')) {
    throw new Error('Production Wild Heart Rage ability with the bear tag is required.');
  }

  const result = applyImmediateAbilityTurnEffects(runtime.character, rage, 1);
  return { character: result.character, logs: result.followUpLogs };
}

// ============================================================================
// Wild Heart demonstration surface
// ============================================================================
// The rendered surface exposes only the supported Bear Spirit transaction. Eagle and
// Wolf controls are intentionally absent because the current runtime provides only
// the bear tag and resistance path.
export const WildHeartDemo: React.FC = () => {
  const canonical = useMemo(() => requireWildHeart(), []);
  const [runtime, setRuntime] = useState<WildHeartRuntime>(() => createBaselineRuntime());
  const rage = runtime.character.abilities.find(ability => ability.id === 'rage');
  const ragingStatus = runtime.character.statusEffects.find(status => status.id === 'raging');

  // Missing runtime ability data is surfaced rather than replaced with a copied tag.
  if (!rage) {
    throw new Error('Production Wild Heart Rage ability is required for this demo.');
  }

  // These are calculated from the returned combat character through the production
  // calculator on every render, so the UI cannot become an alternate resistance rule.
  const fireResult = ResistanceCalculator.applyResistances(FIRE_DAMAGE, 'fire', runtime.character);
  const psychicResult = ResistanceCalculator.applyResistances(PSYCHIC_DAMAGE, 'psychic', runtime.character);
  const resistanceList = ragingStatus?.modifiers?.resistance ?? [];

  // Both Baseline and Reset rebuild the same production-derived state; this keeps
  // repeated inspection deterministic after the native Rage transaction runs.
  const reset = (): void => setRuntime(createBaselineRuntime());

  return (
    <section
      aria-label="Path of the Wild Heart Bear Spirit Rage demonstration"
      data-testid="wild-heart-rage-demo"
      className="mt-4 rounded border border-emerald-400/40 bg-emerald-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
            Production mechanic demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Rage of the Wilds</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Level 3 Barbarian Bear Spirit Rage through the native combat transaction.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Barbarian · Path of the Wild Heart · Level 3
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Wild Heart Rage controls">
        <Button
          type="button"
          variant={!ragingStatus ? 'action' : 'ghost'}
          size="sm"
          aria-pressed={!ragingStatus}
          onClick={reset}
          className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"
        >
          Baseline (not raging)
        </Button>
        <Button
          type="button"
          variant={ragingStatus ? 'action' : 'ghost'}
          size="sm"
          aria-pressed={Boolean(ragingStatus)}
          onClick={() => setRuntime(previous => activateBearRage(previous))}
          className="rounded border border-emerald-300/70 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100"
        >
          Activate Bear Rage
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"
        >
          Reset
        </Button>
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Canonical subclass feature</dt>
          <dd data-testid="wild-heart-feature" className="mt-1 font-semibold text-emerald-200">
            <code>{canonical.feature.id}</code> — {canonical.feature.name}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Production Rage tag</dt>
          <dd data-testid="wild-heart-rage-tag" className="mt-1 font-mono font-semibold text-amber-200">
            {rage.tags?.join(', ') || 'None'}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Raging status</dt>
          <dd data-testid="wild-heart-raging-status" className="mt-1 font-semibold text-slate-100">
            {ragingStatus?.name ?? 'Not raging'}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Returned resistance list</dt>
          <dd data-testid="wild-heart-resistance-list" className="mt-1 font-mono text-slate-200">
            {resistanceList.length > 0 ? resistanceList.join(', ') : 'None'}
          </dd>
        </div>
      </dl>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Fire damage input</dt>
          <dd data-testid="wild-heart-fire-result" className="mt-1 font-mono text-lg font-bold text-orange-200">
            {FIRE_DAMAGE} → {fireResult}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Psychic damage input</dt>
          <dd data-testid="wild-heart-psychic-result" className="mt-1 font-mono text-lg font-bold text-fuchsia-200">
            {PSYCHIC_DAMAGE} → {psychicResult}
          </dd>
        </div>
      </dl>

      <p
        data-testid="wild-heart-production-log"
        className="mt-3 border-l-2 border-emerald-400 pl-2 text-xs leading-relaxed text-emerald-100"
      >
        {runtime.logs.length > 0
          ? runtime.logs.map(log => log.message).join(' ')
          : 'No production Rage event yet.'}
      </p>

      <p
        data-testid="wild-heart-scope"
        className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs leading-relaxed text-slate-300"
      >
        Current runtime scope: the Bear Spirit tag and resistance path only; no Eagle or Wolf variant controls are exposed.
      </p>

      {/* The map bridge receives this same native character and therefore shows the
          status badge in either canonical renderer without owning Rage state. */}
      <ClassBattlefieldDemo
        character={runtime.character}
        onReset={reset}
      />
    </section>
  );
};

export default WildHeartDemo;
