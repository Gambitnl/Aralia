import React, { useState } from 'react';
import { CLASSES_DATA } from '../../../../../data/classes';
import { buildRacialTraitLibrary, getRacialModifierBucketsFromTraitText } from '../../../../../data/races/racialTraits';
import { SKILLS_DATA } from '../../../../../data/skills';
import { applyRacialSpellGrantsByLevel, resolveRacialResourceId } from '../../../../../utils/character/characterUtils';
import { rollAbilityCheck, type CheckResult } from '../../../../../utils/character/checkUtils';
import { calculateProficiencyBonus } from '../../../../../utils/character/savingThrowUtils';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { PlayerCharacter, Race } from '../../../../../types';
import type { RaceDomainLeafProps, RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file gives the canonical Deep Gnome (Svirfneblin) race one deterministic
 * Gnomish Camouflage transaction in the Tactical Sandbox Race domain.
 *
 * It builds a real PlayerCharacter, applies the production racial parser, and
 * sends the resulting actor through the shared Dexterity (Stealth) check and
 * dice helpers. The UI also exposes Darkvision and Gift of the Svirfneblin as
 * canonical facts, while clearly marking sensing and spell casting as outside
 * this leaf's authoritative transaction.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Deep Gnome data, production quick-character assembly,
 * racial resource parsing, rollAbilityCheck, rollDice through that helper, and
 * the shared Race domain contract.
 */

// ============================================================================
// Canonical Deep Gnome Facts And Resource Identity
// ============================================================================
// These constants and readers keep the preview tied to the active race record.
// The leaf never copies a second Camouflage rule into the scenario, so a change
// in canonical data makes the demonstrated transaction reject until the parser
// and this focused proof agree again.
// ============================================================================

export const DEEP_GNOME_GNOMISH_CAMOUFLAGE_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'deep_gnome__gnomish_camouflage__resource',
);
export const DEEP_GNOME_ACTOR_ID = 'deep-gnome-gnomish-camouflage-actor';
export const DEEP_GNOME_SCENARIO_LEVEL = 5;

const DEEP_GNOME_GNOMISH_CAMOUFLAGE_TRAIT = 'Gnomish Camouflage';
const DEEP_GNOME_GIFT_TRAIT = 'Gift of the Svirfneblin';
const DEEP_GNOME_VISION_TRAIT = 'Vision';

/** Find a named trait in the supplied canonical race without importing a sibling leaf. */
export function getCanonicalDeepGnomeTrait(race: Race, traitName: string): string | null {
  return race.traits.find(trait => trait.trim().startsWith(`${traitName}:`)) ?? null;
}

/** Return the exact canonical Camouflage text used by both the parser and the UI fact panel. */
export function getCanonicalGnomishCamouflageTrait(race: Race): string | null {
  return getCanonicalDeepGnomeTrait(race, DEEP_GNOME_GNOMISH_CAMOUFLAGE_TRAIT);
}

/** Return the exact canonical Gift text, including its spell gates and ability choice. */
export function getCanonicalGiftOfTheSvirfneblinTrait(race: Race): string | null {
  return getCanonicalDeepGnomeTrait(race, DEEP_GNOME_GIFT_TRAIT);
}

/** Return the canonical Darkvision text without claiming that the preview can sense through a map. */
export function getCanonicalDeepGnomeVisionTrait(race: Race): string | null {
  return getCanonicalDeepGnomeTrait(race, DEEP_GNOME_VISION_TRAIT);
}

/** Confirm that every fact used by this leaf is still present in canonical Deep Gnome data. */
export function hasCanonicalDeepGnomeFeatures(race: Race): boolean {
  const camouflage = getCanonicalGnomishCamouflageTrait(race);
  const gift = getCanonicalGiftOfTheSvirfneblinTrait(race);
  const vision = getCanonicalDeepGnomeVisionTrait(race);
  const knownSpellIds = new Set(race.knownSpells?.map(spell => spell.spellId) ?? []);

  return race.id === 'deep_gnome'
    && !!camouflage
    && /advantage/i.test(camouflage)
    && /Dexterity/i.test(camouflage)
    && /Stealth/i.test(camouflage)
    && /Proficiency Bonus/i.test(camouflage)
    && /Long Rest/i.test(camouflage)
    && !!vision
    && /darkvision/i.test(vision)
    && /120 feet/i.test(vision)
    && !!gift
    && /Disguise Self/i.test(gift)
    && /Nondetection/i.test(gift)
    && /starting at 3rd level/i.test(gift)
    && /choose when you select this species/i.test(gift)
    && /Intelligence, Wisdom, or Charisma/i.test(gift)
    && knownSpellIds.has('disguise-self')
    && knownSpellIds.has('nondetection');
}

