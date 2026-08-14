// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 18:31:11
 * Dependents: None (Orphan)
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState } from 'react';
import { CLASSES_DATA } from '../../../../../data/classes';
import { buildRacialTraitLibrary, getRacialModifierBucketsFromTraitText } from '../../../../../data/races/racialTraits';
import { applyRacialSpellGrantsByLevel, resolveRacialResourceId } from '../../../../../utils/character/characterUtils';
import { createPlayerCombatCharacter } from '../../../../../utils/combat/combatUtils';
import { calculateProficiencyBonus, rollSavingThrow, type SavingThrowResult } from '../../../../../utils/character/savingThrowUtils';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { PlayerCharacter, Race } from '../../../../../types';
import type { SavingThrowAbility } from '../../../../../types/spellEffectTypes';
import type { CombatCharacter } from '../../../../../types/combat';
import type { RaceDomainLeafProps, RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file gives the canonical Forest Gnome race one deterministic Gnomish
 * Cunning saving-throw transaction in the Tactical Sandbox Race domain.
 *
 * It assembles a real player actor, applies the production racial parser, turns
 * that actor into the combat save context, and calls the shared saving-throw and
 * dice helpers. The UI also reports Darkvision, Natural Illusionist, and Speak
 * with Animals as canonical facts; it does not pretend to run sensing or spells.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Forest Gnome data, production character assembly,
 * racial parsing, createPlayerCombatCharacter, rollSavingThrow, rollDice through
 * that helper, and the shared Race domain contract.
 */

// ============================================================================
// Canonical Forest Gnome Facts And Parser Identity
// ============================================================================
// These names keep the leaf tied to the active race record and the stable
// resource key produced by the racial parser. The scenario refuses to resolve
// if the canonical text no longer describes the rule being demonstrated.
// ============================================================================

export const FOREST_GNOME_GNOMISH_CUNNING_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'forest_gnome__speak_with_animals__resource',
);
export const FOREST_GNOME_ACTOR_ID = 'forest-gnome-gnomish-cunning-actor';
export const FOREST_GNOME_SCENARIO_LEVEL = 5;
export const FOREST_GNOME_SAVE_DC = 12;

const FOREST_GNOME_VISION_TRAIT = 'Vision';
const FOREST_GNOME_CUNNING_TRAIT = 'Gnomish Cunning';
const FOREST_GNOME_ILLUSIONIST_TRAIT = 'Natural Illusionist';
const FOREST_GNOME_ANIMALS_TRAIT = 'Speak with Animals';
const FOREST_GNOME_SAVE_ABILITIES: readonly SavingThrowAbility[] = [
  'Intelligence',
  'Wisdom',
  'Charisma',
];

/** Find one named trait in the supplied canonical race without copying its rule text. */
export function getCanonicalForestGnomeTrait(race: Race, traitName: string): string | null {
  return race.traits.find(trait => trait.trim().startsWith(`${traitName}:`)) ?? null;
}

/** Confirm that every fact used by this leaf is still present in canonical data. */
export function hasCanonicalForestGnomeFeatures(race: Race): boolean {
  const vision = getCanonicalForestGnomeTrait(race, FOREST_GNOME_VISION_TRAIT);
  const cunning = getCanonicalForestGnomeTrait(race, FOREST_GNOME_CUNNING_TRAIT);
  const illusionist = getCanonicalForestGnomeTrait(race, FOREST_GNOME_ILLUSIONIST_TRAIT);
  const animals = getCanonicalForestGnomeTrait(race, FOREST_GNOME_ANIMALS_TRAIT);

  return race.id === 'forest_gnome'
    && !!vision
    && /darkvision/i.test(vision)
    && /60 feet/i.test(vision)
    && !!cunning
    && /advantage/i.test(cunning)
    && /Intelligence, Wisdom, and Charisma saving throws/i.test(cunning)
    && !!illusionist
    && /Minor Illusion/i.test(illusionist)
    && /Intelligence, Wisdom, or Charisma/i.test(illusionist)
    && !!animals
    && /Speak with Animals/i.test(animals)
    && /Proficiency Bonus/i.test(animals)
    && /Long Rest/i.test(animals)
    && /Intelligence, Wisdom, or Charisma/i.test(animals);
}

/** Read a parser-created Forest Gnome resource from the persistent actor. */
export function getForestGnomeSpeakWithAnimalsResource(actor: PlayerCharacter | null) {
  return actor?.limitedUses?.[FOREST_GNOME_GNOMISH_CUNNING_RESOURCE_ID];
}

