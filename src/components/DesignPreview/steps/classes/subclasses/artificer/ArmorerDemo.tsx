// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 */
// @dependencies-end

import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { createPlayerCombatCharacter } from '../../../../../../utils/combat/combatUtils';
import { getCharacterMaxArmorProficiency, performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This file demonstrates the canonical Artificer Armorer level-3 choice and audits
 * the exact boundary between the Arcane Armor feature text and executable combat.
 * The Classes preview mounts this leaf after Armorer is selected. It uses production
 * character assembly, level-up, and player-to-combat conversion so generic armor and
 * weapon facts cannot be mistaken for Guardian or Infiltrator runtime.
 */

// ============================================================================
// Canonical progression and Armorer model contract
// ============================================================================
// These constants identify the source-authored class, subclass, and feature that this
// leaf is allowed to claim. The model details stay metadata until a production
// resolver owns the equipment bond, model attacks, resource, and reset lifecycle.
const ARTIFICER_ID = 'artificer';
const ARMORER_ID = 'armorer';
const ARCANE_ARMOR_ID = 'arcane_armor';
const LEVEL_THREE_XP = 900;

export type ArmorerModel = 'guardian' | 'infiltrator';

export const ARCANE_ARMOR_CONTRACT = {
  armor: 'Turn a suit of armor you are wearing into Arcane Armor as an action while holding smiths tools.',
  heavyArmor: 'Gain proficiency with heavy armor at the Armorer level-3 choice.',
  spellcastingFocus: 'Use the Arcane Armor as a spellcasting focus for Artificer spells.',
  donDoff: 'Arcane Armor attaches to you, ignores its Strength requirement, and can be donned or doffed as an action.',
  guardian: {
    name: 'Guardian',
    attack: 'Thunder Gauntlets are melee weapon attacks that deal 1d8 thunder damage and mark a hit creature against attacks on other targets until your next turn.',
    defensiveField: 'Defensive Field is a bonus action that grants temporary hit points equal to your proficiency bonus.',
    resource: 'Defensive Field has a number of uses equal to your proficiency bonus and refreshes on a Long Rest.',
  },
  infiltrator: {
    name: 'Infiltrator',
    attack: 'Lightning Launcher is a ranged weapon attack with 90/300 range, 1d6 lightning damage, and one extra 1d6 hit each turn.',
    stealth: 'Powered Steps increases walking speed by 5 feet and grants advantage on Stealth checks.',
  },
  reset: 'A Long Rest restores the Armorer model resource; the Arcane Armor bond ends when another suit is donned or the Armorer dies.',
} as const;

// Resolve the source-authored subclass and feature through canonical lookup helpers.
// A copied label or generic armor item is not proof of a subclass grant.
function requireArmorer() {
  const artificer = CLASSES_DATA[ARTIFICER_ID];
  const armorer = findSubclass(artificer.id, ARMORER_ID);
  const arcaneArmor = armorer?.features.find(feature => feature.id === ARCANE_ARMOR_ID);

  if (
    !armorer ||
    armorer.name !== 'Armorer' ||
    !subclassesForClass(artificer.id).some(subclass => subclass.id === armorer.id) ||
    !arcaneArmor
  ) {
    throw new Error('Canonical Artificer Armorer subclass is required for this demo.');
  }

  return { artificer, armorer, arcaneArmor };
}

// ============================================================================
// Deterministic level checkpoints
// ============================================================================
// Build the subclass-free level-2 checkpoint with the production quick-character
// assembler. The level-up helper remains the authority for the milestone transition.
export function createArmorerLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: ARTIFICER_ID,
    raceId: 'human',
    level: 1,
    name: 'Armorer Progression Tester',
    useRecommendedStats: true,
  });

  if (!source) {
    throw new Error('Production quick character assembly failed for the Armorer demo.');
  }

  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Artificer level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