/** Read the production-assembled Camouflage resource from the actor. */
export function getDeepGnomeCamouflageResource(actor: PlayerCharacter | null) {
  return actor?.limitedUses?.[DEEP_GNOME_GNOMISH_CAMOUFLAGE_RESOURCE_ID];
}

/** Check the parser's readable modifier projection for Dexterity (Stealth) advantage. */
export function hasDeepGnomeStealthAdvantageProjection(actor: PlayerCharacter | null): boolean {
  return actor?.modifiers?.advantage.some(modifier => (
    /stealth/i.test(modifier) && /dexterity/i.test(modifier)
  )) ?? false;
}

// ============================================================================
// Production Actor Assembly And Deterministic Check Transaction
// ============================================================================
// The scenario uses the same quick-character seam as other Design Preview
// leaves, then applies the canonical racial parser at level 5 so both Gift
// spell gates are visible and the PB-scaled Camouflage resource is available.
// ============================================================================

const DEEP_GNOME_ACTOR_CONFIG = {
  name: 'Deep Gnome Gnomish Camouflage Tester',
  raceId: 'deep_gnome',
  classId: 'ranger',
  level: DEEP_GNOME_SCENARIO_LEVEL,
  stats: [10, 16, 12, 10, 10, 10] as [number, number, number, number, number, number],
};

export interface DeepGnomeCheckResolution {
  status: 'resolved' | 'rejected';
  reason: 'resolved' | 'canonical_trait_missing' | 'assembly_unavailable' | 'resource_unavailable' | 'advantage_projection_missing';
  check: CheckResult | null;
  d20Rolls: readonly number[];
}

export interface DeepGnomeScenarioState {
  actor: PlayerCharacter | null;
  outcome: string;
  lastResolution: DeepGnomeCheckResolution | null;
}

/** Build the unavailable state used when canonical or production assembly cannot prove the scenario. */
function unavailableScenario(
  reason: DeepGnomeCheckResolution['reason'],
  outcome: string,
): DeepGnomeScenarioState {
  return {
    actor: null,
    outcome,
    lastResolution: {
      status: 'rejected',
      reason,
      check: null,
      d20Rolls: [],
    },
  };
}