/** Check the parser's readable advantage projection for the three mental saves. */
export function hasForestGnomeCunningAdvantage(actor: PlayerCharacter | null): boolean {
  return actor?.modifiers?.advantage.some(modifier => (
    /intelligence/i.test(modifier)
    && /wisdom/i.test(modifier)
    && /charisma/i.test(modifier)
    && /saving throw/i.test(modifier)
  )) ?? false;
}

// ============================================================================
// Production Actor Assembly And Paired Save Transaction
// ============================================================================
// The scenario starts with the normal quick-character seam and applies the
// canonical racial parser. A fallback actor exists only for a preview module
// graph that cannot resolve the generic factory; it carries the same canonical
// race into the same parser and combat conversion, rather than inventing a
// separate save resolver.
// ============================================================================

const FOREST_GNOME_ACTOR_CONFIG = {
  name: 'Forest Gnome Gnomish Cunning Tester',
  raceId: 'forest_gnome',
  classId: 'fighter',
  level: FOREST_GNOME_SCENARIO_LEVEL,
  stats: [10, 10, 10, 16, 14, 12] as [number, number, number, number, number, number],
};

function createForestGnomeAdapterActor(race: Race): PlayerCharacter | null {
  // This adapter is only a context bridge when quick-character discovery is
  // unavailable. The canonical race, parser, combat conversion, and save
  // engine remain authoritative; no racial advantage is inserted here.
  const fighter = CLASSES_DATA.fighter;
  if (!fighter) return null;

  return {
    id: `${FOREST_GNOME_ACTOR_ID}-adapter`,
    name: 'Forest Gnome Gnomish Cunning Tester',
    level: FOREST_GNOME_SCENARIO_LEVEL,
    proficiencyBonus: calculateProficiencyBonus(FOREST_GNOME_SCENARIO_LEVEL),
    race,
    class: fighter,
    classLevels: { [fighter.id]: FOREST_GNOME_SCENARIO_LEVEL },
    abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 16, Wisdom: 14, Charisma: 12 },
    finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 16, Wisdom: 14, Charisma: 12 },
    skills: [],
    savingThrowProficiencies: fighter.savingThrowProficiencies,
    hp: 28,
    maxHp: 28,
    armorClass: 10,
    speed: 30,
    darkvisionRange: 60,
    transportMode: 'foot',
    spellbook: { cantrips: [], knownSpells: [], preparedSpells: [] },
    statusEffects: [],
    equippedItems: {},
    modifiers: { advantage: [], disadvantage: [], bonuses: [], skillProficiencies: [], weaponProficiencies: [], armorProficiencies: [] },
  };
}

/** Remove glossary link wrappers so the shared text parser can read canonical prose. */
function normalizeCanonicalTraitForParser(trait: string): string {
  return trait.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1');
}

export interface ForestGnomeSaveResolution {
  ability: SavingThrowAbility;
  advantaged: SavingThrowResult;
  ordinary: SavingThrowResult;
  d20Faces: readonly number[];
}

export interface ForestGnomeScenarioState {
  actor: PlayerCharacter | null;
  combatActor: CombatCharacter | null;
  ordinaryCombatActor: CombatCharacter | null;
  failureReason: ForestGnomeScenarioFailure | null;
  outcome: string;
  lastResolution: ForestGnomeSaveResolution | null;
}

type ForestGnomeScenarioFailure = 'canonical_trait_missing' | 'assembly_unavailable' | 'advantage_projection_missing' | 'resource_unavailable';

function unavailableForestGnomeScenario(
  reason: ForestGnomeScenarioFailure,
  outcome: string,
): ForestGnomeScenarioState {
  // Keep failure explicit so the UI cannot display a plausible result when the
  // canonical parser or actor context is not available.
  return {
    actor: null,
    combatActor: null,
    ordinaryCombatActor: null,
    failureReason: reason,
    outcome,
    lastResolution: null,
  };
}

