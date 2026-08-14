import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This component demonstrates the canonical Rogue Assassin level-3 progression.
 * It exists to show Assassinate and Assassin's Tools from production class data while
 * keeping the incomplete attack, initiative, surprise, and tool runtime visible. The
 * Classes registry mounts it for the Assassin choice, and it calls production
 * progression helpers rather than inventing a second combat transaction.
 */

// ============================================================================
// Deterministic progression fixture
// ============================================================================
// Start at the production Rogue level-2 checkpoint, then apply only the explicit
// Assassin choice at level 3 so the two states remain easy to compare and reset.
const ROGUE_ID = 'rogue';
const ASSASSIN_ID = 'assassin';
const LEVEL_THREE_XP = 900;

// Resolve Assassin through both canonical lookup surfaces so stale or copied preview
// data cannot make this demo claim a subclass that production data does not contain.
function requireAssassin() {
  const rogue = CLASSES_DATA[ROGUE_ID];
  const assassin = findSubclass(rogue.id, ASSASSIN_ID);

  if (!assassin || !subclassesForClass(rogue.id).some(subclass => subclass.id === assassin.id)) {
    throw new Error('Canonical Rogue Assassin subclass is required for this demo.');
  }

  return assassin;
}

// Build the subclass-free level-2 baseline through the production level-up helper.
export function createAssassinLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: ROGUE_ID,
    raceId: 'human',
    level: 1,
    name: 'Assassin Progression Tester',
    useRecommendedStats: true,
  });

  if (!source) {
    throw new Error('Production quick character assembly failed for the Assassin demo.');
  }

  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Rogue level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

// Apply the explicit canonical Assassin choice at the level-3 milestone.
export function createAssassinLevel3(
  level2: PlayerCharacter = createAssassinLevel2(),
): PlayerCharacter {
  const assassin = requireAssassin();

  if (level2.level !== 2) {
    throw new Error('Assassin level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: assassin.id },
  );

  if (level3.level !== 3 || level3.subclassId !== assassin.id) {
    throw new Error('Canonical Rogue level-3 progression did not apply Assassin.');
  }

  return level3;
}

// Read the exact feature objects production progression says this character owns.
export function getAssassinFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[ROGUE_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Unsupported runtime boundary
// ============================================================================
// Generic critical, stealth, poison, initiative, puzzle, and crafting helpers each
// prove only their own behavior. None binds the Assassin's level-3 feature to one
// production attack transaction with the authored target and turn-state conditions.
export const ASSASSIN_RUNTIME_BOUNDARY =
  "Unsupported boundary: canonical Assassinate (assassinate) and Assassin's Tools (assassins_tools) are present, but no subclass-aware production path was found that grants advantage against a foe who has not acted, makes a hit against a surprised creature an automatic critical, or grants and validates the disguise-kit and poisoner's-kit proficiencies as one Assassin contract. Generic stealth, advantage, critical-hit, initiative, poison, puzzle, and crafting helpers prove only separate behavior. This demo does not simulate a roll, damage, initiative state, surprise flag, target result, tool check, proficiency result, resource, or combat log outcome.";

// ============================================================================
// Assassin demonstration surface
// ============================================================================
// The UI owns only the canonical progression checkpoint and the precise runtime gap.
// It deliberately exposes no fake attack, surprise, critical, or tool controls.
export const AssassinDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createAssassinLevel2());
  const features = useMemo(() => getAssassinFeatures(character), [character]);
  const assassin = requireAssassin();
  const isLevel3 = character.level === 3 && character.subclassId === assassin.id;
  const assassinate = features.find(feature => feature.id === 'assassinate');
  const assassinsTools = features.find(feature => feature.id === 'assassins_tools');

  // Reset returns to a fresh production-derived level-2 checkpoint.
  const reset = (): void => setCharacter(createAssassinLevel2());

  // Rebuild from that checkpoint before applying the explicit subclass choice.
  const chooseAssassin = (): void => setCharacter(createAssassinLevel3());

  return (
    <section
      aria-label="Assassin progression demonstration"
      data-testid="assassin-progression-demo"
      className="mt-4 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Assassin</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Rogue level 2 baseline to the level 3 Assassin subclass choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Rogue - Assassin
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Assassin progression controls">
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
          onClick={chooseAssassin}
          className="rounded border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
        >
          Choose Assassin / Level 3
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
          <dd data-testid="assassin-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="assassin-subclass" className="mt-1 font-semibold text-amber-200">
            {character.subclassId ? assassin.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="assassin-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-amber-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="assassin-grant-status"
        className="mt-3 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-amber-100"
      >
        {isLevel3
          ? `Canonical grants present: ${assassinate?.id} - ${assassinate?.name}; ${assassinsTools?.id} - ${assassinsTools?.name}.`
          : 'Canonical subclass grants absent before the level-3 choice: assassinate, assassins_tools.'}
      </p>

      <p
        data-testid="assassin-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'assassin' }); the canonical Assassinate and Assassin's Tools grants are present."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; the level-3 Assassin feature grants are absent.'}
      </p>

      <p
        data-testid="assassin-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {ASSASSIN_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default AssassinDemo;
