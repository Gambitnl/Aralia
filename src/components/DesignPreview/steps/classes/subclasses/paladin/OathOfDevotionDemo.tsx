import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This component demonstrates the canonical Paladin Oath of Devotion level-3 choice.
 * It exists to show the production Sacred Weapon and Channel Divinity grants while
 * keeping the missing weapon, resource, and oath-spell runtime visible. The Classes
 * registry mounts it for the Oath of Devotion choice, and it calls production level-up
 * helpers instead of creating a second progression system.
 */

// ============================================================================
// Deterministic progression fixture
// ============================================================================
// Start at the production Paladin level-2 checkpoint, then apply only the explicit
// Oath of Devotion choice at level 3 so the state can be compared and reset.
const PALADIN_ID = 'paladin';
const OATH_OF_DEVOTION_ID = 'oath_of_devotion';
const LEVEL_THREE_XP = 900;

// Resolve the oath through both canonical lookup surfaces so copied preview data
// cannot make this leaf claim a subclass that production data does not contain.
function requireOathOfDevotion() {
  const paladin = CLASSES_DATA[PALADIN_ID];
  const oath = findSubclass(paladin.id, OATH_OF_DEVOTION_ID);

  if (!oath || !subclassesForClass(paladin.id).some(subclass => subclass.id === oath.id)) {
    throw new Error('Canonical Paladin Oath of Devotion subclass is required for this demo.');
  }

  return oath;
}

// Build the subclass-free level-2 baseline through the production level-up helper.
export function createOathOfDevotionLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: PALADIN_ID,
    raceId: 'human',
    level: 1,
    name: 'Oath of Devotion Progression Tester',
    useRecommendedStats: true,
  });

  if (!source) {
    throw new Error('Production quick character assembly failed for the Oath of Devotion demo.');
  }

  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Paladin level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

// Apply the explicit canonical Oath of Devotion choice at the level-3 milestone.
export function createOathOfDevotionLevel3(
  level2: PlayerCharacter = createOathOfDevotionLevel2(),
): PlayerCharacter {
  const oath = requireOathOfDevotion();

  if (level2.level !== 2) {
    throw new Error('Oath of Devotion level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: oath.id },
  );

  if (level3.level !== 3 || level3.subclassId !== oath.id) {
    throw new Error('Canonical Paladin level-3 progression did not apply Oath of Devotion.');
  }

  return level3;
}

// Read the exact feature objects production progression says this character owns.
export function getOathOfDevotionFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[PALADIN_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Unsupported runtime boundary
// ============================================================================
// Generic Paladin abilities, Divine Smite, attack modifiers, radiant damage, weapon
// effects, and spell preparation each prove only their own behavior. None binds the
// Sacred Weapon feature to the Channel Divinity resource and one weapon transaction.
export const OATH_OF_DEVOTION_RUNTIME_BOUNDARY =
  'Unsupported boundary: canonical Sacred Weapon (sacred_weapon) and Paladin Channel Divinity (paladin_channel_divinity) are present, but no subclass-aware production path was found that spends a Channel Divinity use, targets an equipped weapon, adds the Paladin\'s Charisma modifier to that weapon\'s attack rolls, or makes the weapon shed light through one Sacred Weapon transaction. The generic Paladin spell list has no Oath of Devotion preparation rows, and no subclass-aware oath-spell preparation path was found. Generic Divine Smite, attack, radiant-damage, weapon, action-economy, and spell-preparation helpers prove only separate behavior. This demo does not simulate a weapon target, attack roll, Charisma bonus, radiant result, light state, Channel Divinity resource, spell preparation, action payment, or combat log outcome.';

// ============================================================================
// Oath of Devotion demonstration surface
// ============================================================================
// The UI owns only the canonical progression checkpoint and exact runtime gap. It
// deliberately exposes no fake Sacred Weapon, resource, attack, light, or spell UI.
export const OathOfDevotionDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createOathOfDevotionLevel2());
  const features = useMemo(() => getOathOfDevotionFeatures(character), [character]);
  const oath = requireOathOfDevotion();
  const isLevel3 = character.level === 3 && character.subclassId === oath.id;
  const sacredWeapon = features.find(feature => feature.id === 'sacred_weapon');
  const channelDivinity = features.find(feature => feature.id === 'paladin_channel_divinity');

  // Reset returns to a fresh production-derived level-2 checkpoint.
  const reset = (): void => setCharacter(createOathOfDevotionLevel2());

  // Rebuild from that checkpoint before applying the explicit subclass choice.
  const chooseOath = (): void => setCharacter(createOathOfDevotionLevel3());

  return (
    <section
      aria-label="Oath of Devotion progression demonstration"
      data-testid="oath-of-devotion-progression-demo"
      className="mt-4 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Oath of Devotion</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Paladin level 2 baseline to the level 3 Oath of Devotion choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Paladin - Oath of Devotion
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Oath of Devotion progression controls">
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
          <dd data-testid="oath-of-devotion-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="oath-of-devotion-subclass" className="mt-1 font-semibold text-amber-200">
            {character.subclassId ? oath.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="oath-of-devotion-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-amber-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="oath-of-devotion-grant-status"
        className="mt-3 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-amber-100"
      >
        {isLevel3
          ? `Canonical grants present: ${channelDivinity?.id} - ${channelDivinity?.name}; ${sacredWeapon?.id} - ${sacredWeapon?.name}.`
          : 'Canonical subclass grants absent before the level-3 choice: paladin_channel_divinity, sacred_weapon.'}
      </p>

      <p
        data-testid="oath-of-devotion-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'oath_of_devotion' }); the canonical Channel Divinity and Sacred Weapon grants are present."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; the level-3 Oath of Devotion grants are absent.'}
      </p>

      <p
        data-testid="oath-of-devotion-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {OATH_OF_DEVOTION_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default OathOfDevotionDemo;