/** Build the parsed player and two combat contexts used by the paired proof. */
export function createForestGnomeGnomishCunningScenario(race: Race): ForestGnomeScenarioState {
  if (!hasCanonicalForestGnomeFeatures(race)) {
    return unavailableForestGnomeScenario(
      'canonical_trait_missing',
      'Gnomish Cunning unavailable: canonical Forest Gnome facts do not contain the demonstrated rule set.',
    );
  }

  const parserRace: Race = {
    ...race,
    traits: race.traits.map(normalizeCanonicalTraitForParser),
  };
  const canonicalTraitLibrary = buildRacialTraitLibrary({ [race.id]: parserRace });
  const canonicalCunning = canonicalTraitLibrary.byRaceId[race.id]?.find(trait => (
    trait.type !== 'spell' && trait.traitName === FOREST_GNOME_CUNNING_TRAIT
  ));
  const canonicalCunningText = getCanonicalForestGnomeTrait(race, FOREST_GNOME_CUNNING_TRAIT);
  const canonicalCunningBuckets = getRacialModifierBucketsFromTraitText(
    normalizeCanonicalTraitForParser(canonicalCunningText ?? ''),
  );
  const canonicalSpeakWithAnimals = canonicalTraitLibrary.byRaceId[race.id]?.find(trait => (
    trait.type !== 'spell' && trait.traitName === FOREST_GNOME_ANIMALS_TRAIT
  ));
  const canonicalSpeakResource = canonicalSpeakWithAnimals?.type !== 'spell'
    ? canonicalSpeakWithAnimals?.resources?.[0]
    : undefined;
  if (canonicalCunning?.type === 'spell' || !canonicalCunningBuckets.advantage.length) {
    return unavailableForestGnomeScenario(
      'canonical_trait_missing',
      'Gnomish Cunning unavailable: the canonical racial parser did not expose its mental-save advantage.',
    );
  }
  if (!canonicalSpeakResource) {
    return unavailableForestGnomeScenario(
      'resource_unavailable',
      'Gnomish Cunning unavailable: the canonical racial parser did not expose Speak with Animals usage.',
    );
  }

  const quickCharacter = createQuickCharacter(FOREST_GNOME_ACTOR_CONFIG);
  const baseCharacter = quickCharacter ?? createForestGnomeAdapterActor(race);
  if (!baseCharacter) {
    return unavailableForestGnomeScenario(
      'assembly_unavailable',
      'Gnomish Cunning unavailable: production character assembly and its narrow context adapter both rejected Forest Gnome.',
    );
  }

  // The racial parser supplies both the save modifier and Speak with Animals
  // resource. The leaf does not duplicate either rule in its runtime actor.
  const parsedCharacterBase = applyRacialSpellGrantsByLevel({ ...baseCharacter, race }, FOREST_GNOME_SCENARIO_LEVEL);
  // DEBT: The generic parser currently sees glossary-linked `[[advantage]]` as
  // plain text and therefore misses this one modifier. Normalize only the
  // canonical sentence and merge its parsed bucket; the resource parser,
  // actor conversion, save resolver, and dice engine remain production paths.
  const canonicalResourceMax = canonicalSpeakResource.maxUses === 'proficiency_bonus'
    ? calculateProficiencyBonus(FOREST_GNOME_SCENARIO_LEVEL)
    : canonicalSpeakResource.maxUses;
  const canonicalResourceKey = resolveRacialResourceId('feature', canonicalSpeakResource.id);
  const parsedCharacter: PlayerCharacter = {
    ...parsedCharacterBase,
    // DEBT: The generic global trait-library cache still reads linked canonical
    // text, so it misses this resource. Use the same production parser above
    // on normalized canonical text and merge only its resulting resource.
    limitedUses: {
      ...(parsedCharacterBase.limitedUses ?? {}),
      [canonicalResourceKey]: {
        ...(parsedCharacterBase.limitedUses?.[canonicalResourceKey] ?? {}),
        name: `${race.name}: ${FOREST_GNOME_ANIMALS_TRAIT}`,
        current: parsedCharacterBase.limitedUses?.[canonicalResourceKey]?.current ?? canonicalResourceMax,
        max: canonicalSpeakResource.maxUses,
        resetOn: canonicalSpeakResource.resetOn,
      },
    },
    modifiers: {
      ...(parsedCharacterBase.modifiers ?? { advantage: [], disadvantage: [], bonuses: [] }),
      advantage: Array.from(new Set([
        ...(parsedCharacterBase.modifiers?.advantage ?? []),
        ...canonicalCunningBuckets.advantage,
      ])),
    },
  };
  const resource = getForestGnomeSpeakWithAnimalsResource(parsedCharacter);
  if (!resource) {
    return unavailableForestGnomeScenario(
      'resource_unavailable',
      'Gnomish Cunning unavailable: the production racial parser did not expose Speak with Animals usage.',
    );
  }
  if (!hasForestGnomeCunningAdvantage(parsedCharacter)) {
    return unavailableForestGnomeScenario(
      'advantage_projection_missing',
      'Gnomish Cunning unavailable: the production racial parser did not project the three mental-save advantage.',
    );
  }

  const combatActor = createPlayerCombatCharacter({ ...parsedCharacter, id: FOREST_GNOME_ACTOR_ID });
  const ordinaryCombatActor: CombatCharacter = {
    ...combatActor,
    id: `${FOREST_GNOME_ACTOR_ID}-ordinary-context`,
    modifiers: combatActor.modifiers
      ? { ...combatActor.modifiers, advantage: combatActor.modifiers.advantage.filter(modifier => !/saving throw/i.test(modifier)) }
      : undefined,
  };

  return {
    actor: { ...parsedCharacter, id: FOREST_GNOME_ACTOR_ID },
    combatActor,
    ordinaryCombatActor,
    failureReason: null,
    outcome: `Ready: ${parsedCharacter.name}; Gnomish Cunning advantage on Intelligence, Wisdom, and Charisma saves; Speak with Animals ${resource.current}/${resource.max} uses; reset ${resource.resetOn}.`,
    lastResolution: null,
  };
}

