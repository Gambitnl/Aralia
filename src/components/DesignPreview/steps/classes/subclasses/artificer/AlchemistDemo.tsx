// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 16:50:56
 * Dependents: components/DesignPreview/steps/classes/subclassDemoRegistry.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { createPlayerCombatCharacter } from '../../../../../../utils/combat/combatUtils';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This file demonstrates the canonical Artificer Alchemist level-3 choice and
 * records the exact production boundary for Experimental Elixir.
 *
 * The Classes preview calls this leaf after the Alchemist subclass is selected.
 * It uses production character assembly, level-up, and player-to-combat conversion
 * so the UI can show what is real while keeping unsupported elixir transactions
 * visible instead of replacing them with generic potion or item behavior.
 */

// ============================================================================
// Canonical progression and Experimental Elixir contract
// ============================================================================
// These constants identify the source-authored class, subclass, and feature that this
// leaf is allowed to claim. The contract stays separate from runtime state because no
// production resolver currently owns the complete elixir lifecycle.
const ARTIFICER_ID = 'artificer';
const ALCHEMIST_ID = 'alchemist';
const EXPERIMENTAL_ELIXIR_ID = 'experimental_elixir';
const LEVEL_THREE_XP = 900;

export const EXPERIMENTAL_ELIXIR_CONTRACT = {
  creation: 'After finishing a Long Rest, create one Experimental Elixir in an empty flask you touch.',
  randomEffect: 'Roll 1d6 when the elixir is created to determine its effect.',
  extraCreation: 'Create each additional elixir by expending one spell slot of 1st level or higher.',
  drink: 'The recorded effect triggers when someone drinks the elixir.',
  effects: [
    '1: Healing — restore 2d4 + Intelligence modifier hit points.',
    '2: Swiftness — gain 10 feet of Speed for 1 hour.',
    '3: Resilience — gain +1 AC for 10 minutes.',
    '4: Boldness — add 1d4 to attack rolls and saving throws for 1 minute.',
    '5: Flight — gain a 10-foot Fly Speed for 10 minutes.',
    '6: Transformation — gain the effect of Alter Self.',
  ],
  resource: 'The free long-rest creation and each extra spell-slot-funded creation must have distinct elixir and slot ownership.',
  reset: 'A Long Rest refreshes the free creation opportunity; each elixir remains a created object until consumed or otherwise removed.',
} as const;

// Resolve the source-authored subclass and feature through both canonical lookup
// helpers before rendering. A copied name or feature label is not proof of a grant.
function requireAlchemist() {
  const artificer = CLASSES_DATA[ARTIFICER_ID];
  const alchemist = findSubclass(artificer.id, ALCHEMIST_ID);
  const experimentalElixir = alchemist?.features.find(
    feature => feature.id === EXPERIMENTAL_ELIXIR_ID,
  );

  if (
    !alchemist ||
    alchemist.name !== 'Alchemist' ||
    !subclassesForClass(artificer.id).some(subclass => subclass.id === alchemist.id) ||
    !experimentalElixir
  ) {
    throw new Error('Canonical Artificer Alchemist subclass is required for this demo.');
  }

  return { artificer, alchemist, experimentalElixir };
}

// ============================================================================
// Deterministic level checkpoints
// ============================================================================
// Build the subclass-free level-2 checkpoint with the production quick-character
// assembler and level-up helper rather than inventing a preview-only character.
export function createAlchemistLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: ARTIFICER_ID,
    raceId: 'human',
    level: 1,
    name: 'Alchemist Progression Tester',
    useRecommendedStats: true,
  });

  if (!source) {
    throw new Error('Production quick character assembly failed for the Alchemist demo.');
  }

  // XP makes the next transition eligible; performLevelUp remains the authority for
  // the level and does not receive a subclass choice at this checkpoint.
  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Artificer level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

