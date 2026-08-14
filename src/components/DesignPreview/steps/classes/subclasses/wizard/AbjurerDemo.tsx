// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 16:34:28
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
 * This component demonstrates the canonical Wizard Abjurer choice and records the
 * exact Arcane Ward runtime boundary. The Classes preview calls it after the
 * Abjuration subclass is selected; it uses production progression and combat
 * conversion so missing ward mechanics remain visible instead of being simulated.
 */

// ============================================================================
// Canonical progression and requested Arcane Ward contract
// ============================================================================
// The canonical subclass grants Arcane Ward at level 3. These contract fields stay
// separate from production combat state because the current engine has no ward model.
const WIZARD_ID = 'wizard';
const ABJURATION_ID = 'abjuration';
const ARCANE_WARD_ID = 'arcane_ward';
const LEVEL_THREE_XP = 900;

export const ARCANE_WARD_CONTRACT = {
  creation: 'Cast an Abjuration spell with a spell slot to create the ward; it lasts until a Long Rest.',
  hitPoints: 'Ward maximum equals twice Wizard level plus Intelligence modifier.',
  recharge: 'Casting an Abjuration spell with a slot restores twice the slot level; a Bonus Action can expend a slot to restore the same amount.',
  damageAbsorption: 'The ward takes damage first after Resistance or Vulnerability; overflow damage reaches the Abjurer.',
  reset: 'After creation, the ward cannot be created again until a Long Rest.',
} as const;

// Resolve the canonical record through both lookup surfaces before rendering any
// subclass claim. A copied label must never stand in for missing production data.
function requireAbjurer() {
  const wizard = CLASSES_DATA[WIZARD_ID];
  const abjurer = findSubclass(wizard.id, ABJURATION_ID);
  const arcaneWard = abjurer?.features.find(feature => feature.id === ARCANE_WARD_ID);

  if (
    !abjurer ||
    abjurer.name !== 'Abjurer (School of Abjuration)' ||
    !subclassesForClass(wizard.id).some(subclass => subclass.id === abjurer.id) ||
    !arcaneWard
  ) {
    throw new Error('Canonical Wizard Abjurer subclass is required for this demo.');
  }

  return { wizard, abjurer, arcaneWard };
}

// ============================================================================
// Deterministic level checkpoints
// ============================================================================
// Build the subclass-free level-2 checkpoint through the production character
// assembler and level-up helper rather than a preview-only character object.
export function createAbjurerLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: WIZARD_ID,
    raceId: 'human',
    level: 1,
    name: 'Abjurer Progression Tester',
    useRecommendedStats: true,
  });

  if (!source) {
    throw new Error('Production quick character assembly failed for the Abjurer demo.');
  }

  // XP only makes the next transition eligible; performLevelUp owns level state.
  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Wizard level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