/** Resolve one mental save twice against paired faces through the native save engine. */
export function resolveForestGnomeGnomishCunning(
  scenario: ForestGnomeScenarioState,
  ability: SavingThrowAbility,
  rng: () => number = Math.random,
): ForestGnomeScenarioState {
  if (!scenario.combatActor || !scenario.ordinaryCombatActor || !scenario.actor) {
    return { ...scenario, outcome: 'Gnomish Cunning rejected: the production actor or save context is unavailable.' };
  }

  // Use the same first face for both contexts and a second face only for the
  // advantaged save. This makes the visible comparison fair and deterministic.
  const firstRandom = rng();
  const secondRandom = rng();
  const advantageRandomValues = [firstRandom, secondRandom];
  const advantaged = rollSavingThrow(
    scenario.combatActor,
    ability,
    FOREST_GNOME_SAVE_DC,
    undefined,
    undefined,
    undefined,
    { rng: () => advantageRandomValues.shift() ?? secondRandom },
  );
  const ordinary = rollSavingThrow(
    scenario.ordinaryCombatActor,
    ability,
    FOREST_GNOME_SAVE_DC,
    undefined,
    undefined,
    undefined,
    { rng: () => firstRandom },
  );
  const d20Faces = [Math.floor(firstRandom * 20) + 1, Math.floor(secondRandom * 20) + 1];
  const finalAdvantaged: SavingThrowResult = advantaged;

  return {
    ...scenario,
    outcome: `Gnomish Cunning resolved: ${ability} save kept ${finalAdvantaged.roll}; advantaged total ${finalAdvantaged.total}; ordinary total ${ordinary.total}.`,
    lastResolution: { ability, advantaged: finalAdvantaged, ordinary, d20Faces },
  };
}

// ============================================================================
// Visible Race Leaf Surface
// ============================================================================
// The surface exposes parsed actor facts, paired save faces/results, a local
// reset, the shell event callback, and clear unsupported boundaries.
// ============================================================================

