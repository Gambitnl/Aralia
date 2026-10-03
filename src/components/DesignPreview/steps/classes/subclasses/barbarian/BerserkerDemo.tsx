import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This component demonstrates the canonical Barbarian Path of the Berserker level-3
 * progression choice. It exists to prove the authored level-2 baseline and exact
 * Frenzy grant while keeping the incomplete Berserker combat lifecycle visible.
 * Called by: subclassDemoRegistry.ts through the Classes domain shell.
 * Depends on: canonical class/subclass data, classFeaturesForLevel, performLevelUp,
 * and the production quick-character assembler.
 */

// ============================================================================
// Deterministic progression fixture
// ============================================================================
// The fixture starts at level 1 and uses the production level-up path twice: first to
// create a subclass-free level-2 checkpoint, then to apply the explicit level-3 choice.
const BARBARIAN_ID = 'barbarian';
const BERSERKER_ID = 'berserker';
const LEVEL_THREE_XP = 900;

/** Resolve the authored Berserker or fail instead of copying labels into the preview. */
function requireBerserker() {
  const barbarian = CLASSES_DATA[BARBARIAN_ID];
  const berserker = findSubclass(barbarian.id, BERSERKER_ID);

  // The demo is a source-provenance check. Missing canonical data must remain an
  // explicit failure rather than being replaced with UI-only feature definitions.
  if (!berserker || !subclassesForClass(barbarian.id).some(subclass => subclass.id === berserker.id)) {
    throw new Error('Canonical Barbarian Path of the Berserker subclass is required for this demo.');
  }

  return berserker;
}

/** Build the level-2 baseline through the production level-up implementation. */
export function createBerserkerLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: BARBARIAN_ID,
    raceId: 'human',
    level: 1,
    name: 'Berserker Progression Tester',
    useRecommendedStats: true,
  });

  // The quick assembler is the disposable preview character path. A null result
  // means production could not assemble the canonical Barbarian fixture.
  if (!source) {
    throw new Error('Production quick character assembly failed for the Berserker demo.');
  }

  // XP only makes the transition eligible. performLevelUp owns level, features, and
  // the deliberate absence of a subclass before the level-3 milestone.
  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Barbarian level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

/** Apply the explicit canonical Berserker choice at the level-3 milestone. */
export function createBerserkerLevel3(level2: PlayerCharacter = createBerserkerLevel2()): PlayerCharacter {
  const berserker = requireBerserker();

  // Always apply the choice from the known checkpoint so repeated control clicks stay
  // deterministic and cannot inherit an unrelated subclass or hidden level state.
  if (level2.level !== 2) {
    throw new Error('Berserker level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: berserker.id },
  );

  // Verify the production transition before allowing the component to display its
  // level-3 claims.
  if (level3.level !== 3 || level3.subclassId !== berserker.id) {
    throw new Error('Canonical Berserker level-3 progression did not apply the chosen subclass.');
  }

  return level3;
}

/** Read exact canonical feature objects for the current character checkpoint. */
export function getBerserkerFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[BARBARIAN_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Unsupported combat boundary
// ============================================================================
// Rage activation and a Frenzy attack ability have partial production seams, but the
// complete subclass contract is not present at one authoritative combat boundary.
export const BERSERKER_COMBAT_RUNTIME_BOUNDARY =
  'Unsupported boundary: production has partial Rage activation and exposes a Frenzy bonus-action attack ability, but no complete Berserker lifecycle resolver was found that enforces while-raging eligibility and applies exhaustion when Rage ends. This demo does not simulate Rage state, bonus-action attacks, exhaustion, duration, damage, resistance, or combat outcomes.';

// ============================================================================
// Berserker demonstration surface
// ============================================================================
// The component owns only the progression checkpoint being inspected. It does not
// create a second combat engine or pretend that the partial runtime is complete.
export const BerserkerDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createBerserkerLevel2());
  const features = useMemo(() => getBerserkerFeatures(character), [character]);
  const berserker = requireBerserker();
  const isLevel3 = character.level === 3 && character.subclassId === berserker.id;

  // Reset returns to a newly production-derived level-2 checkpoint so every inspection
  // starts from the same subclass-free state.
  const reset = (): void => setCharacter(createBerserkerLevel2());

  // Rebuild from the same checkpoint before applying the explicit subclass choice.
  const chooseBerserker = (): void => setCharacter(createBerserkerLevel3());

  return (
    <section
      aria-label="Path of the Berserker progression demonstration"
      data-testid="berserker-progression-demo"
      className="mt-4 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Frenzy</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Barbarian level 2 baseline to the level 3 Path of the Berserker choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Barbarian · Path of the Berserker
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Berserker progression controls">
        <Button
          type="button"
          variant={character.level === 2 ? 'action' : 'ghost'}
          size="sm"
          aria-pressed={character.level === 2}
          onClick={reset}
          className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"
        >
          Level 2 baseline
        </Button>
        <Button
          type="button"
          variant={isLevel3 ? 'action' : 'ghost'}
          size="sm"
          aria-pressed={isLevel3}
          onClick={chooseBerserker}
          className="rounded border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
        >
          Choose Berserker / Level 3
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
          <dt className="text-slate-500">Level</dt>
          <dd data-testid="berserker-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="berserker-subclass" className="mt-1 font-semibold text-amber-200">
            {character.subclassId ? berserker.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="berserker-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-amber-200">{feature.id}</code> — {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="berserker-grant-status"
        className="mt-3 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-amber-100"
      >
        {isLevel3
          ? 'Canonical grant present: frenzy — Frenzy.'
          : 'Canonical grant absent before the level-3 subclass choice: frenzy — Frenzy.'}
      </p>

      <p
        data-testid="berserker-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 → Level 3 via performLevelUp({ subclassId: 'berserker' }); canonical feature grant is present."
          : 'Transition: Level 1 → Level 2 via performLevelUp() without a subclass choice; the level-3 feature is absent.'}
      </p>

      <p
        data-testid="berserker-combat-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {BERSERKER_COMBAT_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default BerserkerDemo;