// Apply the explicit canonical Abjurer choice at the level-3 milestone.
export function createAbjurerLevel3(
  level2: PlayerCharacter = createAbjurerLevel2(),
): PlayerCharacter {
  const { abjurer } = requireAbjurer();

  if (level2.level !== 2) {
    throw new Error('Abjurer level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: abjurer.id },
  );

  if (level3.level !== 3 || level3.subclassId !== abjurer.id) {
    throw new Error('Canonical Wizard level-3 progression did not apply Abjurer.');
  }

  return level3;
}

// Read the exact feature objects granted by canonical class and subclass progression.
export function getAbjurerFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[WIZARD_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Native Arcane Ward audit
// ============================================================================
// The production combat conversion is an absence check. It proves that the
// subclass does not currently expose an executable ward ability, resource, state,
// spell-triggered recharge, or damage interception hook.
export function getAbjurerNativeAudit(character: PlayerCharacter) {
  const combatCharacter = createPlayerCombatCharacter(character);
  const abilityIds = combatCharacter.abilities.map(ability => ability.id);
  const limitedUseIds = Object.keys(character.limitedUses ?? {});
  const combatRecord = combatCharacter as unknown as Record<string, unknown>;
  const hasNativeWardState = ['arcaneWardHp', 'arcaneWardMaxHp', 'arcaneWardRecharge'].some(
    key => key in combatRecord,
  );

  return {
    combatClassId: combatCharacter.class?.id,
    abilityIds,
    limitedUseIds,
    genericTemporaryHitPoints: combatCharacter.tempHP,
    hasArcaneWardAbility: abilityIds.includes(ARCANE_WARD_ID),
    hasArcaneWardResource: limitedUseIds.includes(ARCANE_WARD_ID),
    hasNativeWardState,
    hasAbjurationSpellRecharge: false,
    hasDamageAbsorptionHook: false,
    contracts: ARCANE_WARD_CONTRACT,
  };
}

// Generic temporary hit points and generic spell casting do not prove Arcane Ward.
// The requested transaction remains metadata until production state and resolvers
// can create, recharge, absorb, and reset a ward with the rules below.
export const ABJURER_RUNTIME_BOUNDARY =
  'Unsupported boundary: canonical Wizard Abjurer (School of Abjuration) progression grants arcane_ward (Arcane Ward), but the production player-to-combat conversion exposes no subclass-bound Arcane Ward ability, resource, ward HP state, Abjuration-spell recharge, or damage absorption hook. Generic temporary hit points are not Arcane Ward proof. The requested creation contract—an Abjuration spell cast with a spell slot creates a ward lasting until a Long Rest, with maximum HP equal to twice Wizard level plus Intelligence modifier—the recharge contract—an Abjuration spell with a slot restores twice the slot level, with a Bonus Action slot spend as an alternative—and the damage contract—Resistance or Vulnerability applies before the ward absorbs damage and overflow reaches the Abjurer—remain metadata only. This demo exposes progression and native absence; it does not simulate spell casting, ward HP, recharge, damage absorption, or Long Rest reset.';

// ============================================================================
// Abjurer demonstration surface
// ============================================================================
// The UI owns canonical progression, native absence facts, the exact ward gap, and
// Reset. It never turns generic temporary HP into a fabricated ward transaction.
export const AbjurerDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createAbjurerLevel2());
  const features = useMemo(() => getAbjurerFeatures(character), [character]);
  const native = useMemo(() => getAbjurerNativeAudit(character), [character]);
  const { abjurer } = requireAbjurer();
  const isLevel3 = character.level === 3 && character.subclassId === abjurer.id;
  const arcaneWardFeature = features.find(feature => feature.id === ARCANE_WARD_ID);

  // Reset returns to a fresh production-derived level-2 checkpoint with no stale
  // subclass choice or native audit state.
  const reset = (): void => setCharacter(createAbjurerLevel2());

  // Rebuild from the baseline before applying the explicit Abjurer choice.
  const chooseAbjurer = (): void => setCharacter(createAbjurerLevel3());

  return (
    <section
      aria-label="Abjurer (School of Abjuration) progression demonstration"
      data-testid="abjurer-progression-demo"
      className="mt-4 rounded border border-sky-400/40 bg-sky-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">
            Canonical progression audit
          </p>
          <h3 className="mt-1 text-base font-semibold">Abjurer (School of Abjuration)</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Wizard level 2 baseline to the level 3 Abjurer choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Wizard / Abjuration
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Abjurer progression controls">
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
          onClick={chooseAbjurer}
          className="rounded border border-sky-300/70 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100"
        >
          Choose Abjurer / Level 3
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
          <dd data-testid="abjurer-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="abjurer-subclass" className="mt-1 font-semibold text-sky-200">
            {character.subclassId ? abjurer.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="abjurer-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-sky-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p data-testid="abjurer-grant-status" className="mt-3 border-l-2 border-sky-400 pl-2 text-xs leading-relaxed text-sky-100">
        {isLevel3
          ? `Canonical grant present: ${arcaneWardFeature?.id} - ${arcaneWardFeature?.name}.`
          : `Canonical subclass grant absent before the level-3 choice: ${ARCANE_WARD_ID}.`}
      </p>

      <div data-testid="abjurer-native-audit" className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs">
        <p className="font-semibold text-slate-300">Arcane Ward contract audit</p>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div><dt className="text-slate-500">Creation</dt><dd data-testid="abjurer-creation-audit" className="text-rose-200">Not bound ({native.contracts.creation})</dd></div>
          <div><dt className="text-slate-500">Ward HP</dt><dd data-testid="abjurer-hp-audit" className="text-rose-200">Not bound ({native.contracts.hitPoints})</dd></div>
          <div><dt className="text-slate-500">Abjuration recharge</dt><dd data-testid="abjurer-recharge-audit" className="text-rose-200">Not bound ({native.contracts.recharge})</dd></div>
          <div><dt className="text-slate-500">Damage absorption</dt><dd data-testid="abjurer-absorption-audit" className="text-rose-200">Not bound ({native.contracts.damageAbsorption})</dd></div>
          <div><dt className="text-slate-500">Long Rest reset</dt><dd data-testid="abjurer-reset-audit" className="text-rose-200">Not bound ({native.contracts.reset})</dd></div>
          <div><dt className="text-slate-500">Native Arcane Ward ability</dt><dd data-testid="abjurer-ability-audit" className="text-rose-200">{native.hasArcaneWardAbility ? 'Present' : 'Not present'}</dd></div>
          <div><dt className="text-slate-500">Native Arcane Ward resource</dt><dd data-testid="abjurer-resource-audit" className="text-rose-200">{native.hasArcaneWardResource ? 'Present' : 'Not present'}</dd></div>
          <div><dt className="text-slate-500">Native ward state</dt><dd data-testid="abjurer-state-audit" className="text-rose-200">{native.hasNativeWardState ? 'Present' : 'Not present'}</dd></div>
          <div><dt className="text-slate-500">Generic temporary hit points</dt><dd data-testid="abjurer-temp-hp-audit" className="text-slate-300">{native.genericTemporaryHitPoints ?? 'None; not Arcane Ward proof'}</dd></div>
        </dl>
      </div>

      <p data-testid="abjurer-transition-log" className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300">
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'abjuration' }); Arcane Ward metadata is present, but no ward transaction is claimed."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; Abjurer metadata is absent.'}
      </p>

      <p data-testid="abjurer-runtime-boundary" className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100">
        {ABJURER_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default AbjurerDemo;
