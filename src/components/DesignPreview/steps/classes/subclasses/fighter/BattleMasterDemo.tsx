import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This file demonstrates the canonical Fighter Battle Master level-3 choice.
 * It exists to show the real progression transaction and its exact feature list
 * while keeping the unsupported superiority-dice combat runtime visible.
 * Called by: subclassDemoRegistry.ts through the Classes domain shell.
 * Depends on: canonical class/subclass data, classFeaturesForLevel, performLevelUp,
 * and the production quick-character assembler.
 */

// ============================================================================
// Deterministic progression fixture
// ============================================================================
// The fixture starts at level 1 with enough canonical XP to perform the two
// transitions needed by this leaf: level 1 -> 2, then level 2 -> 3.
const FIGHTER_ID = 'fighter';
const BATTLE_MASTER_ID = 'battle_master';
const LEVEL_THREE_XP = 900;

/** Resolve the authored Battle Master or fail instead of inventing a fallback. */
function requireBattleMaster() {
  const fighter = CLASSES_DATA[FIGHTER_ID];
  const battleMaster = findSubclass(fighter.id, BATTLE_MASTER_ID);

  // The demo is a source-provenance check, so missing canonical data must remain an
  // explicit failure rather than being replaced with copied labels or feature ids.
  if (!battleMaster || !subclassesForClass(fighter.id).some(subclass => subclass.id === battleMaster.id)) {
    throw new Error('Canonical Fighter Battle Master subclass is required for this demo.');
  }

  return battleMaster;
}

/** Build the level-2 baseline through the production level-up implementation. */
export function createBattleMasterLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: FIGHTER_ID,
    raceId: 'human',
    level: 1,
    name: 'Battle Master Progression Tester',
    useRecommendedStats: true,
  });

  // The quick assembler is the same disposable character path used by other preview
  // leaves; a null result would mean the production fixture could not be assembled.
  if (!source) {
    throw new Error('Production quick character assembly failed for the Battle Master demo.');
  }

  // XP is only seeded to make performLevelUp eligible. No feature or subclass state is
  // authored here; performLevelUp owns the level-2 transition and feature grant.
  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Fighter level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

/** Apply the explicit canonical Battle Master choice at the level-3 milestone. */
export function createBattleMasterLevel3(level2: PlayerCharacter = createBattleMasterLevel2()): PlayerCharacter {
  const battleMaster = requireBattleMaster();

  // The control contract always enters level 3 from the known level-2 baseline so the
  // visible log remains deterministic even if a reviewer clicks the control repeatedly.
  if (level2.level !== 2) {
    throw new Error('Battle Master level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: battleMaster.id },
  );

  // Verify the production transition before rendering any level-3 claims.
  if (level3.level !== 3 || level3.subclassId !== battleMaster.id) {
    throw new Error('Canonical Battle Master level-3 progression did not apply the chosen subclass.');
  }

  return level3;
}

/** Read the exact feature objects from the canonical progression resolver. */
export function getBattleMasterFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[FIGHTER_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Unsupported combat boundary
// ============================================================================
// This wording is deliberately specific: progression data exists, but no character
// combat resolver/resource model was found for superiority dice or maneuvers.
const COMBAT_RUNTIME_BOUNDARY =
  'Unsupported boundary: canonical progression grants Combat Superiority, but no character-combat maneuver or superiority-dice resource resolver exists yet. This demo does not simulate dice, maneuver choices, attack riders, or combat outcomes.';

// ============================================================================
// Battle Master demonstration surface
// ============================================================================
// The component owns only which canonical progression checkpoint is being inspected;
// it never becomes authoritative for combat resources or attack resolution.
export const BattleMasterDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createBattleMasterLevel2());
  const features = useMemo(() => getBattleMasterFeatures(character), [character]);
  const battleMaster = requireBattleMaster();
  const isLevel3 = character.level === 3 && character.subclassId === battleMaster.id;

  // Reset returns to the production-derived level-2 checkpoint rather than mutating a
  // level-3 character backwards, keeping the proof reproducible after every interaction.
  const reset = (): void => setCharacter(createBattleMasterLevel2());

  // Rebuild from the same checkpoint before applying the choice so repeated clicks do
  // not depend on hidden XP or stale component state.
  const chooseBattleMaster = (): void => setCharacter(createBattleMasterLevel3());

  return (
    <section
      aria-label="Battle Master Combat Superiority progression demonstration"
      data-testid="battle-master-progression-demo"
      className="mt-4 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Combat Superiority</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Fighter level 2 baseline to the level 3 Battle Master choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Fighter · Battle Master
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Battle Master progression controls">
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
          onClick={chooseBattleMaster}
          className="rounded border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
        >
          Choose Battle Master / Level 3
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
          <dd data-testid="battle-master-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="battle-master-subclass" className="mt-1 font-semibold text-amber-200">
            {character.subclassId ? battleMaster.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="battle-master-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-amber-200">{feature.id}</code> — {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="battle-master-grant-status"
        className="mt-3 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-amber-100"
      >
        {isLevel3
          ? 'Canonical grant present: combat_superiority — Combat Superiority.'
          : 'Canonical grant absent before the level-3 subclass choice: combat_superiority — Combat Superiority.'}
      </p>

      <p
        data-testid="battle-master-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 → Level 3 via performLevelUp({ subclassId: 'battle_master' }); canonical feature grant is present."
          : 'Transition: Level 1 → Level 2 via performLevelUp() without a subclass choice; the level-3 feature is absent.'}
      </p>

      <p
        data-testid="battle-master-combat-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {COMBAT_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default BattleMasterDemo;
