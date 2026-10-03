import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This file demonstrates the canonical Bard College of Valor level-3 progression.
 * It exists to make the real level-2 checkpoint, explicit subclass choice, and exact
 * feature grants visible while keeping unsupported combat and proficiency mechanics
 * outside the preview. The Classes registry calls this component, and this component
 * calls the production character and progression helpers rather than copying data.
 */

// ============================================================================
// Deterministic progression fixture
// ============================================================================
// This fixture has enough experience for the two transitions shown by the controls.
const BARD_ID = 'bard';
const COLLEGE_OF_VALOR_ID = 'college_of_valor';
const LEVEL_THREE_XP = 900;

/** Resolve College of Valor through both canonical subclass lookup surfaces. */
function requireCollegeOfValor() {
  const bard = CLASSES_DATA[BARD_ID];
  const collegeOfValor = findSubclass(bard.id, COLLEGE_OF_VALOR_ID);

  // A missing canonical option must fail loudly instead of becoming a copied UI choice.
  if (!collegeOfValor || !subclassesForClass(bard.id).some(subclass => subclass.id === collegeOfValor.id)) {
    throw new Error('Canonical Bard College of Valor subclass is required for this demo.');
  }

  return collegeOfValor;
}

/** Build the subclass-free level-2 checkpoint through the production level-up path. */
export function createCollegeOfValorLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: BARD_ID,
    raceId: 'human',
    level: 1,
    name: 'College of Valor Progression Tester',
    useRecommendedStats: true,
  });

  // A null result means the production disposable character fixture could not be built.
  if (!source) {
    throw new Error('Production quick character assembly failed for the College of Valor demo.');
  }

  // XP only makes the transition eligible; performLevelUp owns level and feature state.
  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Bard level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

/** Apply the explicit canonical College of Valor choice at the level-3 milestone. */
export function createCollegeOfValorLevel3(
  level2: PlayerCharacter = createCollegeOfValorLevel2(),
): PlayerCharacter {
  const collegeOfValor = requireCollegeOfValor();

  // Requiring the known checkpoint keeps repeated control clicks deterministic.
  if (level2.level !== 2) {
    throw new Error('College of Valor level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: collegeOfValor.id },
  );

  // Do not render a level-3 claim until production confirms the explicit choice.
  if (level3.level !== 3 || level3.subclassId !== collegeOfValor.id) {
    throw new Error('Canonical College of Valor level-3 progression did not apply the chosen subclass.');
  }

  return level3;
}

/** Read exact feature objects from the canonical progression resolver. */
export function getCollegeOfValorFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[BARD_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Unsupported runtime boundary
// ============================================================================
// The source feature names are real, but the searched production systems do not yet
// expose the Combat Inspiration spend or subclass proficiency application needed for a
// truthful combat/equipment demonstration. Generic Bardic Inspiration is intentionally
// not treated as evidence for the different Combat Inspiration feature.
export const COLLEGE_OF_VALOR_RUNTIME_BOUNDARY =
  'Unsupported boundary: canonical progression grants Combat Inspiration and Martial Training (valor_proficiencies), but the searched production runtime exposes only generic Bardic Inspiration and has no executable Combat Inspiration resource spend that applies a damage or AC boost. performLevelUp and class feature projection leave the Bard base Light armor and Simple weapons proficiencies unchanged; no subclass-owned application path for medium armor, shields, or martial weapons was found. This demo does not simulate either transaction or equipment eligibility.';

// ============================================================================
// College of Valor demonstration surface
// ============================================================================
// The component owns only the inspection checkpoint. It never becomes an alternate
// combat engine or invents resource, roll, proficiency, equipment, or result state.
export const CollegeOfValorDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createCollegeOfValorLevel2());
  const features = useMemo(() => getCollegeOfValorFeatures(character), [character]);
  const collegeOfValor = requireCollegeOfValor();
  const isLevel3 = character.level === 3 && character.subclassId === collegeOfValor.id;
  const combatInspiration = features.find(feature => feature.id === 'combat_inspiration');
  const valorProficiencies = features.find(feature => feature.id === 'valor_proficiencies');

  // Reset returns to a fresh production-derived level-2 checkpoint.
  const reset = (): void => setCharacter(createCollegeOfValorLevel2());

  // Rebuild from that checkpoint before applying the explicit subclass choice.
  const chooseCollegeOfValor = (): void => setCharacter(createCollegeOfValorLevel3());

  return (
    <section
      aria-label="College of Valor progression demonstration"
      data-testid="college-of-valor-progression-demo"
      className="mt-4 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">College of Valor</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Bard level 2 baseline to the level 3 College of Valor choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Bard · College of Valor
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="College of Valor progression controls">
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
          onClick={chooseCollegeOfValor}
          className="rounded border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
        >
          Choose College of Valor / Level 3
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
          <dd data-testid="college-of-valor-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="college-of-valor-subclass" className="mt-1 font-semibold text-amber-200">
            {character.subclassId ? collegeOfValor.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="college-of-valor-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-amber-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="college-of-valor-grant-status"
        className="mt-3 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-amber-100"
      >
        {isLevel3
          ? `Canonical grants present: ${combatInspiration?.id} - ${combatInspiration?.name}; ${valorProficiencies?.id} - ${valorProficiencies?.name}.`
          : 'Canonical grants absent before the level-3 subclass choice: combat_inspiration and valor_proficiencies.'}
      </p>

      <p
        data-testid="college-of-valor-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'college_of_valor' }); canonical feature grants are present."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; the level-3 feature grants are absent.'}
      </p>

      <p
        data-testid="college-of-valor-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {COLLEGE_OF_VALOR_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default CollegeOfValorDemo;