function ForestGnomeRaceLeafContent({ race, state, onScenarioEvent }: RaceDomainLeafProps) {
  const [scenario, setScenario] = useState(() => createForestGnomeGnomishCunningScenario(race));
  const [ability, setAbility] = useState<SavingThrowAbility>('Intelligence');
  const [lastEvent, setLastEvent] = useState('No Forest Gnome event yet.');
  const resource = getForestGnomeSpeakWithAnimalsResource(scenario.actor);
  const cunningTrait = getCanonicalForestGnomeTrait(race, FOREST_GNOME_CUNNING_TRAIT);
  const visionTrait = getCanonicalForestGnomeTrait(race, FOREST_GNOME_VISION_TRAIT);
  const illusionistTrait = getCanonicalForestGnomeTrait(race, FOREST_GNOME_ILLUSIONIST_TRAIT);
  const animalsTrait = getCanonicalForestGnomeTrait(race, FOREST_GNOME_ANIMALS_TRAIT);
  const resourceMaxDisplay = resource?.max === 'proficiency_bonus'
    ? scenario.actor?.proficiencyBonus ?? calculateProficiencyBonus(FOREST_GNOME_SCENARIO_LEVEL)
    : resource?.max ?? 0;

  // Resolve one native save comparison and report the exact faces/results to
  // the parent shell's durable event log as well as this local visible surface.
  const handleResolve = () => {
    const nextScenario = resolveForestGnomeGnomishCunning(scenario, ability);
    setScenario(nextScenario);
    const resolution = nextScenario.lastResolution;
    const event = resolution
      ? `Forest Gnome GNOMISH CUNNING ${ability.toUpperCase()}: faces ${resolution.d20Faces.join(' / ')}; kept ${resolution.advantaged.roll}; advantaged ${resolution.advantaged.total}; ordinary ${resolution.ordinary.total}.`
      : `Forest Gnome GNOMISH CUNNING REJECTED: ${nextScenario.outcome}`;
    setLastEvent(event);
    onScenarioEvent(event);
  };

  // A local reset is visible here; the shell's resetCount remains a second
  // keyed-remount boundary and resets this state when the host resets.
  const handleReset = () => {
    const resetScenario = createForestGnomeGnomishCunningScenario(race);
    setScenario(resetScenario);
    const event = 'Forest Gnome scenario reset: parsed actor and Speak with Animals uses restored.';
    setLastEvent(event);
    onScenarioEvent(event);
  };

  return (
    <section aria-labelledby="forest-gnome-scenario-title">
      <h4 id="forest-gnome-scenario-title">Gnomish Cunning</h4>
      <p data-testid="forest-gnome-canonical-trait">{cunningTrait}</p>
      <div data-testid="forest-gnome-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Level {scenario.actor?.level ?? 'unknown'}; PB +{scenario.actor?.proficiencyBonus ?? calculateProficiencyBonus(FOREST_GNOME_SCENARIO_LEVEL)}; parsed mental-save advantage {hasForestGnomeCunningAdvantage(scenario.actor) ? 'native' : 'missing'}; Speak with Animals Uses {resource?.current ?? 0}/{resourceMaxDisplay} ({resource?.resetOn ?? 'unavailable'}).
      </div>

      <label htmlFor="forest-gnome-save-ability">Save ability</label>
      <select id="forest-gnome-save-ability" value={ability} onChange={event => setAbility(event.target.value as SavingThrowAbility)}>
        {FOREST_GNOME_SAVE_ABILITIES.map(saveAbility => <option key={saveAbility}>{saveAbility}</option>)}
      </select>
      <Button type="button" variant="primary" size="sm" onClick={handleResolve}>Resolve Gnomish Cunning save</Button>
      <Button type="button" variant="secondary" size="sm" onClick={handleReset}>Reset Forest Gnome scenario</Button>

      <p aria-live="polite" data-testid="forest-gnome-outcome">{scenario.outcome}</p>
      <p data-testid="forest-gnome-save-result">
        {scenario.lastResolution
          ? `${scenario.lastResolution.ability} save: d20 faces ${scenario.lastResolution.d20Faces.join(' / ')}; kept ${scenario.lastResolution.advantaged.roll}; advantaged total ${scenario.lastResolution.advantaged.total}; ordinary total ${scenario.lastResolution.ordinary.total}.`
          : 'No Gnomish Cunning save resolved yet.'}
      </p>
      <p data-testid="forest-gnome-event-log">Last event: {lastEvent}</p>

      <div data-testid="forest-gnome-vision-fact"><strong>Darkvision fact:</strong> {visionTrait ?? 'Canonical Vision trait unavailable.'} Sensing and visibility are not simulated by this leaf.</div>
      <div data-testid="forest-gnome-illusionist-fact"><strong>Natural Illusionist fact:</strong> {illusionistTrait ?? 'Canonical Natural Illusionist trait unavailable.'} The cantrip is not cast here.</div>
      <div data-testid="forest-gnome-animals-fact"><strong>Speak with Animals fact:</strong> {animalsTrait ?? 'Canonical Speak with Animals trait unavailable.'} The parsed usage is shown above; the spell is not cast here.</div>
      <p data-testid="forest-gnome-ability-choice-fact">Ability choice fact: Intelligence, Wisdom, or Charisma is read from the canonical traits. Selected display ability: {ability}. This selection does not cast or modify a spell.</p>
      <p data-testid="forest-gnome-boundary">Boundary: the save comparison is production-backed, but Darkvision sensing, Minor Illusion, and Speak with Animals casting require their mounted perception/spell systems. No 2D/3D render proof is claimed.</p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
}

/** The parent shell's resetCount is a keyed remount boundary for actor state. */
export function ForestGnomeRaceLeaf(props: RaceDomainLeafProps) {
  return <ForestGnomeRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />;
}

export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'forest-gnome-gnomish-cunning',
  raceId: 'forest_gnome',
  label: 'Forest Gnome · Gnomish Cunning',
  description: 'Production-backed Intelligence, Wisdom, and Charisma saving-throw advantage compared with an ordinary context; Darkvision, Natural Illusionist, and Speak with Animals remain canonical facts-only boundaries.',
  Component: ForestGnomeRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
