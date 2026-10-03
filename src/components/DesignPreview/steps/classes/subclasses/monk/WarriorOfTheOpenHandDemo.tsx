import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { createPlayerCombatCharacter } from '../../../../../../utils/combat/combatUtils';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { Ability } from '../../../../../../types/combat';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This component demonstrates the canonical Monk Warrior of the Open Hand level-3
 * progression choice and the native Flurry of Blows metadata already assembled by
 * production combat. It exists to make the real subclass grant visible while keeping
 * the missing Focus-funded Open Hand Technique transaction honest.
 *
 * Called by: subclassDemoRegistry.ts through the Classes domain shell.
 * Depends on: canonical class/subclass data, production level-up helpers, the quick
 * character fixture, and createPlayerCombatCharacter for native ability assembly.
 */

// ============================================================================
// Deterministic progression fixture
// ============================================================================
// The fixture starts at a production-derived level-2 Monk checkpoint, then applies
// only the explicit Open Hand choice at level 3 so Reset always has one clear state.
const MONK_ID = 'monk';
const OPEN_HAND_ID = 'open_hand';
const LEVEL_THREE_XP = 900;

// Resolve the subclass through both canonical lookup surfaces so the preview cannot
// silently replace missing game data with copied labels or feature definitions.
function requireOpenHand() {
  const monk = CLASSES_DATA[MONK_ID];
  const openHand = findSubclass(monk.id, OPEN_HAND_ID);

  if (!openHand || !subclassesForClass(monk.id).some(subclass => subclass.id === openHand.id)) {
    throw new Error('Canonical Monk Warrior of the Open Hand subclass is required for this demo.');
  }

  return openHand;
}

// Build the subclass-free level-2 checkpoint through the production character path.
export function createWarriorOfTheOpenHandLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: MONK_ID,
    raceId: 'human',
    level: 1,
    name: 'Open Hand Progression Tester',
    useRecommendedStats: true,
  });

  if (!source) {
    throw new Error('Production quick character assembly failed for the Open Hand demo.');
  }

  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Monk level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

// Apply the explicit canonical Open Hand choice at the level-3 milestone.
export function createWarriorOfTheOpenHandLevel3(
  level2: PlayerCharacter = createWarriorOfTheOpenHandLevel2(),
): PlayerCharacter {
  const openHand = requireOpenHand();

  if (level2.level !== 2) {
    throw new Error('Open Hand level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: openHand.id },
  );

  if (level3.level !== 3 || level3.subclassId !== openHand.id) {
    throw new Error('Canonical Monk level-3 progression did not apply Warrior of the Open Hand.');
  }

  return level3;
}

// Read the exact feature objects granted by canonical class and subclass progression.
export function getWarriorOfTheOpenHandFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[MONK_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// Read the native Flurry ability instead of recreating its action or damage metadata.
// This is metadata proof only: the ability currently has no Focus resource binding.
export function getWarriorOfTheOpenHandFlurry(character: PlayerCharacter): Ability | undefined {
  const combatCharacter = createPlayerCombatCharacter(character);
  return combatCharacter.abilities.find(ability => ability.id === 'flurry_of_blows');
}

// ============================================================================
// Unsupported subclass runtime boundary
// ============================================================================
// Production has the generic Flurry attack and generic shove/condition systems, but
// no one authoritative Open Hand transaction joining Focus, Flurry, a failed-save
// choice, and reaction denial. The UI therefore does not expose a fake combat button.
export const OPEN_HAND_RUNTIME_BOUNDARY =
  'Unsupported boundary: canonical Open Hand Technique is granted at level 3, and production creates a real level-2+ Flurry of Blows bonus-action single-enemy unarmed attack, but Flurry has no Focus resource payment or subclass-specific effect rider. No production path binds this subclass to a target-validated choice among push, prone, or no reactions, forces the authored save, records the Open Hand outcome, or resets the spent resource. Generic shove, forced movement, and condition helpers are not subclass proof. This demo does not simulate activation, Focus debit, save result, push, prone, reaction denial, damage, combat-log outcome, or reset.';

// ============================================================================
// Warrior of the Open Hand demonstration surface
// ============================================================================
// The component owns only canonical progression, native Flurry metadata, and the
// exact runtime gap. It deliberately avoids creating a second combat engine.
export const WarriorOfTheOpenHandDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createWarriorOfTheOpenHandLevel2());
  const features = useMemo(() => getWarriorOfTheOpenHandFeatures(character), [character]);
  const openHand = requireOpenHand();
  const isLevel3 = character.level === 3 && character.subclassId === openHand.id;
  const openHandFeature = features.find(feature => feature.id === 'open_hand_technique');
  const flurry = getWarriorOfTheOpenHandFlurry(character);
  const flurryDamage = flurry?.effects.find(effect => effect.type === 'damage');

  // Reset returns to a fresh production-derived level-2 checkpoint.
  const reset = (): void => setCharacter(createWarriorOfTheOpenHandLevel2());

  // Rebuild from that checkpoint before applying the explicit subclass choice.
  const chooseOpenHand = (): void => setCharacter(createWarriorOfTheOpenHandLevel3());

  return (
    <section
      aria-label="Warrior of the Open Hand progression demonstration"
      data-testid="open-hand-progression-demo"
      className="mt-4 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Warrior of the Open Hand</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Monk level 2 baseline to the level 3 Warrior of the Open Hand choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Monk · Warrior of the Open Hand
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Open Hand progression controls">
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
          onClick={chooseOpenHand}
          className="rounded border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
        >
          Choose Open Hand / Level 3
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
          <dd data-testid="open-hand-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="open-hand-subclass" className="mt-1 font-semibold text-amber-200">
            {character.subclassId ? openHand.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="open-hand-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-amber-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="open-hand-grant-status"
        className="mt-3 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-amber-100"
      >
        {isLevel3
          ? `Canonical grant present: ${openHandFeature?.id} - ${openHandFeature?.name}.`
          : 'Canonical subclass grant absent before the level-3 choice: open_hand_technique.'}
      </p>

      <div
        data-testid="open-hand-native-flurry"
        className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs"
      >
        <p className="font-semibold text-slate-300">Native Flurry of Blows metadata</p>
        {flurry ? (
          <dl className="mt-2 grid gap-1 sm:grid-cols-2">
            <div><dt className="text-slate-500">Ability id</dt><dd className="font-mono text-amber-200">{flurry.id}</dd></div>
            <div><dt className="text-slate-500">Cost</dt><dd className="text-slate-200">{flurry.cost.type}</dd></div>
            <div><dt className="text-slate-500">Targeting</dt><dd className="text-slate-200">{flurry.targeting}</dd></div>
            <div><dt className="text-slate-500">Damage</dt><dd className="text-slate-200">{flurryDamage?.dice ?? 'not provided'}</dd></div>
            <div><dt className="text-slate-500">Focus uses</dt><dd className="text-rose-200">No subclass resource binding</dd></div>
          </dl>
        ) : (
          <p className="mt-2 text-slate-400">No native Flurry ability exists before Monk level 2.</p>
        )}
      </div>

      <p
        data-testid="open-hand-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'open_hand' }); canonical Open Hand Technique grant is present."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; the level-3 Open Hand grant is absent.'}
      </p>

      <p
        data-testid="open-hand-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {OPEN_HAND_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default WarriorOfTheOpenHandDemo;
