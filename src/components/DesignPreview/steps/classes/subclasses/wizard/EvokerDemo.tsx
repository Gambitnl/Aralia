// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 16:12:14
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
 * This component demonstrates the canonical Wizard Evoker choice and records the
 * exact missing Sculpt Spells and Potent Cantrip runtime contract.
 *
 * The Classes preview calls it after the Evoker subclass is selected. It uses the
 * production level-up and player-to-combat conversion boundaries so the visible
 * result distinguishes canonical progression from mechanics that are not wired yet.
 */

// ============================================================================
// Canonical progression and requested Evoker contracts
// ============================================================================
// The current canonical record grants Sculpt Spells at level 3. Potent Cantrip is
// kept as explicit contract metadata because the glossary describes it, while the
// production subclass record does not currently grant a feature with that id.
const WIZARD_ID = 'wizard';
const EVOCATION_ID = 'evocation';
const SCULPT_SPELLS_ID = 'sculpt_spells';
const POTENT_CANTRIP_ID = 'potent_cantrip';
const LEVEL_THREE_XP = 900;

export const SCULPT_SPELLS_CONTRACT = {
  trigger: 'Evocation spell affecting other creatures you can see',
  allySafety: 'Choose 1 + spell level creatures; chosen creatures automatically succeed on the save',
  area: 'The originating spell area must be resolved by the production spell path',
  save: 'Chosen creatures automatically succeed on the spell saving throw',
  damage: 'Chosen creatures take no damage when a successful save would normally deal half damage',
} as const;

export const POTENT_CANTRIP_CONTRACT = {
  trigger: 'Damaging cantrip attack miss or successful target saving throw',
  damage: 'Target takes half the cantrip damage, if any',
  rider: 'Target suffers no additional effect from the cantrip',
} as const;

// Resolve canonical class and subclass data before rendering. A copied label must
// never allow this leaf to claim a feature that production data does not contain.
function requireEvoker() {
  const wizard = CLASSES_DATA[WIZARD_ID];
  const evoker = findSubclass(wizard.id, EVOCATION_ID);
  const sculptSpells = evoker?.features.find(feature => feature.id === SCULPT_SPELLS_ID);

  if (
    !evoker ||
    evoker.name !== 'Evoker (School of Evocation)' ||
    !subclassesForClass(wizard.id).some(subclass => subclass.id === evoker.id) ||
    !sculptSpells
  ) {
    throw new Error('Canonical Wizard Evoker subclass is required for this demo.');
  }

  return { wizard, evoker, sculptSpells };
}

// ============================================================================
// Deterministic level checkpoints
// ============================================================================
// Build the subclass-free level-2 checkpoint with the production character and
// level-up helpers instead of assembling a preview-only character object.
export function createEvokerLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: WIZARD_ID,
    raceId: 'human',
    level: 1,
    name: 'Evoker Progression Tester',
    useRecommendedStats: true,
  });

  if (!source) {
    throw new Error('Production quick character assembly failed for the Evoker demo.');
  }

  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Wizard level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

