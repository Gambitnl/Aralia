import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This component demonstrates the canonical Rogue Thief level-3 progression.
 * It exists to show Fast Hands and Second-Story Work from production class data while
 * making the missing subclass-aware object and movement transactions explicit. The
 * Classes registry calls it, and it calls production progression helpers for the
 * level-2 checkpoint and level-3 subclass choice.
 */

// ============================================================================
// Deterministic progression fixture
// ============================================================================
// Start at level 1, build the level-2 Rogue checkpoint through the production level-up
// helper, then apply the explicit Thief choice only at the level-3 milestone.
const ROGUE_ID = 'rogue';
const THIEF_ID = 'thief';
const LEVEL_THREE_XP = 900;

/** Resolve Thief through both canonical subclass lookup surfaces. */
function requireThief() {
  const rogue = CLASSES_DATA[ROGUE_ID];
  const thief = findSubclass(rogue.id, THIEF_ID);

  // Missing source data must stay visible instead of becoming a copied preview label.
  if (!thief || !subclassesForClass(rogue.id).some(subclass => subclass.id === thief.id)) {
    throw new Error('Canonical Rogue Thief subclass is required for this demo.');
  }

  return thief;
}

/** Build the subclass-free level-2 baseline through the production level-up path. */
export function createThiefLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: ROGUE_ID,
    raceId: 'human',
    level: 1,
    name: 'Thief Progression Tester',
    useRecommendedStats: true,
  });

  // A null result means the production disposable character fixture could not be built.
  if (!source) {
    throw new Error('Production quick character assembly failed for the Thief demo.');
  }

  // XP only makes the transition eligible; performLevelUp owns level and feature state.
  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Rogue level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

/** Apply the explicit canonical Thief choice at the level-3 milestone. */
export function createThiefLevel3(
  level2: PlayerCharacter = createThiefLevel2(),
): PlayerCharacter {
  const thief = requireThief();

  // Requiring the known checkpoint makes repeated control clicks deterministic.
  if (level2.level !== 2) {
    throw new Error('Thief level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: thief.id },
  );

  // Do not render a level-3 claim until production confirms the explicit choice.
  if (level3.level !== 3 || level3.subclassId !== thief.id) {
    throw new Error('Canonical Rogue level-3 progression did not apply Thief.');
  }

  return level3;
}

/** Read exact feature objects from the canonical progression resolver. */
export function getThiefFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[ROGUE_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Unsupported runtime boundary
// ============================================================================
// The subclass grants are real, but the searched runtime has no complete,
// subclass-aware Fast Hands or Second-Story Work transaction. Generic Cunning Dash,
// free-action counters, and physics helpers do not prove the Thief feature contract.
export const THIEF_RUNTIME_BOUNDARY =
  "Unsupported boundary: canonical Fast Hands (fast_hands) and Second-Story Work (second_story_work) are present, but no subclass-aware production path was found to use a Cunning Action bonus action for Sleight of Hand, thieves' tools, or Use an Object, nor to make climbing cost no extra movement or extend the Thief's jump distance. Generic Rogue Cunning Dash, free-action economy, and physics jump/climbing helpers prove only generic runtime behavior. This demo does not simulate an object target, tool result, Sleight of Hand check, climbing route, jump distance, movement payment, resource, or combat log outcome.";

// ============================================================================
// Thief demonstration surface
// ============================================================================
// The component owns only the production-derived progression checkpoint. It never
// becomes an alternate object-interaction, movement, action-economy, or combat engine.
export const ThiefDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createThiefLevel2());
  const features = useMemo(() => getThiefFeatures(character), [character]);
  const thief = requireThief();
  const isLevel3 = character.level === 3 && character.subclassId === thief.id;
  const fastHands = features.find(feature => feature.id === 'fast_hands');
  const secondStoryWork = features.find(feature => feature.id === 'second_story_work');

  // Reset returns to a fresh production-derived level-2 checkpoint.
  const reset = (): void => setCharacter(createThiefLevel2());

  // Rebuild from that checkpoint before applying the explicit subclass choice.
  const chooseThief = (): void => setCharacter(createThiefLevel3());

  return (
    <section
      aria-label="Thief progression demonstration"
      data-testid="thief-progression-demo"
      className="mt-4 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Thief</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Rogue level 2 baseline to the level 3 Thief subclass choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Rogue - Thief
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Thief progression controls">
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
          onClick={chooseThief}
          className="rounded border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
        >
          Choose Thief / Level 3
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
          <dd data-testid="thief-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="thief-subclass" className="mt-1 font-semibold text-amber-200">
            {character.subclassId ? thief.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="thief-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-amber-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="thief-grant-status"
        className="mt-3 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-amber-100"
      >
        {isLevel3
          ? `Canonical grants present: ${fastHands?.id} - ${fastHands?.name}; ${secondStoryWork?.id} - ${secondStoryWork?.name}.`
          : 'Canonical subclass grants absent before the level-3 choice: fast_hands, second_story_work.'}
      </p>

      <p
        data-testid="thief-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'thief' }); the canonical Fast Hands and Second-Story Work grants are present."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; the level-3 Thief feature grants are absent.'}
      </p>

      <p
        data-testid="thief-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {THIEF_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default ThiefDemo;
