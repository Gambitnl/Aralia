import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { createPlayerCombatCharacter } from '../../../../../../utils/combat/combatUtils';
import { getAbilityModifierValue } from '../../../../../../utils/character/statUtils';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This component demonstrates the canonical Sorcerer Draconic Sorcery level-3 choice
 * and records the production AC and hit-point conversion that follows it. It exists
 * so the Classes domain can prove Draconic Resilience without inventing an ancestry,
 * elemental damage type, or bonus spell list that the current character model lacks.
 *
 * Called by: subclassDemoRegistry.ts through ClassesShell.tsx.
 * Depends on: canonical class/subclass data, production level-up helpers, the quick
 * character fixture, stat modifiers, and createPlayerCombatCharacter.
 */

// ============================================================================
// Canonical progression and fixture constants
// ============================================================================
// Both checkpoints use one production-derived character so the subclass choice is the
// only changed input when the native combat conversion is compared.
const SORCERER_ID = 'sorcerer';
const DRACONIC_ID = 'draconic';
const LEVEL_THREE_XP = 900;

// Resolve the subclass through both canonical lookup surfaces so a copied preview
// label cannot make the leaf claim a subclass that production data does not contain.
function requireDraconicSorcery() {
  const sorcerer = CLASSES_DATA[SORCERER_ID];
  const draconic = findSubclass(sorcerer.id, DRACONIC_ID);

  if (!draconic || !subclassesForClass(sorcerer.id).some(subclass => subclass.id === draconic.id)) {
    throw new Error('Canonical Sorcerer Draconic Sorcery subclass is required for this demo.');
  }

  return draconic;
}

// ============================================================================
// Deterministic level checkpoints
// ============================================================================
// Build the subclass-free level-2 checkpoint through the production quick character
// and level-up helpers rather than assembling a preview-only character object.
export function createDraconicSorceryLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: SORCERER_ID,
    raceId: 'human',
    level: 1,
    name: 'Draconic Resilience Progression Tester',
    useRecommendedStats: true,
  });

  if (!source) {
    throw new Error('Production quick character assembly failed for the Draconic Sorcery demo.');
  }

  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Sorcerer level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

