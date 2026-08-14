// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 15:55:35
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
 * This component demonstrates the canonical Warlock Archfey Patron choice and
 * records the exact missing Fey Presence runtime contract. It connects the
 * Classes preview to canonical subclass data and the production level-up and
 * player-to-combat conversion boundaries without inventing an area effect.
 *
 * Called by: subclassDemoRegistry.ts through ClassesShell.tsx.
 * Depends on: canonical Warlock and Archfey Patron data, production level-up
 * helpers, the quick-character fixture, and createPlayerCombatCharacter.
 */

// ============================================================================
// Canonical progression and requested Fey Presence contract
// ============================================================================
// The current canonical record names the level-3 feature Steps of the Fey. The
// requested Fey Presence fields remain explicit metadata so this leaf can show
// the boundary without confusing generic saves, areas, or conditions for proof.
const WARLOCK_ID = 'warlock';
const ARCHFEY_ID = 'archfey';
const STEPS_OF_THE_FEY_ID = 'steps_of_the_fey';
const FEY_PRESENCE_ID = 'fey_presence';
const LEVEL_THREE_XP = 900;

export const FEY_PRESENCE_CONTRACT = {
  action: 'Action',
  area: '10-foot cube originating from you',
  save: 'Wisdom saving throw',
  outcomes: 'Choose Charmed or Frightened on a failed save',
  resource: 'Once per Short or Long Rest',
} as const;

// Resolve both canonical lookup surfaces so a copied label cannot make this
// preview claim an Archfey feature that production data does not contain.
function requireArchfeyPatron() {
  const warlock = CLASSES_DATA[WARLOCK_ID];
  const archfey = findSubclass(warlock.id, ARCHFEY_ID);
  const feature = archfey?.features.find(candidate => candidate.id === STEPS_OF_THE_FEY_ID);

  if (
    !archfey ||
    !subclassesForClass(warlock.id).some(subclass => subclass.id === archfey.id) ||
    !feature
  ) {
    throw new Error('Canonical Warlock Archfey Patron subclass is required for this demo.');
  }

  return { warlock, archfey, feature };
}

// ============================================================================
// Deterministic level checkpoints
// ============================================================================
// Build the subclass-free level-2 checkpoint through the production character
// and level-up helpers instead of assembling a preview-only character object.
export function createArchfeyPatronLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: WARLOCK_ID,
    raceId: 'human',
    level: 1,
    name: 'Archfey Patron Progression Tester',
    useRecommendedStats: true,
  });

  if (!source) {
    throw new Error('Production quick character assembly failed for the Archfey Patron demo.');
  }

  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Warlock level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