// Apply the explicit canonical Evoker choice at the level-3 milestone.
export function createEvokerLevel3(
  level2: PlayerCharacter = createEvokerLevel2(),
): PlayerCharacter {
  const { evoker } = requireEvoker();

  if (level2.level !== 2) {
    throw new Error('Evoker level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: evoker.id },
  );

  if (level3.level !== 3 || level3.subclassId !== evoker.id) {
    throw new Error('Canonical Wizard level-3 progression did not apply Evoker.');
  }

  return level3;
}

// Read the exact feature objects granted by canonical class and subclass progression.
export function getEvokerFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[WIZARD_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Native Sculpt Spells and Potent Cantrip audit
// ============================================================================
// The production combat conversion is an absence check. It proves that no
// subclass-bound Evoker ability or resource is available to execute or spend.
export function getEvokerNativeAudit(character: PlayerCharacter) {
  const combatCharacter = createPlayerCombatCharacter(character);
  const abilityIds = combatCharacter.abilities.map(ability => ability.id);
  const limitedUseIds = Object.keys(character.limitedUses ?? {});

  return {
    abilityIds,
    limitedUseIds,
    hasSculptSpellsAbility: abilityIds.includes(SCULPT_SPELLS_ID),
    hasSculptSpellsResource: limitedUseIds.includes(SCULPT_SPELLS_ID),
    hasPotentCantripAbility: abilityIds.includes(POTENT_CANTRIP_ID),
    hasPotentCantripResource: limitedUseIds.includes(POTENT_CANTRIP_ID),
    contracts: {
      sculptSpells: SCULPT_SPELLS_CONTRACT,
      potentCantrip: POTENT_CANTRIP_CONTRACT,
    },
  };
}

// Generic spell resolution, AoE targeting, saving throws, and damage are useful
// foundations but do not prove subclass ownership, ally safety, or half damage.
export const EVOKER_RUNTIME_BOUNDARY =
  'Unsupported boundary: canonical Wizard Evoker (School of Evocation) progression currently grants sculpt_spells (Sculpt Spells), while Potent Cantrip is not present in the canonical subclass record. The production player-to-combat conversion exposes no subclass-bound Sculpt Spells or Potent Cantrip ability or resource. The requested Sculpt Spells contract—an Evocation area affecting visible other creatures, 1 + spell level chosen creatures, automatic saving-throw success, and no half damage for those chosen creatures—and the Potent Cantrip contract—half damaging-cantrip damage on a miss or successful save with no additional effect—are metadata only. Generic spell resolvers, AoE targeting, saving throws, and damage helpers are not Evoker proof. This demo exposes progression and native absence only; it does not simulate ally selection, area targeting, saves, damage, half damage, or resource payment.';

// ============================================================================
// Evoker demonstration surface
// ============================================================================
// The UI owns canonical progression, the native absence audit, the exact gap, and
// Reset. It never simulates a generic spell transaction as an Evoker feature.
export const EvokerDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createEvokerLevel2());
  const features = useMemo(() => getEvokerFeatures(character), [character]);
  const native = useMemo(() => getEvokerNativeAudit(character), [character]);
  const { evoker } = requireEvoker();
  const isLevel3 = character.level === 3 && character.subclassId === evoker.id;
  const sculptSpellsFeature = features.find(feature => feature.id === SCULPT_SPELLS_ID);

  // Reset returns to a fresh production-derived level-2 checkpoint with no
  // subclass choice or stale native audit state.
  const reset = (): void => setCharacter(createEvokerLevel2());

  // Rebuild from the baseline before applying the explicit Evoker choice.
  const chooseEvoker = (): void => setCharacter(createEvokerLevel3());

  return (
    <section
      aria-label="Evoker (School of Evocation) progression demonstration"
      data-testid="evoker-progression-demo"
      className="mt-4 rounded border border-orange-400/40 bg-orange-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300">
            Canonical progression audit
          </p>
          <h3 className="mt-1 text-base font-semibold">Evoker (School of Evocation)</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Wizard level 2 baseline to the level 3 Evoker choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Wizard / Evocation
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Evoker progression controls">
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
          onClick={chooseEvoker}
          className="rounded border border-orange-300/70 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100"
        >
          Choose Evoker / Level 3
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
          <dd data-testid="evoker-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="evoker-subclass" className="mt-1 font-semibold text-orange-200">
            {character.subclassId ? evoker.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="evoker-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-orange-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="evoker-grant-status"
        className="mt-3 border-l-2 border-orange-400 pl-2 text-xs leading-relaxed text-orange-100"
      >
        {isLevel3
          ? `Canonical grant present: ${sculptSpellsFeature?.id} - ${sculptSpellsFeature?.name}.`
          : `Canonical subclass grant absent before the level-3 choice: ${SCULPT_SPELLS_ID}.`}
      </p>

      <div data-testid="evoker-native-audit" className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs">
        <p className="font-semibold text-slate-300">Sculpt Spells and Potent Cantrip contract audit</p>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Sculpt Spells trigger</dt>
            <dd data-testid="evoker-sculpt-trigger-audit" className="text-rose-200">Not bound ({native.contracts.sculptSpells.trigger})</dd>
          </div>
          <div>
            <dt className="text-slate-500">Ally-safe save</dt>
            <dd data-testid="evoker-ally-safety-audit" className="text-rose-200">Not bound ({native.contracts.sculptSpells.allySafety})</dd>
          </div>
          <div>
            <dt className="text-slate-500">Area</dt>
            <dd data-testid="evoker-area-audit" className="text-rose-200">Not bound ({native.contracts.sculptSpells.area})</dd>
          </div>
          <div>
            <dt className="text-slate-500">Saving throw</dt>
            <dd data-testid="evoker-save-audit" className="text-rose-200">Not bound ({native.contracts.sculptSpells.save})</dd>
          </div>
          <div>
            <dt className="text-slate-500">No half damage</dt>
            <dd data-testid="evoker-no-half-damage-audit" className="text-rose-200">Not bound ({native.contracts.sculptSpells.damage})</dd>
          </div>
          <div>
            <dt className="text-slate-500">Potent Cantrip</dt>
            <dd data-testid="evoker-potent-cantrip-audit" className="text-rose-200">Not bound ({native.contracts.potentCantrip.damage}; {native.contracts.potentCantrip.rider})</dd>
          </div>
          <div>
            <dt className="text-slate-500">Native Sculpt Spells ability</dt>
            <dd data-testid="evoker-ability-audit" className="text-rose-200">{native.hasSculptSpellsAbility ? 'Present' : 'Not present'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Native Potent Cantrip ability</dt>
            <dd data-testid="evoker-potent-ability-audit" className="text-rose-200">{native.hasPotentCantripAbility ? 'Present' : 'Not present'}</dd>
          </div>
        </dl>
      </div>

      <p data-testid="evoker-transition-log" className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300">
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'evocation' }); Sculpt Spells metadata is present, but no Evoker spell transaction is claimed."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; Evoker metadata is absent.'}
      </p>

      <p data-testid="evoker-runtime-boundary" className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100">
        {EVOKER_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default EvokerDemo;
