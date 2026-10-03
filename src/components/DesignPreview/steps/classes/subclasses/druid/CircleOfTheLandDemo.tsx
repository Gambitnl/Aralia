import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This component demonstrates the canonical Druid Circle of the Land level-3 choice.
 * It exists to make the production level-2 checkpoint, exact subclass feature IDs,
 * and unsupported Land runtime boundary visible in the Classes preview.
 * Called by: subclassDemoRegistry.ts through the Classes domain shell.
 * Depends on: canonical class/subclass data, classFeaturesForLevel, performLevelUp,
 * and the production quick-character assembler.
 */

// ============================================================================
// Deterministic progression fixture
// ============================================================================
// The fixture starts at level 1 and uses the production level-up path twice. The first
// step creates a subclass-free level-2 checkpoint; the second applies Circle of the Land at 3.
const DRUID_ID = 'druid';
const CIRCLE_OF_THE_LAND_ID = 'circle_of_the_land';
const LEVEL_THREE_XP = 900;

/** Resolve Circle of the Land through both canonical subclass lookup surfaces. */
function requireCircleOfTheLand() {
  const druid = CLASSES_DATA[DRUID_ID];
  const circleOfTheLand = findSubclass(druid.id, CIRCLE_OF_THE_LAND_ID);

  // A missing canonical option must stay a visible source failure rather than become a
  // copied label or UI-only feature definition.
  if (
    !circleOfTheLand ||
    !subclassesForClass(druid.id).some(subclass => subclass.id === circleOfTheLand.id)
  ) {
    throw new Error('Canonical Druid Circle of the Land subclass is required for this demo.');
  }

  return circleOfTheLand;
}

/** Build the subclass-free level-2 checkpoint through the production level-up path. */
export function createCircleOfTheLandLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: DRUID_ID,
    raceId: 'human',
    level: 1,
    name: 'Circle of the Land Progression Tester',
    useRecommendedStats: true,
  });

  // A null result means the production disposable character fixture could not be built.
  if (!source) {
    throw new Error('Production quick character assembly failed for the Circle of the Land demo.');
  }

  // XP only makes the transition eligible; performLevelUp owns level and feature state.
  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Druid level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

/** Apply the explicit canonical Circle of the Land choice at the level-3 milestone. */
export function createCircleOfTheLandLevel3(
  level2: PlayerCharacter = createCircleOfTheLandLevel2(),
): PlayerCharacter {
  const circleOfTheLand = requireCircleOfTheLand();

  // Requiring the known checkpoint keeps repeated control clicks deterministic.
  if (level2.level !== 2) {
    throw new Error('Circle of the Land level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: circleOfTheLand.id },
  );

  // Do not render a level-3 claim until production confirms the explicit choice.
  if (level3.level !== 3 || level3.subclassId !== circleOfTheLand.id) {
    throw new Error('Canonical Druid level-3 progression did not apply Circle of the Land.');
  }

  return level3;
}

/** Read exact feature objects from the canonical progression resolver. */
export function getCircleOfTheLandFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[DRUID_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Unsupported runtime boundary
// ============================================================================
// The canonical progression record is real, but the searched production systems do
// not expose subclass-aware Land transactions. Generic spell, Wild Shape, rest, and
// combat paths are intentionally not treated as Circle of the Land proof.
export const CIRCLE_OF_THE_LAND_RUNTIME_BOUNDARY =
  "Unsupported boundary: canonical Land's Aid (lands_aid) and Circle Spells (circle_spells_land) are present, but no executable subclass-aware Land's Aid damage/healing transaction, land-choice/prepared-circle-spell transaction, Natural Recovery slot restoration, Nature's Ward resistance/poison immunity, or Nature's Sanctuary zone transaction was found. Generic Wild Shape, spell preparation, spell-slot, healing, damage, and rest paths are not subclass proof. This demo does not simulate land selection, prepared spells, free casts, slot recovery, Wild Shape spend, damage, healing, resistance, or combat results.";

// ============================================================================
// Circle of the Land demonstration surface
// ============================================================================
// The component owns only the production-derived progression checkpoint. It never
// becomes a second land-choice, spell-preparation, rest, or combat engine.
export const CircleOfTheLandDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createCircleOfTheLandLevel2());
  const features = useMemo(() => getCircleOfTheLandFeatures(character), [character]);
  const circleOfTheLand = requireCircleOfTheLand();
  const isLevel3 = character.level === 3 && character.subclassId === circleOfTheLand.id;
  const landsAid = features.find(feature => feature.id === 'lands_aid');
  const circleSpells = features.find(feature => feature.id === 'circle_spells_land');

  // Reset returns to a fresh production-derived level-2 checkpoint.
  const reset = (): void => setCharacter(createCircleOfTheLandLevel2());

  // Rebuild from that checkpoint before applying the explicit subclass choice.
  const chooseCircleOfTheLand = (): void => setCharacter(createCircleOfTheLandLevel3());

  return (
    <section
      aria-label="Circle of the Land progression demonstration"
      data-testid="circle-of-the-land-progression-demo"
      className="mt-4 rounded border border-emerald-400/40 bg-emerald-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Circle of the Land</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Druid level 2 baseline to the level 3 Circle of the Land choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Druid - Circle of the Land
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Circle of the Land progression controls">
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
          onClick={chooseCircleOfTheLand}
          className="rounded border border-emerald-300/70 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100"
        >
          Choose Circle of the Land / Level 3
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
          <dd data-testid="circle-of-the-land-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="circle-of-the-land-subclass" className="mt-1 font-semibold text-emerald-200">
            {character.subclassId ? circleOfTheLand.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="circle-of-the-land-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-emerald-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="circle-of-the-land-grant-status"
        className="mt-3 border-l-2 border-emerald-400 pl-2 text-xs leading-relaxed text-emerald-100"
      >
        {isLevel3
          ? `Canonical grants present: ${landsAid?.id} - ${landsAid?.name}; ${circleSpells?.id} - ${circleSpells?.name}.`
          : 'Canonical grants absent before the level-3 subclass choice: lands_aid and circle_spells_land.'}
      </p>

      <p
        data-testid="circle-of-the-land-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'circle_of_the_land' }); canonical feature grants are present."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; the level-3 feature grants are absent.'}
      </p>

      <p
        data-testid="circle-of-the-land-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {CIRCLE_OF_THE_LAND_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default CircleOfTheLandDemo;