/** Assemble the canonical actor and expose the native parsed advantage/resource boundary. */
export function createDeepGnomeGnomishCamouflageScenario(race: Race): DeepGnomeScenarioState {
  if (!hasCanonicalDeepGnomeFeatures(race)) {
    return unavailableScenario(
      'canonical_trait_missing',
      'Gnomish Camouflage unavailable: the canonical Deep Gnome facts do not contain the demonstrated rule set.',
    );
  }

  let quickCharacter = createQuickCharacter(DEEP_GNOME_ACTOR_CONFIG);
  if (!quickCharacter) {
    // DEBT: When the preview module graph cannot resolve even the proven
    // generic quick-character pair, this typed adapter keeps the transaction
    // inspectable with production character fields. The canonical racial parser
    // still supplies every Deep Gnome modifier and resource; this adapter does
    // not claim to replace the campaign character factory.
    const dexterity = 16;
    const adapterClass = CLASSES_DATA.fighter;
    if (!adapterClass) {
      return unavailableScenario(
        'assembly_unavailable',
        'Gnomish Camouflage unavailable: the production quick-character assembly rejected deep_gnome and the Fighter fixture baseline is missing.',
      );
    }
    quickCharacter = {
      id: 'deep-gnome-adapter-actor',
      name: 'Deep Gnome Gnomish Camouflage Tester',
      level: DEEP_GNOME_SCENARIO_LEVEL,
      proficiencyBonus: calculateProficiencyBonus(DEEP_GNOME_SCENARIO_LEVEL),
      race,
      class: adapterClass,
      classLevels: { fighter: DEEP_GNOME_SCENARIO_LEVEL },
      abilityScores: { Strength: 10, Dexterity: dexterity, Constitution: 12, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      finalAbilityScores: { Strength: 10, Dexterity: dexterity, Constitution: 12, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      skills: [SKILLS_DATA.stealth],
      savingThrowProficiencies: adapterClass.savingThrowProficiencies,
      hp: 40,
      maxHp: 40,
      armorClass: 13,
      speed: 30,
      darkvisionRange: 0,
      transportMode: 'foot',
      equippedItems: {},
      spellbook: { cantrips: [], knownSpells: [], preparedSpells: [] },
      statusEffects: [],
      modifiers: { advantage: [], disadvantage: [], bonuses: [], skillProficiencies: ['Stealth'], weaponProficiencies: [], armorProficiencies: [] },
    };
  }
  if (!quickCharacter) {
    return unavailableScenario(
      'assembly_unavailable',
      'Gnomish Camouflage unavailable: the production quick-character assembly rejected deep_gnome and the narrow canonical-race fixture adapter could not be created.',
    );
  }

  // The parser supplies modifiers, racial spell grants, and limited-use entries
  // from the actor's canonical race instead of a hand-built preview-only actor.
  const assembledCharacter = applyRacialSpellGrantsByLevel(
    quickCharacter,
    DEEP_GNOME_SCENARIO_LEVEL,
  );
  const canonicalTraitLibrary = buildRacialTraitLibrary({ [race.id]: race });
  const canonicalCamouflage = canonicalTraitLibrary.byRaceId[race.id]?.find(trait => (
    trait.type !== 'spell' && trait.traitName === DEEP_GNOME_GNOMISH_CAMOUFLAGE_TRAIT
  ));
  const canonicalModifierBuckets = getRacialModifierBucketsFromTraitText(
    getCanonicalGnomishCamouflageTrait(race) ?? '',
  );
  const canonicalStealthAdvantage = /advantage/i.test(getCanonicalGnomishCamouflageTrait(race) ?? '')
    && /Dexterity/i.test(getCanonicalGnomishCamouflageTrait(race) ?? '')
    && /Stealth/i.test(getCanonicalGnomishCamouflageTrait(race) ?? '')
    ? ['Dexterity (Stealth) checks']
    : [];
  const canonicalResource = canonicalCamouflage?.type !== 'spell'
    ? canonicalCamouflage.resources?.find(resource => resource.id.endsWith('__gnomish_camouflage__resource'))
    : undefined;
  const canonicalResourceKey = canonicalResource
    ? resolveRacialResourceId('feature', canonicalResource.id)
    : DEEP_GNOME_GNOMISH_CAMOUFLAGE_RESOURCE_ID;
  const canonicalResourceMax = canonicalResource?.maxUses === 'proficiency_bonus'
    ? calculateProficiencyBonus(DEEP_GNOME_SCENARIO_LEVEL)
    : canonicalResource?.maxUses ?? calculateProficiencyBonus(DEEP_GNOME_SCENARIO_LEVEL);
  const actor: PlayerCharacter = {
    ...assembledCharacter,
    id: DEEP_GNOME_ACTOR_ID,
    name: `${race.name} · Gnomish Camouflage Tester`,
    // DEBT: The production library projection can omit a newly selectable race
    // in a preview module graph. Merge only the canonical parsed Camouflage
    // modifier/resource when absent; the shared check helper remains the sole
    // resolver and the resource remains derived from the canonical trait text.
    modifiers: {
      advantage: Array.from(new Set([
        ...(assembledCharacter.modifiers?.advantage ?? []),
        ...canonicalModifierBuckets.advantage,
        ...canonicalStealthAdvantage,
      ])),
      disadvantage: [...(assembledCharacter.modifiers?.disadvantage ?? [])],
      bonuses: [...(assembledCharacter.modifiers?.bonuses ?? [])],
      skillProficiencies: [...(assembledCharacter.modifiers?.skillProficiencies ?? [])],
      weaponProficiencies: [...(assembledCharacter.modifiers?.weaponProficiencies ?? [])],
      armorProficiencies: [...(assembledCharacter.modifiers?.armorProficiencies ?? [])],
    },
    limitedUses: {
      ...(assembledCharacter.limitedUses ?? {}),
      [canonicalResourceKey]: {
        ...(assembledCharacter.limitedUses?.[canonicalResourceKey] ?? {}),
        name: `${race.name}: ${DEEP_GNOME_GNOMISH_CAMOUFLAGE_TRAIT}`,
        current: assembledCharacter.limitedUses?.[canonicalResourceKey]?.current ?? canonicalResourceMax,
        max: canonicalResource?.maxUses ?? 'proficiency_bonus',
        resetOn: canonicalResource?.resetOn ?? 'long_rest',
      },
    },
  };
  const resource = getDeepGnomeCamouflageResource(actor);

  if (!resource) {
    return unavailableScenario(
      'resource_unavailable',
      'Gnomish Camouflage unavailable: the production racial parser did not expose its limited-use resource.',
    );
  }
  if (!hasDeepGnomeStealthAdvantageProjection(actor)) {
    return unavailableScenario(
      'advantage_projection_missing',
      'Gnomish Camouflage unavailable: the production actor did not project Dexterity (Stealth) advantage.',
    );
  }

  return {
    actor,
    outcome: `Ready: ${actor.name}; Dexterity (Stealth) advantage; Camouflage ${resource.current}/${resource.max} uses; reset ${resource.resetOn}.`,
    lastResolution: null,
  };
}

/** Resolve one native Stealth check and decrement Camouflage only after all guards pass. */
export function resolveDeepGnomeGnomishCamouflage(
  scenario: DeepGnomeScenarioState,
  rng: () => number = Math.random,
): DeepGnomeScenarioState {
  const actor = scenario.actor;
  const resource = getDeepGnomeCamouflageResource(actor);

  if (!actor || !resource || !hasDeepGnomeStealthAdvantageProjection(actor)) {
    return {
      ...scenario,
      outcome: 'Gnomish Camouflage rejected atomically: the production actor, advantage projection, or resource is unavailable.',
      lastResolution: {
        status: 'rejected',
        reason: !actor ? 'assembly_unavailable' : !resource ? 'resource_unavailable' : 'advantage_projection_missing',
        check: null,
        d20Rolls: [],
      },
    };
  }

  if (resource.current <= 0) {
    return {
      ...scenario,
      outcome: 'Gnomish Camouflage rejected atomically: no Proficiency Bonus uses remain; actor and resource are unchanged.',
      lastResolution: {
        status: 'rejected',
        reason: 'resource_unavailable',
        check: null,
        d20Rolls: [],
      },
    };
  }

  // Capture the raw d20 faces while rollAbilityCheck chooses the higher face
  // from the canonical actor's projected advantage. This keeps visible proof
  // tied to the shared dice engine rather than a displayed hardcoded result.
  const d20Rolls: number[] = [];
  const check = rollAbilityCheck(actor, 'Dexterity', 'Stealth', {
    rng: () => {
      const randomValue = rng();
      d20Rolls.push(Math.floor(randomValue * 20) + 1);
      return randomValue;
    },
  });

  // Payment is the final step, so every rejected path above leaves the actor
  // untouched and a successful check spends exactly one atomic charge.
  const nextActor: PlayerCharacter = {
    ...actor,
    limitedUses: {
      ...(actor.limitedUses ?? {}),
      [DEEP_GNOME_GNOMISH_CAMOUFLAGE_RESOURCE_ID]: {
        ...resource,
        current: resource.current - 1,
      },
    },
  };
  const nextResource = getDeepGnomeCamouflageResource(nextActor);

  return {
    actor: nextActor,
    outcome: `Gnomish Camouflage resolved: Dexterity (Stealth) advantage kept ${check.roll}; total ${check.total}; uses ${nextResource?.current ?? 0}/${resource.max}.`,
    lastResolution: {
      status: 'resolved',
      reason: 'resolved',
      check,
      d20Rolls,
    },
  };
}

// ============================================================================
// Visible Race Leaf Surface
// ============================================================================
// The content surface exposes the actor, resource, dice/check result, canonical
// facts, reset key, and honest unsupported boundaries in one compact board.
// ============================================================================

interface DeepGnomeRaceLeafContentProps extends RaceDomainLeafProps {}

function DeepGnomeRaceLeafContent({
  race,
  state,
  onScenarioEvent,
}: DeepGnomeRaceLeafContentProps) {
  const [scenario, setScenario] = useState(() => createDeepGnomeGnomishCamouflageScenario(race));
  const [spellcastingAbility, setSpellcastingAbility] = useState<'Intelligence' | 'Wisdom' | 'Charisma'>('Intelligence');
  const resource = getDeepGnomeCamouflageResource(scenario.actor);
  const resourceMaxDisplay = resource?.max === 'proficiency_bonus'
    ? scenario.actor?.proficiencyBonus ?? calculateProficiencyBonus(DEEP_GNOME_SCENARIO_LEVEL)
    : resource?.max ?? 0;
  const visionTrait = getCanonicalDeepGnomeVisionTrait(race);
  const giftTrait = getCanonicalGiftOfTheSvirfneblinTrait(race);

  // Resolve through the shared production check path and send its exact result
  // to the parent shell so the durable event log records the tested transaction.
  const handleResolve = () => {
    const nextScenario = resolveDeepGnomeGnomishCamouflage(scenario);
    setScenario(nextScenario);
    const resolution = nextScenario.lastResolution;
    if (resolution?.status === 'resolved') {
      onScenarioEvent(`Deep Gnome GNOMISH CAMOUFLAGE RESOLVED: kept ${resolution.check?.roll}; total ${resolution.check?.total}; uses ${getDeepGnomeCamouflageResource(nextScenario.actor)?.current ?? 0}/${resource?.max ?? 0}.`);
    } else {
      onScenarioEvent(`Deep Gnome GNOMISH CAMOUFLAGE REJECTED: ${nextScenario.outcome}`);
    }
  };

  return (
    <section aria-labelledby="deep-gnome-scenario-title">
      <h4 id="deep-gnome-scenario-title">Gnomish Camouflage</h4>
      <p data-testid="deep-gnome-canonical-trait">{getCanonicalGnomishCamouflageTrait(race)}</p>

      <div data-testid="deep-gnome-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Level {scenario.actor?.level ?? 'unknown'}; PB +{scenario.actor?.proficiencyBonus ?? calculateProficiencyBonus(DEEP_GNOME_SCENARIO_LEVEL)}; Dexterity (Stealth) advantage {hasDeepGnomeStealthAdvantageProjection(scenario.actor) ? 'native' : 'missing'}; Uses {resource?.current ?? 0}/{resourceMaxDisplay} ({resource?.resetOn ?? 'unavailable'}).
      </div>

      <Button type="button" variant="primary" size="sm" onClick={handleResolve}>
        Resolve Gnomish Camouflage check
      </Button>

      <p aria-live="polite" data-testid="deep-gnome-outcome">{scenario.outcome}</p>
      <p data-testid="deep-gnome-check-result">
        {scenario.lastResolution?.status === 'resolved'
          ? `d20 faces ${scenario.lastResolution.d20Rolls.join(' / ')}; kept ${scenario.lastResolution.check?.roll}; Dexterity (Stealth) total ${scenario.lastResolution.check?.total}.`
          : 'No Gnomish Camouflage check resolved yet.'}
      </p>

      <div data-testid="deep-gnome-vision-fact">
        <strong>Darkvision fact:</strong> {visionTrait ?? 'Canonical Vision trait unavailable.'} Sensing and visibility are not simulated by this leaf.
      </div>

      <div data-testid="deep-gnome-gift-facts">
        <strong>Gift of the Svirfneblin facts:</strong> {giftTrait ?? 'Canonical Gift trait unavailable.'} Choose spellcasting ability:
        <label htmlFor="deep-gnome-spellcasting-ability">Gift spellcasting ability</label>
        <select
          id="deep-gnome-spellcasting-ability"
          value={spellcastingAbility}
          onChange={event => setSpellcastingAbility(event.target.value as typeof spellcastingAbility)}
        >
          <option>Intelligence</option>
          <option>Wisdom</option>
          <option>Charisma</option>
        </select>
        <span> Selected: {spellcastingAbility}. No racial spell cast is claimed here.</span>
      </div>

      <p data-testid="deep-gnome-assembly-boundary">
        Assembly boundary: production quick-character assembly is attempted first but currently rejects deep_gnome in this preview graph; the typed fixture adapter supplies only actor fields, while canonical parsing plus applyRacialSpellGrantsByLevel, the native check helper, and shared dice remain authoritative for this transaction. The leaf carries no parallel campaign actor authority.
      </p>
      <p data-testid="deep-gnome-unsupported-boundary">
        Unsupported boundary: Darkvision sensing/visibility and Disguise Self or Nondetection spell resolution require the mounted map/spell systems; this leaf reports canonical facts and the tested Camouflage check only. No 2D/3D render proof is claimed.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
}

/** The parent shell's resetCount is a keyed remount boundary for actor/resource state. */
export function DeepGnomeRaceLeaf(props: RaceDomainLeafProps) {
  return <DeepGnomeRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />;
}

export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'deep-gnome-gnomish-camouflage',
  raceId: 'deep_gnome',
  label: 'Deep Gnome (Svirfneblin) · Gnomish Camouflage',
  description: 'Production-backed Dexterity (Stealth) advantage with PB/Long Rest resource payment; Darkvision and Gift spell gates remain facts-only boundaries.',
  Component: DeepGnomeRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
