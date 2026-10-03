// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 15:37:48
 * Dependents: components/DesignPreview/steps/classes/subclassDemoRegistry.ts
 * Imports: 9 files
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
import { getAbilityModifierValue } from '../../../../../../utils/character/statUtils';
import { createPlayerCombatCharacter } from '../../../../../../utils/combat/combatUtils';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This component demonstrates the canonical Warlock Fiend Patron choice and audits
 * the native Dark One's Blessing wiring without turning generic downing or temporary
 * hit points into a subclass claim. It connects the Classes preview to canonical
 * subclass data, production level-up, and the player-to-combat conversion boundary.
 *
 * Called by: subclassDemoRegistry.ts through ClassesShell.tsx.
 * Depends on: canonical Warlock and Fiend Patron data, production level-up helpers,
 * the quick-character fixture, stat modifiers, and createPlayerCombatCharacter.
 */

// ============================================================================
// Canonical progression and fixture constants
// ============================================================================
// Both checkpoints come from one production-derived character. The explicit Fiend
// choice is the only subclass input added at the level-3 milestone.
const WARLOCK_ID = 'warlock';
const FIEND_ID = 'fiend';
const DARK_ONES_BLESSING_ID = 'dark_ones_blessing';
const LEVEL_THREE_XP = 900;

// Resolve the subclass through both canonical lookup surfaces so copied preview
// text cannot make this leaf claim a feature that production data does not contain.
function requireFiendPatron() {
  const warlock = CLASSES_DATA[WARLOCK_ID];
  const fiend = findSubclass(warlock.id, FIEND_ID);
  const feature = fiend?.features.find(candidate => candidate.id === DARK_ONES_BLESSING_ID);

  if (
    !fiend ||
    !subclassesForClass(warlock.id).some(subclass => subclass.id === fiend.id) ||
    !feature
  ) {
    throw new Error('Canonical Warlock Fiend Patron subclass is required for this demo.');
  }

  return { warlock, fiend, feature };
}

// ============================================================================
// Deterministic level checkpoints
// ============================================================================
// Build the subclass-free level-2 checkpoint through production character creation
// and level-up helpers instead of constructing a preview-only character object.
export function createFiendPatronLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: WARLOCK_ID,
    raceId: 'human',
    level: 1,
    name: 'Fiend Patron Progression Tester',
    useRecommendedStats: true,
  });

  if (!source) {
    throw new Error('Production quick character assembly failed for the Fiend Patron demo.');
  }

  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Warlock level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

