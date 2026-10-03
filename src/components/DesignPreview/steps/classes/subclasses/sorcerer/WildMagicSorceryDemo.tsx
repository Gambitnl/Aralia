// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 15:24:11
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
 * This component demonstrates the canonical Sorcerer Wild Magic Sorcery level-3
 * choice and shows exactly which native combat metadata exists afterward. It exists
 * so the Classes preview can prove the real subclass grants without pretending that
 * generic randomness or unrelated wild-magic text is a subclass runtime.
 *
 * Called by: subclassDemoRegistry.ts through ClassesShell.tsx.
 * Depends on: canonical class/subclass data, production level-up helpers, the quick
 * character fixture, and createPlayerCombatCharacter for the native metadata audit.
 */

// ============================================================================
// Canonical progression and fixture constants
// ============================================================================
// Both checkpoints come from one production quick-character path. The only changed
// choice at level 3 is the canonical Wild Magic Sorcery subclass id.
const SORCERER_ID = 'sorcerer';
const WILD_MAGIC_ID = 'wild_magic';
const LEVEL_THREE_XP = 900;

// Resolve the subclass through both canonical lookup surfaces so a copied label
// cannot make this leaf claim a subclass that production data does not contain.
function requireWildMagicSorcery() {
  const sorcerer = CLASSES_DATA[SORCERER_ID];
  const wildMagic = findSubclass(sorcerer.id, WILD_MAGIC_ID);

  if (!wildMagic || !subclassesForClass(sorcerer.id).some(subclass => subclass.id === wildMagic.id)) {
    throw new Error('Canonical Sorcerer Wild Magic Sorcery subclass is required for this demo.');
  }

  return wildMagic;
}

// ============================================================================
// Deterministic level checkpoints
// ============================================================================
// Build the subclass-free level-2 checkpoint through the production quick-character
// and level-up helpers rather than assembling a preview-only character object.
export function createWildMagicSorceryLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: SORCERER_ID,
    raceId: 'human',
    level: 1,
    name: 'Wild Magic Progression Tester',
    useRecommendedStats: true,
  });

  if (!source) {
    throw new Error('Production quick character assembly failed for the Wild Magic Sorcery demo.');
  }

  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Sorcerer level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