// Apply the explicit canonical Draconic Sorcery choice at the level-3 milestone.
export function createDraconicSorceryLevel3(
  level2: PlayerCharacter = createDraconicSorceryLevel2(),
): PlayerCharacter {
  const draconic = requireDraconicSorcery();

  if (level2.level !== 2) {
    throw new Error('Draconic Sorcery level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: draconic.id },
  );

  if (level3.level !== 3 || level3.subclassId !== draconic.id) {
    throw new Error('Canonical Sorcerer level-3 progression did not apply Draconic Sorcery.');
  }

  return level3;
}

// Read the exact feature objects granted by canonical class and subclass progression.
export function getDraconicSorceryFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[SORCERER_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Native conversion audit
// ============================================================================
// Return production-derived AC and HP facts plus the fields that would carry an
// ancestry or elemental affinity if this Sorcerer path actually supplied them.
export function getDraconicSorceryNativeAudit(character: PlayerCharacter) {
  const combatCharacter = createPlayerCombatCharacter(character);
  const dexterityModifier = getAbilityModifierValue(character.finalAbilityScores.Dexterity);
  const charismaModifier = getAbilityModifierValue(character.finalAbilityScores.Charisma);
  const expectedDraconicArmorClass = 10 + dexterityModifier + charismaModifier;
  const ancestrySelection = character.racialSelections?.[character.race.id]?.choiceId;

  return {
    characterArmorClass: character.armorClass,
    combatArmorClass: combatCharacter.armorClass,
    combatBaseArmorClass: combatCharacter.baseAC,
    expectedDraconicArmorClass,
    characterMaxHp: character.maxHp,
    combatMaxHp: combatCharacter.maxHP,
    combatMaxHpBonus: combatCharacter.maxHP - character.maxHp,
    characterCurrentHp: character.hp,
    combatCurrentHp: combatCharacter.currentHP,
    combatCurrentHpBonus: combatCharacter.currentHP - character.hp,
    draconicResilienceApplied:
      (character.level ?? 1) >= 3 && character.subclassId === DRACONIC_ID &&
      combatCharacter.armorClass === expectedDraconicArmorClass,
    ancestrySelection,
    elementalAffinity: character.modifiers?.breathWeapon?.damageType,
    resistances: combatCharacter.resistances ?? [],
    spellbookIds: [
      ...(character.spellbook?.cantrips ?? []),
      ...(character.spellbook?.knownSpells ?? []),
      ...(character.spellbook?.preparedSpells ?? []),
    ],
  };
}

// The AC and HP transaction is native, but the current data model has no Draconic
// Sorcery ancestry/elemental-affinity choice and no concrete Draconic Spells list.
// Keeping those gaps visible prevents the preview from turning generic dragon-themed
// prose or Dragonborn data into a false subclass damage mechanic.
export const DRACONIC_SORCERY_RUNTIME_BOUNDARY =
  'Unsupported boundary: native createPlayerCombatCharacter applies Draconic Resilience at level 3+ by deriving unarmored AC as 10 + Dexterity modifier + Charisma modifier and increasing current and maximum HP by the character level. The canonical Draconic Sorcery data does not currently define an ancestry choice, elemental affinity, damage type, or concrete Draconic Spells list, and the production conversion does not add any subclass spellbook entries. This demo does not simulate an elemental damage roll, ancestry selection, resistance, or bonus-spell preparation.';

// ============================================================================
// Draconic Sorcery demonstration surface
// ============================================================================
// The UI owns canonical progression, native AC/HP facts, an explicit missing-data
// boundary, and Reset. It exposes no fabricated ancestry or elemental damage control.
export const DraconicSorceryDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createDraconicSorceryLevel2());
  const features = useMemo(() => getDraconicSorceryFeatures(character), [character]);
  const native = useMemo(() => getDraconicSorceryNativeAudit(character), [character]);
  const draconic = requireDraconicSorcery();
  const isLevel3 = character.level === 3 && character.subclassId === draconic.id;
  const resilienceFeature = features.find(feature => feature.id === 'draconic_resilience');

  // Reset returns to a fresh production-derived level-2 checkpoint.
  const reset = (): void => setCharacter(createDraconicSorceryLevel2());

  // Rebuild from that checkpoint before applying the explicit subclass choice.
  const chooseDraconic = (): void => setCharacter(createDraconicSorceryLevel3());

  return (
    <section
      aria-label="Draconic Sorcery progression demonstration"
      data-testid="draconic-sorcery-progression-demo"
      className="mt-4 rounded border border-red-400/40 bg-red-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Draconic Sorcery</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Sorcerer level 2 baseline to the level 3 Draconic Resilience choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Sorcerer · Draconic Sorcery
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Draconic Sorcery progression controls">
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
          onClick={chooseDraconic}
          className="rounded border border-red-300/70 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100"
        >
          Choose Draconic / Level 3
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
          <dd data-testid="draconic-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="draconic-subclass" className="mt-1 font-semibold text-red-200">
            {character.subclassId ? draconic.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="draconic-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-red-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="draconic-grant-status"
        className="mt-3 border-l-2 border-red-400 pl-2 text-xs leading-relaxed text-red-100"
      >
        {isLevel3
          ? `Canonical grant present: ${resilienceFeature?.id} - ${resilienceFeature?.name}.`
          : 'Canonical subclass grant absent before the level-3 choice: draconic_resilience.'}
      </p>

      <div
        data-testid="draconic-native-audit"
        className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs"
      >
        <p className="font-semibold text-slate-300">Native AC, HP, ancestry, and affinity audit</p>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Persistent AC → combat AC</dt>
            <dd data-testid="draconic-ac-audit" className="font-mono text-red-200">
              {native.characterArmorClass} → {native.combatArmorClass}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Resilience formula</dt>
            <dd data-testid="draconic-resilience-audit" className="text-slate-200">
              {native.draconicResilienceApplied
                ? `Applied: 10 + Dex + Cha = ${native.expectedDraconicArmorClass}`
                : 'Not applied before the explicit level-3 choice'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Persistent max HP → combat max HP</dt>
            <dd data-testid="draconic-hp-audit" className="font-mono text-red-200">
              {native.characterMaxHp} → {native.combatMaxHp} (current {native.combatCurrentHp})
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Ancestry selection</dt>
            <dd data-testid="draconic-ancestry-audit" className="text-rose-200">
              {native.ancestrySelection ?? 'No Sorcerer ancestry selection'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Elemental affinity</dt>
            <dd data-testid="draconic-affinity-audit" className="text-rose-200">
              {native.elementalAffinity ?? 'No subclass-bound affinity'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Native resistances</dt>
            <dd data-testid="draconic-resistance-audit" className="text-rose-200">
              {native.resistances.length > 0 ? native.resistances.join(', ') : 'None from this subclass'}
            </dd>
          </div>
        </dl>
      </div>

      <p
        data-testid="draconic-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'draconic' }); createPlayerCombatCharacter applies native Draconic Resilience."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; Draconic Resilience is absent.'}
      </p>

      <p
        data-testid="draconic-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {DRACONIC_SORCERY_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default DraconicSorceryDemo;