// Apply the explicit canonical Armorer choice at the level-3 milestone.
export function createArmorerLevel3(
  level2: PlayerCharacter = createArmorerLevel2(),
): PlayerCharacter {
  const { armorer } = requireArmorer();

  if (level2.level !== 2) {
    throw new Error('Armorer level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: armorer.id },
  );

  if (level3.level !== 3 || level3.subclassId !== armorer.id) {
    throw new Error('Canonical Artificer level-3 progression did not apply Armorer.');
  }

  return level3;
}

// Read the exact base, tier-one, and subclass features granted at this checkpoint.
export function getArmorerFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[ARTIFICER_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Native Arcane Armor audit
// ============================================================================
// Conversion is used as an absence check. Generic worn armor, generic weapon
// attacks, and the base Artificer proficiency list are reported separately from
// subclass-owned mechanics so the rendered leaf cannot overclaim completion.
export function getArmorerNativeAudit(
  character: PlayerCharacter,
  model: ArmorerModel = 'guardian',
) {
  const combatCharacter = createPlayerCombatCharacter(character);
  const abilityIds = combatCharacter.abilities.map(ability => ability.id);
  const limitedUseIds = Object.keys(character.limitedUses ?? {});
  const combatRecord = combatCharacter as unknown as Record<string, unknown>;
  const nativeStateKeys = Object.keys(combatRecord).filter(key =>
    /arcane|armorer|guardian|infiltrator|thunder|lightning|defensive|powered|stealth/i.test(key),
  );
  const armorProficiencies = combatCharacter.class.armorProficiencies;
  const hasGenericWeaponAttack = abilityIds.some(id => id.startsWith('attack_'));

  return {
    model,
    combatClassId: combatCharacter.class?.id,
    abilityIds,
    limitedUseIds,
    nativeStateKeys,
    armorProficiencies,
    maxArmorProficiency: getCharacterMaxArmorProficiency(character),
    hasGenericWornArmor: Boolean(combatCharacter.equipment?.wornArmor),
    hasGenericWeaponAttack,
    hasHeavyArmorProficiency: armorProficiencies.some(proficiency => /heavy|all armor/i.test(proficiency)),
    hasArcaneArmorAbility: abilityIds.includes(ARCANE_ARMOR_ID),
    hasGuardianWeaponAttack: abilityIds.includes('thunder_gauntlets'),
    hasInfiltratorWeaponAttack: abilityIds.includes('lightning_launcher'),
    hasDefensiveFieldAbility: abilityIds.includes('defensive_field'),
    hasGuardianTempHpPath: typeof combatCharacter.tempHP === 'number' || nativeStateKeys.some(key => /defensive|guardian/i.test(key)),
    hasInfiltratorStealthPath: combatCharacter.modifiers?.advantage?.some(entry => /stealth/i.test(entry)) ?? false,
    hasArcaneArmorState: nativeStateKeys.some(key => /arcane|armorer/i.test(key)),
    hasDonDoffResolver: false,
    hasModelResource: limitedUseIds.some(id => /armorer|defensive_field|arcane_armor/i.test(id)),
    hasLongRestResetResolver: false,
    genericEquipmentOrWeaponProof: false,
    contracts: ARCANE_ARMOR_CONTRACT,
  };
}

// The production boundary is intentionally explicit. The existing equipment and
// attack systems can show ordinary armor and weapons, but neither one models the
// bonded Arcane Armor state or either subclass combat model.
export const ARMORER_RUNTIME_BOUNDARY =
  'Unsupported boundary: canonical Artificer Armorer progression grants arcane_armor (Arcane Armor), but production conversion exposes no Arcane Armor ability or bonded state, heavy armor proficiency grant, Guardian Thunder Gauntlets attack, Guardian Defensive Field temporary-hit-point path, Infiltrator Lightning Launcher attack, Powered Steps speed or Stealth advantage, don/doff resolver, model resource ownership, or Long Rest reset. Generic worn armor, generic weapon attacks, base medium armor and simple-weapon proficiency, generic temporary hit points, and generic Stealth helpers are not Armorer proof. The Guardian and Infiltrator model contracts remain metadata only; this demo exposes exact progression and native absence without simulating armor conversion, model attacks, marking, temporary hit points, stealth, resource payment, don/doff, or reset.';

// ============================================================================
// Armorer demonstration surface
// ============================================================================
// The UI owns canonical progression, model metadata, the native audit, and Reset.
// Model buttons only select which authored contract is displayed; they do not cast,
// attack, grant temporary hit points, alter Stealth, spend resources, or equip armor.
export const ArmorerDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createArmorerLevel2());
  const [model, setModel] = useState<ArmorerModel>('guardian');
  const features = useMemo(() => getArmorerFeatures(character), [character]);
  const native = useMemo(() => getArmorerNativeAudit(character, model), [character, model]);
  const { armorer } = requireArmorer();
  const isLevel3 = character.level === 3 && character.subclassId === armorer.id;
  const arcaneArmorFeature = features.find(feature => feature.id === ARCANE_ARMOR_ID);
  const selectedModel = ARCANE_ARMOR_CONTRACT[model];

  // Reset returns to a fresh production-derived level-2 checkpoint and Guardian as
  // the deterministic metadata default.
  const reset = (): void => {
    setCharacter(createArmorerLevel2());
    setModel('guardian');
  };

  // Rebuild from the baseline before applying the explicit Armorer choice.
  const chooseArmorer = (): void => {
    setCharacter(createArmorerLevel3());
  };

  return (
    <section
      aria-label="Armorer progression demonstration"
      data-testid="armorer-progression-demo"
      className="mt-4 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Canonical progression audit
          </p>
          <h3 className="mt-1 text-base font-semibold">Armorer</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Artificer level 2 baseline to the level 3 Armorer choice and model contract.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Artificer / Armorer
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Armorer progression controls">
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
          onClick={chooseArmorer}
          className="rounded border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
        >
          Choose Armorer / Level 3
        </Button>
        <Button
          type="button"
          variant={model === 'guardian' ? 'action' : 'ghost'}
          size="sm"
          aria-pressed={model === 'guardian'}
          onClick={() => setModel('guardian')}
          className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"
        >
          Guardian model
        </Button>
        <Button
          type="button"
          variant={model === 'infiltrator' ? 'action' : 'ghost'}
          size="sm"
          aria-pressed={model === 'infiltrator'}
          onClick={() => setModel('infiltrator')}
          className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"
        >
          Infiltrator model
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

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Level</dt>
          <dd data-testid="armorer-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="armorer-subclass" className="mt-1 font-semibold text-amber-200">
            {character.subclassId ? armorer.name : 'None yet'}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Model metadata</dt>
          <dd data-testid="armorer-model" className="mt-1 font-semibold text-amber-200">
            {selectedModel.name}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="armorer-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-amber-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p data-testid="armorer-grant-status" className="mt-3 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-amber-100">
        {isLevel3
          ? `Canonical grant present: ${arcaneArmorFeature?.id} - ${arcaneArmorFeature?.name}. ${selectedModel.name} remains metadata-only.`
          : `Canonical subclass grant absent before the level-3 choice: ${ARCANE_ARMOR_ID}.`}
      </p>

      <div data-testid="armorer-native-audit" className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs">
        <p className="font-semibold text-slate-300">Arcane Armor native audit</p>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div><dt className="text-slate-500">Base armor proficiency</dt><dd data-testid="armorer-armor-proficiency-audit" className="text-rose-200">{native.maxArmorProficiency} ({native.armorProficiencies.join(', ')})</dd></div>
          <div><dt className="text-slate-500">Heavy armor grant</dt><dd data-testid="armorer-heavy-armor-audit" className="text-rose-200">{native.hasHeavyArmorProficiency ? 'Present' : 'Not bound'}</dd></div>
          <div><dt className="text-slate-500">Arcane Armor state</dt><dd data-testid="armorer-arcane-state-audit" className="text-rose-200">{native.hasArcaneArmorState ? 'Present' : 'Not bound'}</dd></div>
          <div><dt className="text-slate-500">{selectedModel.name} attack</dt><dd data-testid="armorer-model-attack-audit" className="text-rose-200">{model === 'guardian' ? (native.hasGuardianWeaponAttack ? 'Present' : 'Thunder Gauntlets not bound') : (native.hasInfiltratorWeaponAttack ? 'Present' : 'Lightning Launcher not bound')}</dd></div>
          <div><dt className="text-slate-500">Guardian temporary HP</dt><dd data-testid="armorer-temp-hp-audit" className="text-rose-200">{native.hasGuardianTempHpPath ? 'Present' : 'Not bound'}</dd></div>
          <div><dt className="text-slate-500">Infiltrator Stealth</dt><dd data-testid="armorer-stealth-audit" className="text-rose-200">{native.hasInfiltratorStealthPath ? 'Present' : 'Not bound'}</dd></div>
          <div><dt className="text-slate-500">Don/doff resolver</dt><dd data-testid="armorer-don-doff-audit" className="text-rose-200">{native.hasDonDoffResolver ? 'Present' : 'Not bound'}</dd></div>
          <div><dt className="text-slate-500">Model resource/reset</dt><dd data-testid="armorer-resource-reset-audit" className="text-rose-200">{native.hasModelResource && native.hasLongRestResetResolver ? 'Present' : 'Not bound'}</dd></div>
          <div><dt className="text-slate-500">Generic equipment proof</dt><dd data-testid="armorer-generic-audit" className="text-rose-200">{native.genericEquipmentOrWeaponProof ? 'Accepted' : 'Rejected as proof'}</dd></div>
        </dl>
      </div>

      <p data-testid="armorer-transition-log" className="mt-3 text-xs text-slate-400">
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'armorer' }); Arcane Armor and the selected model remain metadata-only."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; Armorer metadata is absent.'}
      </p>

      <p data-testid="armorer-runtime-boundary" className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100">
        {ARMORER_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default ArmorerDemo;