// Apply the explicit canonical Wild Magic Sorcery choice at the level-3 milestone.
export function createWildMagicSorceryLevel3(
  level2: PlayerCharacter = createWildMagicSorceryLevel2(),
): PlayerCharacter {
  const wildMagic = requireWildMagicSorcery();

  if (level2.level !== 2) {
    throw new Error('Wild Magic Sorcery level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: wildMagic.id },
  );

  if (level3.level !== 3 || level3.subclassId !== wildMagic.id) {
    throw new Error('Canonical Sorcerer level-3 progression did not apply Wild Magic Sorcery.');
  }

  return level3;
}

// Read the exact feature objects granted by canonical class and subclass progression.
export function getWildMagicSorceryFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[SORCERER_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Native metadata audit
// ============================================================================
// The production combat conversion is useful here only as an absence check. It
// proves which abilities and resources are actually bound to this subclass without
// turning a generic spell, RNG helper, or plane hazard into a fake Wild Magic action.
export function getWildMagicSorceryNativeAudit(character: PlayerCharacter) {
  const combatCharacter = createPlayerCombatCharacter(character);
  const spellbookIds = [
    ...(character.spellbook?.cantrips ?? []),
    ...(character.spellbook?.knownSpells ?? []),
    ...(character.spellbook?.preparedSpells ?? []),
  ];
  const abilityIds = combatCharacter.abilities.map(ability => ability.id);

  return {
    abilityIds,
    limitedUseIds: Object.keys(character.limitedUses ?? {}),
    spellbookIds,
    hasWildMagicSurgeAbility: abilityIds.includes('wild_magic_surge'),
    hasTidesOfChaosAbility: abilityIds.includes('tides_of_chaos'),
    hasSubclassResource: Object.keys(character.limitedUses ?? {}).some(id =>
      id === 'wild_magic_surge' || id === 'tides_of_chaos',
    ),
  };
}

// The progression and native metadata are complete enough to show the two authored
// feature ids, but the runtime boundary is not complete enough to expose a surge
// button. Keeping this statement precise prevents generic RNG or spell-cast code
// from being presented as a subclass-owned transaction.
export const WILD_MAGIC_SORCERY_RUNTIME_BOUNDARY =
  'Unsupported boundary: canonical Wild Magic Surge and Tides of Chaos feature metadata and level-3 subclass binding are present, but no subclass-bound production transaction currently performs a spell-cast trigger check, deterministic d20 roll, Wild Magic table lookup, effect resolution, Tides advantage application, resource payment, surge replacement, or short/long-rest reset. Generic spell casting, RNG helpers, plane hazards, and unrelated crafting wild-magic outcomes are not Wild Magic Sorcery proof. This demo does not simulate a spell cast, surge roll, table result, effect, advantage, resource, or combat log outcome.';

// ============================================================================
// Wild Magic Sorcery demonstration surface
// ============================================================================
// The UI owns canonical progression, native metadata facts, an explicit missing-data
// boundary, and Reset. It intentionally exposes no fabricated surge or Tides control.
export const WildMagicSorceryDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createWildMagicSorceryLevel2());
  const features = useMemo(() => getWildMagicSorceryFeatures(character), [character]);
  const native = useMemo(() => getWildMagicSorceryNativeAudit(character), [character]);
  const wildMagic = requireWildMagicSorcery();
  const isLevel3 = character.level === 3 && character.subclassId === wildMagic.id;
  const surgeFeature = features.find(feature => feature.id === 'wild_magic_surge');
  const tidesFeature = features.find(feature => feature.id === 'tides_of_chaos');

  // Reset returns to a fresh production-derived level-2 checkpoint.
  const reset = (): void => setCharacter(createWildMagicSorceryLevel2());

  // Rebuild from that checkpoint before applying the explicit subclass choice.
  const chooseWildMagic = (): void => setCharacter(createWildMagicSorceryLevel3());

  return (
    <section
      aria-label="Wild Magic Sorcery progression demonstration"
      data-testid="wild-magic-sorcery-progression-demo"
      className="mt-4 rounded border border-fuchsia-400/40 bg-fuchsia-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Wild Magic Sorcery</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Sorcerer level 2 baseline to the level 3 Wild Magic Sorcery choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Sorcerer / Wild Magic Sorcery
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Wild Magic Sorcery progression controls">
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
          onClick={chooseWildMagic}
          className="rounded border border-fuchsia-300/70 bg-fuchsia-500/10 px-3 py-2 text-xs font-semibold text-fuchsia-100"
        >
          Choose Wild Magic / Level 3
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
          <dd data-testid="wild-magic-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="wild-magic-subclass" className="mt-1 font-semibold text-fuchsia-200">
            {character.subclassId ? wildMagic.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="wild-magic-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-fuchsia-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="wild-magic-grant-status"
        className="mt-3 border-l-2 border-fuchsia-400 pl-2 text-xs leading-relaxed text-fuchsia-100"
      >
        {isLevel3
          ? `Canonical grants present: ${surgeFeature?.id} - ${surgeFeature?.name}; ${tidesFeature?.id} - ${tidesFeature?.name}.`
          : 'Canonical subclass grants absent before the level-3 choice: wild_magic_surge and tides_of_chaos.'}
      </p>

      <div
        data-testid="wild-magic-native-audit"
        className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs"
      >
        <p className="font-semibold text-slate-300">Native combat metadata audit</p>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Subclass-bound surge ability</dt>
            <dd data-testid="wild-magic-surge-audit" className="text-rose-200">
              {native.hasWildMagicSurgeAbility ? 'Present' : 'Not present'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Subclass-bound Tides ability</dt>
            <dd data-testid="wild-magic-tides-audit" className="text-rose-200">
              {native.hasTidesOfChaosAbility ? 'Present' : 'Not present'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Subclass resource</dt>
            <dd data-testid="wild-magic-resource-audit" className="text-rose-200">
              {native.hasSubclassResource ? 'Present' : 'No subclass resource'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Native spellbook entries</dt>
            <dd data-testid="wild-magic-spellbook-audit" className="font-mono text-fuchsia-200">
              {native.spellbookIds.length}
            </dd>
          </div>
        </dl>
      </div>

      <p
        data-testid="wild-magic-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'wild_magic' }); canonical Wild Magic metadata is present, but no surge transaction is claimed."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; Wild Magic metadata is absent.'}
      </p>

      <p
        data-testid="wild-magic-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {WILD_MAGIC_SORCERY_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default WildMagicSorceryDemo;