// Apply the explicit canonical Alchemist choice at the level-3 milestone.
export function createAlchemistLevel3(
  level2: PlayerCharacter = createAlchemistLevel2(),
): PlayerCharacter {
  const { alchemist } = requireAlchemist();

  if (level2.level !== 2) {
    throw new Error('Alchemist level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: alchemist.id },
  );

  if (level3.level !== 3 || level3.subclassId !== alchemist.id) {
    throw new Error('Canonical Artificer level-3 progression did not apply Alchemist.');
  }

  return level3;
}

// Read the exact base, tier-one, and subclass features granted at this checkpoint.
export function getAlchemistFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[ARTIFICER_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Native Experimental Elixir audit
// ============================================================================
// Player-to-combat conversion is used here as an absence check. It identifies whether
// the real combat character exposes a subclass ability, resource, state, or resolver;
// it does not turn a generic consumable into an Alchemist feature.
export function getAlchemistNativeAudit(character: PlayerCharacter) {
  const combatCharacter = createPlayerCombatCharacter(character);
  const abilityIds = combatCharacter.abilities.map(ability => ability.id);
  const limitedUseIds = Object.keys(character.limitedUses ?? {});
  const combatRecord = combatCharacter as unknown as Record<string, unknown>;
  const nativeStateKeys = Object.keys(combatRecord).filter(key => /experimental.?elixir/i.test(key));

  return {
    combatClassId: combatCharacter.class?.id,
    abilityIds,
    limitedUseIds,
    nativeStateKeys,
    hasExperimentalElixirAbility: abilityIds.includes(EXPERIMENTAL_ELIXIR_ID),
    hasExperimentalElixirResource: limitedUseIds.includes(EXPERIMENTAL_ELIXIR_ID),
    hasNativeElixirState: nativeStateKeys.length > 0,
    hasLongRestCreationResolver: false,
    hasRandomEffectResolver: false,
    hasSpellSlotCreationResolver: false,
    hasDrinkEffectResolver: false,
    hasElixirResetResolver: false,
    genericPotionOrItemProof: false,
    contracts: EXPERIMENTAL_ELIXIR_CONTRACT,
  };
}

// Generic potion data, item inventory, healing, buffs, and spell-slot metadata do not
// prove Experimental Elixir. The complete subclass-owned transaction remains metadata
// until production state and resolvers can create, roll, drink, resolve, and reset it.
export const ALCHEMIST_RUNTIME_BOUNDARY =
  'Unsupported boundary: canonical Artificer Alchemist progression grants experimental_elixir (Experimental Elixir), but production conversion exposes no subclass-bound elixir ability, elixir resource, elixir object state, long-rest creation, d6 effect roll, spell-slot-funded extra creation, drink trigger, effect resolver, or elixir reset. Generic potions, consumable items, healing, buffs, Alter Self, and spell-slot fields are not Experimental Elixir proof. The requested creation contract—one free elixir after a Long Rest in an empty flask—the random-effect contract—a d6 result fixed at creation—the extra-creation contract—one 1st-level-or-higher spell slot per additional elixir—the drink contract—effects trigger when someone drinks—and the six authored effects remain metadata only. This demo exposes progression and native absence; it does not simulate creation, randomness, slot payment, drinking, effects, resource state, or reset.';

// ============================================================================
// Alchemist demonstration surface
// ============================================================================
// The UI owns canonical progression, the exact native audit, the authored effect table,
// and Reset. It intentionally exposes no create, roll, slot, drink, or effect buttons.
export const AlchemistDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createAlchemistLevel2());
  const features = useMemo(() => getAlchemistFeatures(character), [character]);
  const native = useMemo(() => getAlchemistNativeAudit(character), [character]);
  const { alchemist } = requireAlchemist();
  const isLevel3 = character.level === 3 && character.subclassId === alchemist.id;
  const experimentalElixirFeature = features.find(
    feature => feature.id === EXPERIMENTAL_ELIXIR_ID,
  );

  // Reset returns to a fresh production-derived level-2 checkpoint with no stale
  // subclass choice or native audit state.
  const reset = (): void => setCharacter(createAlchemistLevel2());

  // Rebuild from the baseline before applying the explicit Alchemist choice.
  const chooseAlchemist = (): void => setCharacter(createAlchemistLevel3());

  return (
    <section
      aria-label="Alchemist progression demonstration"
      data-testid="alchemist-progression-demo"
      className="mt-4 rounded border border-emerald-400/40 bg-emerald-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
            Canonical progression audit
          </p>
          <h3 className="mt-1 text-base font-semibold">Alchemist</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Artificer level 2 baseline to the level 3 Alchemist choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Artificer / Alchemist
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Alchemist progression controls">
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
          onClick={chooseAlchemist}
          className="rounded border border-emerald-300/70 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100"
        >
          Choose Alchemist / Level 3
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
          <dd data-testid="alchemist-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="alchemist-subclass" className="mt-1 font-semibold text-emerald-200">
            {character.subclassId ? alchemist.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="alchemist-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-emerald-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p data-testid="alchemist-grant-status" className="mt-3 border-l-2 border-emerald-400 pl-2 text-xs leading-relaxed text-emerald-100">
        {isLevel3
          ? `Canonical grant present: ${experimentalElixirFeature?.id} - ${experimentalElixirFeature?.name}.`
          : `Canonical subclass grant absent before the level-3 choice: ${EXPERIMENTAL_ELIXIR_ID}.`}
      </p>

      <div data-testid="alchemist-native-audit" className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs">
        <p className="font-semibold text-slate-300">Experimental Elixir contract audit</p>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div><dt className="text-slate-500">Long-rest creation</dt><dd data-testid="alchemist-creation-audit" className="text-rose-200">Not bound ({native.contracts.creation})</dd></div>
          <div><dt className="text-slate-500">Random effect</dt><dd data-testid="alchemist-random-audit" className="text-rose-200">Not bound ({native.contracts.randomEffect})</dd></div>
          <div><dt className="text-slate-500">Spell-slot extra creation</dt><dd data-testid="alchemist-slot-audit" className="text-rose-200">Not bound ({native.contracts.extraCreation})</dd></div>
          <div><dt className="text-slate-500">Drink trigger</dt><dd data-testid="alchemist-drink-audit" className="text-rose-200">Not bound ({native.contracts.drink})</dd></div>
          <div><dt className="text-slate-500">Effect table</dt><dd data-testid="alchemist-effect-audit" className="text-rose-200">Not bound ({native.contracts.effects.length} authored outcomes)</dd></div>
          <div><dt className="text-slate-500">Resource ownership</dt><dd data-testid="alchemist-resource-audit" className="text-rose-200">Not bound ({native.contracts.resource})</dd></div>
          <div><dt className="text-slate-500">Long-rest reset</dt><dd data-testid="alchemist-reset-audit" className="text-rose-200">Not bound ({native.contracts.reset})</dd></div>
          <div><dt className="text-slate-500">Native elixir ability</dt><dd data-testid="alchemist-ability-audit" className="text-rose-200">{native.hasExperimentalElixirAbility ? 'Present' : 'Not present'}</dd></div>
          <div><dt className="text-slate-500">Native elixir resource</dt><dd data-testid="alchemist-native-resource-audit" className="text-rose-200">{native.hasExperimentalElixirResource ? 'Present' : 'Not present'}</dd></div>
          <div><dt className="text-slate-500">Native elixir state</dt><dd data-testid="alchemist-state-audit" className="text-rose-200">{native.hasNativeElixirState ? native.nativeStateKeys.join(', ') : 'Not present'}</dd></div>
          <div><dt className="text-slate-500">Generic potion/item proof</dt><dd data-testid="alchemist-generic-audit" className="text-slate-300">{native.genericPotionOrItemProof ? 'Present' : 'Rejected as proof'}</dd></div>
        </dl>
      </div>

      <div data-testid="alchemist-effect-table" className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs">
        <p className="font-semibold text-slate-300">Authored d6 effect metadata</p>
        <ul className="mt-2 space-y-1 text-slate-300">
          {native.contracts.effects.map(effect => <li key={effect}>{effect}</li>)}
        </ul>
      </div>

      <p data-testid="alchemist-transition-log" className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300">
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'alchemist' }); Experimental Elixir metadata is present, but no elixir transaction is claimed."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; Alchemist metadata is absent.'}
      </p>

      <p data-testid="alchemist-runtime-boundary" className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100">
        {ALCHEMIST_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default AlchemistDemo;
