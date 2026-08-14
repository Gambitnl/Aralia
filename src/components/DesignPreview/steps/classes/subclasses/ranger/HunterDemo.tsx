import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This component demonstrates the canonical Ranger Hunter level-3 progression.
 * It exists to show the real subclass grant while making the missing Hunter's Prey
 * choice and combat transaction boundary explicit instead of inventing a second
 * attack engine. The Classes registry calls it, and it calls production progression
 * helpers for the only transaction currently supported by the source.
 */

// ============================================================================
// Deterministic progression fixture
// ============================================================================
// Start at level 1, build the level-2 checkpoint through the production level-up
// helper, and apply the explicit Hunter subclass choice only at level 3.
const RANGER_ID = 'ranger';
const HUNTER_ID = 'hunter';
const LEVEL_THREE_XP = 900;

/** Resolve Hunter through both canonical subclass lookup surfaces. */
function requireHunter() {
  const ranger = CLASSES_DATA[RANGER_ID];
  const hunter = findSubclass(ranger.id, HUNTER_ID);

  // Missing source data must remain a visible failure rather than becoming a copied
  // preview label that could drift away from the production class registry.
  if (!hunter || !subclassesForClass(ranger.id).some(subclass => subclass.id === hunter.id)) {
    throw new Error('Canonical Ranger Hunter subclass is required for this demo.');
  }

  return hunter;
}

/** Build the subclass-free level-2 baseline through the production level-up path. */
export function createHunterLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: RANGER_ID,
    raceId: 'human',
    level: 1,
    name: 'Hunter Progression Tester',
    useRecommendedStats: true,
  });

  // A null result means the production disposable character fixture could not be built.
  if (!source) {
    throw new Error('Production quick character assembly failed for the Hunter demo.');
  }

  // XP only makes the transition eligible; performLevelUp owns level and feature state.
  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Ranger level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

/** Apply the explicit canonical Hunter choice at the level-3 milestone. */
export function createHunterLevel3(level2: PlayerCharacter = createHunterLevel2()): PlayerCharacter {
  const hunter = requireHunter();

  // Requiring the known checkpoint makes repeated control clicks deterministic.
  if (level2.level !== 2) {
    throw new Error('Hunter level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: hunter.id },
  );

  // Do not render a level-3 claim until production confirms the explicit choice.
  if (level3.level !== 3 || level3.subclassId !== hunter.id) {
    throw new Error('Canonical Ranger level-3 progression did not apply Hunter.');
  }

  return level3;
}

/** Read exact feature objects from the canonical progression resolver. */
export function getHunterFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[RANGER_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Unsupported runtime boundary
// ============================================================================
// The subclass grant is real, but the searched runtime has no complete,
// subclass-aware Hunter's Prey transaction. Generic riders, once-per-turn flags,
// target HP checks, and Multiattack execution are not proof of any Hunter option.
export const HUNTER_RUNTIME_BOUNDARY =
  "Unsupported boundary: canonical Hunter's Prey (hunters_prey) is present and its source description names Colossus Slayer, Giant Killer, and Horde Breaker, but no subclass-aware production path was found to persist one of those three choices or execute its attack timing. No native Colossus Slayer once-per-turn extra damage against a target below maximum HP, Giant Killer reaction attack, or Horde Breaker multi-target attack transaction was found. Generic attack riders, once-per-turn limits, target HP fields, and authored Multiattack helpers are not Hunter proof. This demo does not simulate a Prey choice, damage, attack, reaction, action, target HP change, resource, multi-target result, or combat log outcome."

// ============================================================================
// Hunter demonstration surface
// ============================================================================
// The component owns only the production-derived progression checkpoint. It never
// becomes an alternate Prey-choice, damage, action-economy, or combat engine.
export const HunterDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createHunterLevel2());
  const features = useMemo(() => getHunterFeatures(character), [character]);
  const hunter = requireHunter();
  const isLevel3 = character.level === 3 && character.subclassId === hunter.id;
  const huntersPrey = features.find(feature => feature.id === 'hunters_prey');

  // Reset returns to a fresh production-derived level-2 checkpoint.
  const reset = (): void => setCharacter(createHunterLevel2());

  // Rebuild from that checkpoint before applying the explicit subclass choice.
  const chooseHunter = (): void => setCharacter(createHunterLevel3());

  return (
    <section
      aria-label="Hunter progression demonstration"
      data-testid="hunter-progression-demo"
      className="mt-4 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Hunter</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Ranger level 2 baseline to the level 3 Hunter subclass choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Ranger - Hunter
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Hunter progression controls">
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
          onClick={chooseHunter}
          className="rounded border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
        >
          Choose Hunter / Level 3
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
          <dd data-testid="hunter-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="hunter-subclass" className="mt-1 font-semibold text-amber-200">
            {character.subclassId ? hunter.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="hunter-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-amber-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="hunter-grant-status"
        className="mt-3 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-amber-100"
      >
        {isLevel3
          ? `Canonical grant present: ${huntersPrey?.id} - ${huntersPrey?.name}.`
          : 'Canonical grant absent before the level-3 subclass choice: hunters_prey.'}
      </p>

      <p
        data-testid="hunter-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'hunter' }); the canonical Hunter's Prey grant is present."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; the level-3 feature grant is absent.'}
      </p>

      <p
        data-testid="hunter-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {HUNTER_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default HunterDemo;
