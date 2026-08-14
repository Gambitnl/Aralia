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
 * This component demonstrates the canonical Paladin Oath of Vengeance level-3 choice.
 * It exists to show the production Vow of Enmity ability being created while keeping
 * the missing chosen-foe transaction visible instead of presenting a global advantage
 * status as if it were the complete oath feature.
 *
 * Called by: the Classes subclass registry and ClassesShell.tsx.
 * Depends on: canonical subclass/progression data, production level-up helpers, and
 * createPlayerCombatCharacter for the native combat ability assembly.
 */

// ============================================================================
// Deterministic progression fixture
// ============================================================================
// Start at the production Paladin level-2 checkpoint, then apply only the explicit
// Oath of Vengeance choice at level 3 so the state can be compared and reset.
const PALADIN_ID = 'paladin';
const OATH_OF_VENGEANCE_ID = 'oath_of_vengeance';
const LEVEL_THREE_XP = 900;

// Resolve the oath through both canonical lookup surfaces so copied preview data
// cannot make this leaf claim a subclass that production data does not contain.
function requireOathOfVengeance() {
  const paladin = CLASSES_DATA[PALADIN_ID];
  const oath = findSubclass(paladin.id, OATH_OF_VENGEANCE_ID);

  if (!oath || !subclassesForClass(paladin.id).some(subclass => subclass.id === oath.id)) {
    throw new Error('Canonical Paladin Oath of Vengeance subclass is required for this demo.');
  }

  return oath;
}

// Build the subclass-free level-2 baseline through the production level-up helper.
export function createOathOfVengeanceLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: PALADIN_ID,
    raceId: 'human',
    level: 1,
    name: 'Oath of Vengeance Progression Tester',
    useRecommendedStats: true,
  });

  if (!source) {
    throw new Error('Production quick character assembly failed for the Oath of Vengeance demo.');
  }

  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Paladin level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

// Apply the explicit canonical Oath of Vengeance choice at the level-3 milestone.
export function createOathOfVengeanceLevel3(
  level2: PlayerCharacter = createOathOfVengeanceLevel2(),
): PlayerCharacter {
  const oath = requireOathOfVengeance();

  if (level2.level !== 2) {
    throw new Error('Oath of Vengeance level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: oath.id },
  );

  if (level3.level !== 3 || level3.subclassId !== oath.id) {
    throw new Error('Canonical Paladin level-3 progression did not apply Oath of Vengeance.');
  }

  return level3;
}

// Read the exact feature objects production progression says this character owns.
export function getOathOfVengeanceFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[PALADIN_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// Read the native combat ability assembled from the level-3 character. This proves
// ability creation and its authored metadata without copying combat rules into the leaf.
export function getOathOfVengeanceAbility(character: PlayerCharacter): Ability | undefined {
  const combatCharacter = createPlayerCombatCharacter(character);
  return combatCharacter.abilities.find(ability => ability.id === 'vow_of_enmity');
}

// ============================================================================
// Unsupported runtime boundary
// ============================================================================
// The native ability exists, but the current executor does not bind its advantage
// to one chosen foe. The preview therefore does not expose an activation or attack
// button, because doing so would show a global status as a false Vow outcome.
export const VOW_OF_ENMITY_RUNTIME_BOUNDARY =
  'Unsupported boundary: the native vow_of_enmity ability is created for a level-3 Oath of Vengeance Paladin with a bonus-action cost and one limited use, but it is targeting: self with no target payload. The current executor applies a caster-wide attack-advantage status and does not preserve one chosen foe for target validation or attack resolution. Generic bonus-action payment, limited-use decrement, status-duration ticking, and attack-advantage helpers exist, but they are not a complete target-bound Vow transaction. This demo does not simulate activation, target selection, target-specific advantage, damage, combat-log outcome, or reset of a chosen-foe effect.';

// ============================================================================
// Oath of Vengeance demonstration surface
// ============================================================================
// The UI owns only the canonical progression checkpoint, native ability metadata,
// and the exact runtime gap. It deliberately exposes no fake activation or attack.
export const OathOfVengeanceDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createOathOfVengeanceLevel2());
  const features = useMemo(() => getOathOfVengeanceFeatures(character), [character]);
  const oath = requireOathOfVengeance();
  const isLevel3 = character.level === 3 && character.subclassId === oath.id;
  const vowFeature = features.find(feature => feature.id === 'vow_of_enmity');
  const nativeAbility = isLevel3 ? getOathOfVengeanceAbility(character) : undefined;

  // Reset returns to a fresh production-derived level-2 checkpoint.
  const reset = (): void => setCharacter(createOathOfVengeanceLevel2());

  // Rebuild from that checkpoint before applying the explicit subclass choice.
  const chooseOath = (): void => setCharacter(createOathOfVengeanceLevel3());

  return (
    <section
      aria-label="Oath of Vengeance progression demonstration"
      data-testid="oath-of-vengeance-progression-demo"
      className="mt-4 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Oath of Vengeance</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Paladin level 2 baseline to the level 3 Oath of Vengeance choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Paladin - Oath of Vengeance
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Oath of Vengeance progression controls">
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
          onClick={chooseOath}
          className="rounded border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
        >
          Choose Oath / Level 3
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
          <dd data-testid="oath-of-vengeance-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="oath-of-vengeance-subclass" className="mt-1 font-semibold text-amber-200">
            {character.subclassId ? oath.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="oath-of-vengeance-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-amber-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="oath-of-vengeance-grant-status"
        className="mt-3 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-amber-100"
      >
        {isLevel3
          ? `Canonical grant present: ${vowFeature?.id} - ${vowFeature?.name}.`
          : 'Canonical subclass grant absent before the level-3 choice: vow_of_enmity.'}
      </p>

      <div
        data-testid="oath-of-vengeance-native-ability"
        className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs"
      >
        <p className="font-semibold text-slate-300">Native ability creation facts</p>
        {nativeAbility ? (
          <dl className="mt-2 grid gap-1 sm:grid-cols-2">
            <div><dt className="text-slate-500">Ability id</dt><dd className="font-mono text-amber-200">{nativeAbility.id}</dd></div>
            <div><dt className="text-slate-500">Cost</dt><dd className="text-slate-200">{nativeAbility.cost.type}</dd></div>
            <div><dt className="text-slate-500">Targeting</dt><dd className="text-rose-200">{nativeAbility.targeting}</dd></div>
            <div><dt className="text-slate-500">Uses</dt><dd className="text-slate-200">{nativeAbility.usesRemaining}/{nativeAbility.maxUses}</dd></div>
          </dl>
        ) : (
          <p className="mt-2 text-slate-400">No native Vow ability exists before the level-3 subclass choice.</p>
        )}
      </div>

      <p
        data-testid="oath-of-vengeance-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'oath_of_vengeance' }); createPlayerCombatCharacter adds the native Vow of Enmity ability."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; the level-3 Vow grant is absent.'}
      </p>

      <p
        data-testid="oath-of-vengeance-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {VOW_OF_ENMITY_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default OathOfVengeanceDemo;
