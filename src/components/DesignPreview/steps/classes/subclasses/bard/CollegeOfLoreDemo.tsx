import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This file demonstrates the canonical Bard College of Lore level-3 progression.
 * It exists to make the real level-2 checkpoint, subclass choice, and exact feature
 * grants visible while keeping unsupported Cutting Words and skill-choice mechanics
 * explicitly outside the preview. The Classes shell calls this through its registry,
 * and this component calls the production character and progression helpers.
 */

// ============================================================================
// Deterministic progression fixture
// ============================================================================
// Start with a level-1 production quick character and enough XP for the two
// transitions this demo needs: level 1 -> 2, then level 2 -> 3.
const BARD_ID = 'bard';
const COLLEGE_OF_LORE_ID = 'college_of_lore';
const LEVEL_THREE_XP = 900;

/** Resolve College of Lore from both canonical subclass lookup surfaces. */
function requireCollegeOfLore() {
  const bard = CLASSES_DATA[BARD_ID];
  const collegeOfLore = findSubclass(bard.id, COLLEGE_OF_LORE_ID);

  // Missing source data must fail loudly instead of becoming a copied UI-only option.
  if (!collegeOfLore || !subclassesForClass(bard.id).some(subclass => subclass.id === collegeOfLore.id)) {
    throw new Error('Canonical Bard College of Lore subclass is required for this demo.');
  }

  return collegeOfLore;
}

/** Build the subclass-free level-2 baseline through the production level-up path. */
export function createCollegeOfLoreLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: BARD_ID,
    raceId: 'human',
    level: 1,
    name: 'College of Lore Progression Tester',
    useRecommendedStats: true,
  });

  // A null result means the production disposable character fixture could not be built.
  if (!source) {
    throw new Error('Production quick character assembly failed for the College of Lore demo.');
  }

  // XP only makes the transition eligible; performLevelUp owns the level and feature state.
  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Bard level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

/** Apply the explicit canonical College of Lore choice at the level-3 milestone. */
export function createCollegeOfLoreLevel3(
  level2: PlayerCharacter = createCollegeOfLoreLevel2(),
): PlayerCharacter {
  const collegeOfLore = requireCollegeOfLore();

  // Requiring the known checkpoint makes repeated control clicks deterministic.
  if (level2.level !== 2) {
    throw new Error('College of Lore level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: collegeOfLore.id },
  );

  // Do not render a level-3 claim until the production transition confirms the choice.
  if (level3.level !== 3 || level3.subclassId !== collegeOfLore.id) {
    throw new Error('Canonical College of Lore level-3 progression did not apply the chosen subclass.');
  }

  return level3;
}

/** Read exact feature objects from the canonical progression resolver. */
export function getCollegeOfLoreFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[BARD_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Unsupported runtime boundary
// ============================================================================
// Progression data is real, but the searched runtime has no complete authoritative
// transaction for the reaction, resource, roll subtraction, or skill-choice portions.
export const COLLEGE_OF_LORE_RUNTIME_BOUNDARY =
  'Unsupported boundary: canonical progression grants Cutting Words and Bonus Proficiencies, but no complete character-combat path was found for a Bardic Inspiration resource debit, reaction trigger, deterministic attack/check/damage subtraction, or target result. No subclass-driven state path was found for choosing and granting three skills. This demo does not simulate those mechanics or outcomes.';

// ============================================================================
// College of Lore demonstration surface
// ============================================================================
// The component owns only the inspection checkpoint. It never becomes an alternate
// combat engine or invents a reaction, resource, roll, proficiency, or combat result.
export const CollegeOfLoreDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createCollegeOfLoreLevel2());
  const features = useMemo(() => getCollegeOfLoreFeatures(character), [character]);
  const collegeOfLore = requireCollegeOfLore();
  const isLevel3 = character.level === 3 && character.subclassId === collegeOfLore.id;
  const cuttingWords = features.find(feature => feature.id === 'cutting_words');
  const bonusProficiencies = features.find(feature => feature.id === 'bonus_proficiencies_lore');

  // Reset returns to a fresh production-derived level-2 checkpoint.
  const reset = (): void => setCharacter(createCollegeOfLoreLevel2());

  // Rebuild from that checkpoint before applying the explicit subclass choice.
  const chooseCollegeOfLore = (): void => setCharacter(createCollegeOfLoreLevel3());

  return (
    <section
      aria-label="College of Lore progression demonstration"
      data-testid="college-of-lore-progression-demo"
      className="mt-4 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">College of Lore</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Bard level 2 baseline to the level 3 College of Lore choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Bard · College of Lore
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="College of Lore progression controls">
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
          onClick={chooseCollegeOfLore}
          className="rounded border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
        >
          Choose College of Lore / Level 3
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
          <dd data-testid="college-of-lore-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="college-of-lore-subclass" className="mt-1 font-semibold text-amber-200">
            {character.subclassId ? collegeOfLore.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="college-of-lore-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-amber-200">{feature.id}</code> — {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="college-of-lore-grant-status"
        className="mt-3 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-amber-100"
      >
        {isLevel3
          ? `Canonical grants present: ${cuttingWords?.id} — ${cuttingWords?.name}; ${bonusProficiencies?.id} — ${bonusProficiencies?.name}.`
          : 'Canonical grants absent before the level-3 subclass choice: cutting_words and bonus_proficiencies_lore.'}
      </p>

      <p
        data-testid="college-of-lore-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 → Level 3 via performLevelUp({ subclassId: 'college_of_lore' }); canonical feature grants are present."
          : 'Transition: Level 1 → Level 2 via performLevelUp() without a subclass choice; the level-3 feature grants are absent.'}
      </p>

      <p
        data-testid="college-of-lore-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {COLLEGE_OF_LORE_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default CollegeOfLoreDemo;