// Apply the explicit canonical Fiend Patron choice at the level-3 milestone.
export function createFiendPatronLevel3(
  level2: PlayerCharacter = createFiendPatronLevel2(),
): PlayerCharacter {
  const { fiend } = requireFiendPatron();

  if (level2.level !== 2) {
    throw new Error('Fiend Patron level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: fiend.id },
  );

  if (level3.level !== 3 || level3.subclassId !== fiend.id) {
    throw new Error('Canonical Warlock level-3 progression did not apply Fiend Patron.');
  }

  return level3;
}

// Read the exact feature objects granted by canonical class and subclass progression.
export function getFiendPatronFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[WARLOCK_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Native Dark One's Blessing audit
// ============================================================================
// The combat factory is the authority for patron binding and amount calculation.
// This audit reports the returned field and independently recomputes the source
// formula so a generic temporary-HP field cannot be mistaken for Fiend wiring.
export function getFiendPatronNativeAudit(character: PlayerCharacter) {
  const combatCharacter = createPlayerCombatCharacter(character);
  const level = character.level ?? 1;
  const charismaModifier = getAbilityModifierValue(character.finalAbilityScores.Charisma);
  const expectedTemporaryHitPoints = Math.max(1, charismaModifier + level);

  return {
    combatClassId: combatCharacter.class?.id,
    boundTemporaryHitPoints: combatCharacter.darkOnesBlessingTempHp,
    expectedTemporaryHitPoints,
    formula: `max(1, Charisma modifier ${charismaModifier} + Warlock level ${level})`,
    hasFiendBinding: combatCharacter.darkOnesBlessingTempHp !== undefined,
    formulaMatches:
      combatCharacter.darkOnesBlessingTempHp === expectedTemporaryHitPoints,
    nativeEventBoundary: 'DamageCommand Step 5a: positive target HP -> post-damage 0 HP',
    hasHostileTargetGuard: false,
  };
}

// The native conversion and enemy downing transition are present, but the current
// DamageCommand guard does not verify that the reduced target belongs to the enemy
// team. Because Dark One's Blessing is explicitly an enemy-only feature, this leaf
// withholds a deterministic kill control until that missing guard is repaired.
export const FIEND_PATRON_RUNTIME_BOUNDARY =
  "Unsupported boundary: canonical Fiend Patron binding and Dark One's Blessing amount resolution are present. DamageCommand reaches the subclass hook only when a target moves from positive HP to 0 HP after damage, and it applies non-stacking temporary HP, but the hook does not verify target.team !== caster.team. This demo does not expose a deterministic kill/downing control or claim generic temporary HP, generic downing, or an ally reduction as subclass proof. A future repair must add the hostile-target guard, then prove the native enemy transaction, log, non-stacking replacement, and reset from the production combat state.";

// ============================================================================
// Fiend Patron demonstration surface
// ============================================================================
// The UI owns canonical progression, native binding/formula facts, an explicit event
// gap, and Reset. It intentionally exposes no fabricated kill or temporary-HP button.
export const FiendPatronDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createFiendPatronLevel2());
  const features = useMemo(() => getFiendPatronFeatures(character), [character]);
  const native = useMemo(() => getFiendPatronNativeAudit(character), [character]);
  const { fiend } = requireFiendPatron();
  const isLevel3 = character.level === 3 && character.subclassId === fiend.id;
  const blessingFeature = features.find(feature => feature.id === DARK_ONES_BLESSING_ID);

  // Reset returns to a fresh production-derived level-2 checkpoint with no patron
  // binding, no combat transaction state, and no stale preview outcome.
  const reset = (): void => setCharacter(createFiendPatronLevel2());

  // Rebuild from the baseline before applying the explicit Fiend Patron choice.
  const chooseFiend = (): void => setCharacter(createFiendPatronLevel3());

  return (
    <section
      aria-label="Fiend Patron progression demonstration"
      data-testid="fiend-patron-progression-demo"
      className="mt-4 rounded border border-red-400/40 bg-red-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">
            Canonical progression audit
          </p>
          <h3 className="mt-1 text-base font-semibold">Fiend Patron</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Warlock level 2 baseline to the level 3 Fiend Patron choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Warlock / Fiend Patron
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Fiend Patron progression controls">
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
          onClick={chooseFiend}
          className="rounded border border-red-300/70 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100"
        >
          Choose Fiend / Level 3
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
          <dd data-testid="fiend-patron-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Patron choice</dt>
          <dd data-testid="fiend-patron-subclass" className="mt-1 font-semibold text-red-200">
            {character.subclassId ? fiend.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="fiend-patron-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-red-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="fiend-patron-grant-status"
        className="mt-3 border-l-2 border-red-400 pl-2 text-xs leading-relaxed text-red-100"
      >
        {isLevel3
          ? `Canonical grant present: ${blessingFeature?.id} - ${blessingFeature?.name}.`
          : `Canonical subclass grant absent before the level-3 choice: ${DARK_ONES_BLESSING_ID}.`}
      </p>

      <div
        data-testid="fiend-patron-native-audit"
        className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs"
      >
        <p className="font-semibold text-slate-300">Native Dark One&apos;s Blessing audit</p>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Combat patron binding</dt>
            <dd data-testid="fiend-patron-binding-audit" className="text-red-200">
              {native.hasFiendBinding ? `Present (${native.boundTemporaryHitPoints} temp HP)` : 'Not present'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Amount formula</dt>
            <dd data-testid="fiend-patron-formula-audit" className="font-mono text-red-200">
              {native.formula} = {native.expectedTemporaryHitPoints}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Kill/downing event boundary</dt>
            <dd data-testid="fiend-patron-event-audit" className="text-amber-200">
              {native.nativeEventBoundary}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Hostile target guard</dt>
            <dd data-testid="fiend-patron-hostile-guard-audit" className="text-rose-200">
              {native.hasHostileTargetGuard ? 'Present' : 'Missing'}
            </dd>
          </div>
        </dl>
      </div>

      <p
        data-testid="fiend-patron-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'fiend' }); patron binding is present, but no kill transaction is claimed."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a patron choice; Fiend binding is absent.'}
      </p>

      <p
        data-testid="fiend-patron-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {FIEND_PATRON_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default FiendPatronDemo;