// Apply the explicit canonical Archfey choice at the level-3 milestone.
export function createArchfeyPatronLevel3(
  level2: PlayerCharacter = createArchfeyPatronLevel2(),
): PlayerCharacter {
  const { archfey } = requireArchfeyPatron();

  if (level2.level !== 2) {
    throw new Error('Archfey Patron level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: archfey.id },
  );

  if (level3.level !== 3 || level3.subclassId !== archfey.id) {
    throw new Error('Canonical Warlock level-3 progression did not apply Archfey Patron.');
  }

  return level3;
}

// Read the exact feature objects granted by canonical class and subclass progression.
export function getArchfeyPatronFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[WARLOCK_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Native Fey Presence audit
// ============================================================================
// The production combat conversion is an absence check here. It proves that no
// subclass-bound Fey Presence ability or resource exists to execute or spend.
export function getArchfeyPatronNativeAudit(character: PlayerCharacter) {
  const combatCharacter = createPlayerCombatCharacter(character);
  const abilityIds = combatCharacter.abilities.map(ability => ability.id);
  const limitedUseIds = Object.keys(character.limitedUses ?? {});

  return {
    abilityIds,
    limitedUseIds,
    hasFeyPresenceAbility: abilityIds.includes(FEY_PRESENCE_ID),
    hasFeyPresenceResource: limitedUseIds.includes(FEY_PRESENCE_ID),
    hasStepsOfTheFeyAbility: abilityIds.includes(STEPS_OF_THE_FEY_ID),
    contract: FEY_PRESENCE_CONTRACT,
  };
}

// Keep the requested action, area, save, outcome, and resource exact. Generic
// conditions, AoE helpers, Wisdom saves, or limited-use fields cannot prove the
// subclass-owned transaction, so the UI intentionally exposes no fake control.
export const ARCHFEY_PATRON_RUNTIME_BOUNDARY =
  'Unsupported boundary: canonical Archfey progression currently grants steps_of_the_fey (Steps of the Fey), not fey_presence. The production player-to-combat conversion exposes no subclass-bound Fey Presence ability or resource. The requested Action, 10-foot cube originating from you, Wisdom saving throw, Charmed-or-Frightened choice, and once-per-Short-or-Long-Rest resource are metadata only. Generic conditions, area-of-effect helpers, Wisdom saves, or limited-use fields are not Fey Presence proof. This demo exposes progression metadata only and no area, save, Charm, Frighten, or resource transaction.';

// ============================================================================
// Archfey Patron demonstration surface
// ============================================================================
// The UI owns canonical progression, the native absence audit, the exact gap,
// and Reset. It never simulates Fey Presence or a generic condition/AoE result.
export const ArchfeyPatronDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createArchfeyPatronLevel2());
  const features = useMemo(() => getArchfeyPatronFeatures(character), [character]);
  const native = useMemo(() => getArchfeyPatronNativeAudit(character), [character]);
  const { archfey } = requireArchfeyPatron();
  const isLevel3 = character.level === 3 && character.subclassId === archfey.id;
  const stepsFeature = features.find(feature => feature.id === STEPS_OF_THE_FEY_ID);

  // Reset returns to a fresh production-derived level-2 checkpoint with no
  // subclass choice or stale audit state.
  const reset = (): void => setCharacter(createArchfeyPatronLevel2());

  // Rebuild from the baseline before applying the explicit Archfey choice.
  const chooseArchfey = (): void => setCharacter(createArchfeyPatronLevel3());

  return (
    <section
      aria-label="Archfey Patron progression demonstration"
      data-testid="archfey-patron-progression-demo"
      className="mt-4 rounded border border-cyan-400/40 bg-cyan-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
            Canonical progression audit
          </p>
          <h3 className="mt-1 text-base font-semibold">Archfey Patron</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Warlock level 2 baseline to the level 3 Archfey Patron choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Warlock / Archfey Patron
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Archfey Patron progression controls">
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
          onClick={chooseArchfey}
          className="rounded border border-cyan-300/70 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100"
        >
          Choose Archfey / Level 3
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
          <dd data-testid="archfey-patron-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Patron choice</dt>
          <dd data-testid="archfey-patron-subclass" className="mt-1 font-semibold text-cyan-200">
            {character.subclassId ? archfey.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="archfey-patron-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-cyan-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="archfey-patron-grant-status"
        className="mt-3 border-l-2 border-cyan-400 pl-2 text-xs leading-relaxed text-cyan-100"
      >
        {isLevel3
          ? `Canonical grant present: ${stepsFeature?.id} - ${stepsFeature?.name}.`
          : `Canonical subclass grant absent before the level-3 choice: ${STEPS_OF_THE_FEY_ID}.`}
      </p>

      <div
        data-testid="archfey-patron-native-audit"
        className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs"
      >
        <p className="font-semibold text-slate-300">Fey Presence contract audit</p>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Action</dt>
            <dd data-testid="archfey-patron-action-audit" className="text-rose-200">Not bound ({native.contract.action})</dd>
          </div>
          <div>
            <dt className="text-slate-500">Area</dt>
            <dd data-testid="archfey-patron-area-audit" className="text-rose-200">Not bound ({native.contract.area})</dd>
          </div>
          <div>
            <dt className="text-slate-500">Saving throw</dt>
            <dd data-testid="archfey-patron-save-audit" className="text-rose-200">Not bound ({native.contract.save})</dd>
          </div>
          <div>
            <dt className="text-slate-500">Failed-save outcome</dt>
            <dd data-testid="archfey-patron-outcome-audit" className="text-rose-200">Not bound ({native.contract.outcomes})</dd>
          </div>
          <div>
            <dt className="text-slate-500">Resource</dt>
            <dd data-testid="archfey-patron-resource-audit" className="text-rose-200">Not bound ({native.contract.resource})</dd>
          </div>
          <div>
            <dt className="text-slate-500">Native Fey Presence ability</dt>
            <dd data-testid="archfey-patron-ability-audit" className="text-rose-200">
              {native.hasFeyPresenceAbility ? 'Present' : 'Not present'}
            </dd>
          </div>
        </dl>
      </div>

      <p
        data-testid="archfey-patron-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'archfey' }); Steps of the Fey metadata is present, but no Fey Presence transaction is claimed."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a patron choice; Archfey metadata is absent.'}
      </p>

      <p
        data-testid="archfey-patron-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {ARCHFEY_PATRON_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default ArchfeyPatronDemo;
