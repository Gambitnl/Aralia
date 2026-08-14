import React, { useState } from 'react';
import { buildRacialTraitLibrary } from '../../../../../data/races';
import type {
  RacialFeatureTrait,
  RacialResourceMechanic,
  RacialSpellTrait,
} from '../../../../../data/races/racialTraits';
import {
  applyRacialSpellGrantsByLevel,
  resolveRacialResourceId,
} from '../../../../../utils/character/characterUtils';
import { rollAbilityCheck, type CheckResult } from '../../../../../utils/character/checkUtils';
import { createPlayerCombatCharacter } from '../../../../../utils/combat/combatUtils';
import { resetEconomy } from '../../../../../utils/combat/actionEconomyUtils';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { CombatCharacter } from '../../../../../types/combat';
import type { Race } from '../../../../../types/character';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file demonstrates the canonical Draconblood Dragonborn social feature
 * in the Tactical Sandbox Race domain. It assembles a real character, routes
 * the Charisma skill check through the shared check and dice helpers, and
 * keeps the spell and sensing facts visible without pretending that unsupported
 * spell-casting or darkvision transactions exist.
 *
 * Called by: raceDomainRegistry.ts through automatic ./leaves discovery.
 * Depends on: the canonical Draconblood Race record, racial trait parser,
 * character assembly, combat actor bridge, check helper, and shared dice engine.
 */

// ============================================================================
// Canonical Facts And Stable Control Identifiers
// ============================================================================
// These identifiers are stable seams for focused tests and mounted preview
// proof. Rule values are read from the canonical Race row or parser output so
// this leaf does not become a second source of racial rules.
// ============================================================================

export const DRACONBLOOD_FORCEFUL_PRESENCE_CONTROL_ID = 'draconblood-forceful-presence';
export const DRACONBLOOD_FORCEFUL_PRESENCE_SKILL_CONTROL_ID = 'draconblood-forceful-presence-skill';
export const DRACONBLOOD_FORCEFUL_PRESENCE_CANONICAL_RESOURCE_ID = 'draconblood_dragonborn__forceful_presence__resource';
export const DRACONBLOOD_FORCEFUL_PRESENCE_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  DRACONBLOOD_FORCEFUL_PRESENCE_CANONICAL_RESOURCE_ID,
);
export const DRACONBLOOD_ACTOR_ID = 'draconblood-dragonborn-race-actor';
export const DRACONBLOOD_DETERMINISTIC_D20_FACES = [5, 17] as const;

export type DraconbloodSocialSkill = 'Persuasion' | 'Intimidation';

export interface DraconbloodSpellFact {
  spellId: string;
  minLevel: number;
  sourceText: string;
}

export interface DraconbloodCanonicalFacts {
  forcefulTrait: RacialFeatureTrait | null;
  forcefulResource: RacialResourceMechanic | null;
  ancestralLegacyTrait: string | null;
  ancestralLegacySpells: readonly DraconbloodSpellFact[];
  spellAbilityChoices: readonly string[];
  visionTrait: string | null;
  parsedSpellTraits: readonly RacialSpellTrait[];
}

/** Return the named canonical trait without rewriting its authored wording. */
export function getCanonicalDraconbloodTrait(
  race: Race,
  traitName: string,
): string | null {
  return race.traits.find(trait => (
    trait.trim().toLowerCase().startsWith(`${traitName.toLowerCase()}:`)
  )) ?? null;
}

/**
 * Read Draconblood facts from the same racial parser used by character
 * assembly, while retaining the source text for authored rest and gate facts.
 */
export function getCanonicalDraconbloodFacts(
  race: Race,
): DraconbloodCanonicalFacts {
  // Parse this one canonical race in isolation so focused tests can prove the
  // leaf's source link without importing or aliasing another race leaf.
  const library = buildRacialTraitLibrary({ [race.id]: race });
  const parsedTraits = library.byRaceId[race.id] ?? [];
  const forcefulTrait = parsedTraits.find((trait): trait is RacialFeatureTrait => (
    trait.type !== 'spell' && trait.traitName === 'Forceful Presence'
  )) ?? null;
  const ancestralLegacyTrait = getCanonicalDraconbloodTrait(race, 'Draconic Ancestral Legacy');
  const parsedSpellTraits = parsedTraits.filter(
    (trait): trait is RacialSpellTrait => trait.type === 'spell',
  );
  const abilityChoices = ancestralLegacyTrait
    ? Array.from(new Set(
      ancestralLegacyTrait.match(/\b(Intelligence|Wisdom|Charisma)\b/gi) ?? [],
    )).map(ability => ability[0].toUpperCase() + ability.slice(1).toLowerCase())
    : [];
  const ancestralLegacySpells = (race.knownSpells ?? []).map(spell => ({
    spellId: spell.spellId,
    minLevel: spell.minLevel,
    sourceText: ancestralLegacyTrait ?? '',
  }));

  return {
    forcefulTrait,
    forcefulResource: forcefulTrait?.resources?.find(resource => (
      resource.id === DRACONBLOOD_FORCEFUL_PRESENCE_CANONICAL_RESOURCE_ID
    )) ?? null,
    ancestralLegacyTrait,
    ancestralLegacySpells,
    spellAbilityChoices: abilityChoices,
    visionTrait: getCanonicalDraconbloodTrait(race, 'Vision'),
    parsedSpellTraits,
  };
}

/** Confirm the exact canonical facts required before exposing a usable actor. */
export function hasCanonicalDraconbloodRules(race: Race): boolean {
  const facts = getCanonicalDraconbloodFacts(race);
  const forcefulText = facts.forcefulTrait?.sourceText ?? '';
  const legacyText = facts.ancestralLegacyTrait ?? '';

  return race.id === 'draconblood_dragonborn'
    && race.name === 'Draconblood Dragonborn'
    && /Charisma\s+\((?:Intimidation|Persuasion)\s+or\s+(?:Persuasion|Intimidation)\)\s+check/i.test(forcefulText)
    && /advantage/i.test(forcefulText)
    && /short or long rest/i.test(forcefulText)
    && facts.forcefulResource?.id === DRACONBLOOD_FORCEFUL_PRESENCE_CANONICAL_RESOURCE_ID
    && facts.forcefulResource.maxUses === 1
    && facts.forcefulResource.resetOn === 'short_rest'
    && /Thaumaturgy/i.test(legacyText)
    && /Comprehend Languages/i.test(legacyText)
    && /Detect Magic/i.test(legacyText)
    && /5th level/i.test(legacyText)
    && facts.spellAbilityChoices.join('|') === 'Intelligence|Wisdom|Charisma'
    && /darkness/i.test(facts.visionTrait ?? '')
    && facts.ancestralLegacySpells.some(spell => spell.spellId === 'detect-magic' && spell.minLevel === 5);
}

// ============================================================================
// Production Actor Assembly
// ============================================================================
// The actor begins as a production quick character and passes through racial
// spell/resource assembly and the normal PlayerCharacter-to-combat bridge.
// Forceful Presence's resource is parser-projected; its exact source wording
// supplies the targeted advantage adapter described below.
// ============================================================================

export interface DraconbloodScenarioState {
  race: Race;
  actor: CombatCharacter | null;
  skill: DraconbloodSocialSkill;
  d20Faces: readonly number[];
  selectedD20: number | null;
  check: CheckResult | null;
  outcome: string;
}

function createDraconbloodActor(race: Race): {
  actor: CombatCharacter | null;
  outcome: string;
} {
  // Charisma 16 makes the shared check's modifier visible without relying on
  // a hidden class feature or a hand-authored combat fixture.
  const quickCharacter = createQuickCharacter({
    name: 'Draconblood Dragonborn - Race Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [10, 12, 12, 10, 10, 16],
  });
  const facts = getCanonicalDraconbloodFacts(race);

  // Missing canonical data or production assembly is an explicit boundary;
  // the preview must not manufacture a social actor from copied assumptions.
  if (!quickCharacter || !facts.forcefulResource || !hasCanonicalDraconbloodRules(race)) {
    return {
      actor: null,
      outcome: 'Draconblood Dragonborn unavailable: canonical Forceful Presence or production assembly is incomplete.',
    };
  }

  const assembledCharacter = applyRacialSpellGrantsByLevel(
    { ...quickCharacter, race },
    quickCharacter.level ?? 1,
  );
  const resourceMax = typeof facts.forcefulResource.maxUses === 'number'
    ? facts.forcefulResource.maxUses
    : assembledCharacter.proficiencyBonus ?? 2;
  const assembledResource = assembledCharacter.limitedUses?.[DRACONBLOOD_FORCEFUL_PRESENCE_RESOURCE_ID];

  // The shared racial assembly is authoritative for this resource. If its
  // projection is missing, stop at the boundary rather than creating a charge.
  if (!assembledResource) {
    return {
      actor: null,
      outcome: 'Draconblood Dragonborn unavailable: Forceful Presence resource was not projected by racial assembly.',
    };
  }

  // The actor is only the Forceful Presence proof surface. Keep the canonical
  // spell grants in the persistent assembly for fact display, but omit them
  // from the transient combat bridge so missing spell JSON cannot look like a
  // cast-ready transaction or emit unrelated hydration warnings.
  const generatedActor = createPlayerCombatCharacter({
    ...assembledCharacter,
    spellbook: undefined,
    limitedUses: {
      [DRACONBLOOD_FORCEFUL_PRESENCE_RESOURCE_ID]: assembledResource,
    },
  });

  // DEBT: The shared modifier parser does not yet recognize the authored
  // "check ... with advantage" sentence shape, although it does recognize the
  // resource. This narrow adapter carries only the canonical check scope so
  // rollAbilityCheck remains the authority; the durable fix belongs in the
  // shared racial parser and is intentionally outside this leaf task.
  const existingAdvantage = generatedActor.modifiers?.advantage ?? [];
  const forcefulAdvantage = existingAdvantage.some(modifier => (
    /charisma/i.test(modifier) && /intimidation|persuasion/i.test(modifier)
  ))
    ? existingAdvantage
    : [...existingAdvantage, 'Charisma (Intimidation or Persuasion) checks'];
  const actor = resetEconomy({
    ...generatedActor,
    id: DRACONBLOOD_ACTOR_ID,
    name: `${race.name} - Race Tester`,
    limitedUses: {
      [DRACONBLOOD_FORCEFUL_PRESENCE_RESOURCE_ID]: {
        ...assembledResource,
        current: assembledResource.current,
        max: resourceMax,
      },
    },
    modifiers: {
      ...(generatedActor.modifiers ?? { advantage: [], disadvantage: [], bonuses: [] }),
      advantage: forcefulAdvantage,
    },
  });

  return {
    actor,
    outcome: `Ready: ${actor.name}; Charisma ${actor.stats.charisma}; Forceful Presence ${actor.limitedUses?.[DRACONBLOOD_FORCEFUL_PRESENCE_RESOURCE_ID]?.current}/${resourceMax} use; short or long rest recovery.`,
  };
}

/** Build the deterministic baseline used by the UI and focused tests. */
export function createDraconbloodScenario(race: Race): DraconbloodScenarioState {
  const assembled = createDraconbloodActor(race);
  return {
    race,
    actor: assembled.actor,
    skill: 'Persuasion',
    d20Faces: [],
    selectedD20: null,
    check: null,
    outcome: assembled.outcome,
  };
}

// ============================================================================
// Native Forceful Presence Transaction
// ============================================================================
// The shared rollAbilityCheck helper owns ability modifiers, proficiency, dice,
// and advantage selection. This leaf only supplies a deterministic RNG stream
// and decrements the parser-created feature resource after a valid roll.
// ============================================================================

export function resolveDraconbloodForcefulPresence(
  scenario: DraconbloodScenarioState,
  skill: DraconbloodSocialSkill,
): DraconbloodScenarioState {
  const actor = scenario.actor;
  const resource = actor?.limitedUses?.[DRACONBLOOD_FORCEFUL_PRESENCE_RESOURCE_ID];

  // Exhaustion must reject before dice are consumed, preserving the exact
  // actor and result state from the prior successful transaction.
  if (!actor || !resource || resource.current <= 0) {
    return {
      ...scenario,
      skill,
      outcome: 'Forceful Presence rejected: no short-or-long-rest use remains.',
    };
  }

  const faces: number[] = [];
  let faceIndex = 0;
  const deterministicRng = () => {
    const face = DRACONBLOOD_DETERMINISTIC_D20_FACES[faceIndex] ?? 1;
    faceIndex += 1;
    faces.push(face);
    return (face - 1) / 20;
  };

  // Forceful Presence is canonical advantage even while the shared parser is
  // waiting for its authored sentence grammar to be widened.
  const check = rollAbilityCheck(actor, 'Charisma', skill, {
    advantage: true,
    rng: deterministicRng,
  });
  const nextActor: CombatCharacter = {
    ...actor,
    limitedUses: {
      ...(actor.limitedUses ?? {}),
      [DRACONBLOOD_FORCEFUL_PRESENCE_RESOURCE_ID]: {
        ...resource,
        current: resource.current - 1,
      },
    },
  };

  return {
    ...scenario,
    actor: nextActor,
    skill,
    d20Faces: faces,
    selectedD20: check.roll,
    check,
    outcome: `Forceful Presence resolved: Charisma (${skill}) at advantage; d20 ${faces.join(' and ')} -> kept ${check.roll}; total ${check.total}; use ${nextActor.limitedUses?.[DRACONBLOOD_FORCEFUL_PRESENCE_RESOURCE_ID]?.current}/${resource.max}.`,
  };
}

// ============================================================================
// Draconblood Dragonborn Leaf UI
// ============================================================================
// The surface exposes canonical facts, the native result, resource exhaustion,
// keyed reset behavior, parent log events, and honest spell/sensing boundaries.
// ============================================================================

const DraconbloodDragonbornRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  onScenarioEvent,
}) => {
  // Parent resetCount remounts this content so the actor, resource, and result
  // return to the same deterministic production-assembly baseline.
  const [scenario, setScenario] = useState<DraconbloodScenarioState>(
    () => createDraconbloodScenario(race),
  );
  const facts = getCanonicalDraconbloodFacts(race);
  const resource = scenario.actor?.limitedUses?.[DRACONBLOOD_FORCEFUL_PRESENCE_RESOURCE_ID];
  const actorDarkvision = scenario.actor?.stats.senses?.darkvision ?? 0;

  // Resolve the selected native check and publish the exact visible outcome to
  // the parent Race shell's event log.
  const handleForcefulPresence = () => {
    const nextScenario = resolveDraconbloodForcefulPresence(scenario, scenario.skill);
    setScenario(nextScenario);
    onScenarioEvent(`Draconblood Dragonborn FORCEFUL PRESENCE ${scenario.skill.toUpperCase()}: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="draconblood-dragonborn-race-title" data-testid="draconblood-dragonborn-race-leaf">
      {/* The heading names the canonical feature transaction for assistive tools. */}
      <h4 id="draconblood-dragonborn-race-title">Draconblood Dragonborn — Forceful Presence</h4>

      {/* This selector changes only which of the two canonical social skills is checked. */}
      <label htmlFor={DRACONBLOOD_FORCEFUL_PRESENCE_SKILL_CONTROL_ID}>Social check</label>
      <select
        id={DRACONBLOOD_FORCEFUL_PRESENCE_SKILL_CONTROL_ID}
        value={scenario.skill}
        onChange={event => setScenario(current => ({
          ...current,
          skill: event.target.value as DraconbloodSocialSkill,
        }))}
      >
        <option value="Persuasion">Charisma (Persuasion)</option>
        <option value="Intimidation">Charisma (Intimidation)</option>
      </select>
      <Button
        id={DRACONBLOOD_FORCEFUL_PRESENCE_CONTROL_ID}
        type="button"
        onClick={handleForcefulPresence}
      >
        Use Forceful Presence
      </Button>

      {/* The source sentence and parser resource show why the action is legal. */}
      <p data-testid="draconblood-forceful-canonical">
        Canonical: Charisma (Intimidation or Persuasion) check at advantage; once per short or long rest; parser resource {facts.forcefulResource?.id ?? 'missing'} ({facts.forcefulResource?.resetOn ?? 'missing'} projection).
      </p>
      <p data-testid="draconblood-forceful-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Charisma {scenario.actor?.stats.charisma ?? 'unknown'}; Forceful Presence uses {resource?.current ?? 'unknown'}/{resource?.max ?? 'unknown'}.
      </p>
      <p data-testid="draconblood-forceful-result">
        Check: {scenario.check ? `d20 faces ${scenario.d20Faces.join(' and ')}; kept ${scenario.selectedD20}; total ${scenario.check.total}` : 'not resolved'}.
      </p>
      <p aria-live="polite" role="status" data-testid="draconblood-forceful-outcome">{scenario.outcome}</p>

      {/* These are canonical spell facts only; no cast button or invented charge is exposed. */}
      <p data-testid="draconblood-ancestral-legacy-facts">
        Draconic Ancestral Legacy facts: {facts.ancestralLegacySpells.map(spell => `${spell.spellId} at level ${spell.minLevel}`).join('; ') || 'missing'}; spellcasting ability choice: {facts.spellAbilityChoices.join(', ') || 'missing'}.
      </p>

      {/* The current actor bridge does not project this linked Vision sentence into senses. */}
      <p data-testid="draconblood-sensing-boundary">
        Sensing boundary: canonical Vision is 60 feet in dim light and dim-light vision in darkness; projected actor darkvision is {actorDarkvision} feet; no darkvision/sensing transaction is claimed here.
      </p>
      <p data-testid="draconblood-boundary">
        Boundary: Forceful Presence check, advantage, deterministic faces, result, and feature-resource decrement run here. Draconic Ancestral Legacy gates and ability choices are canonical facts only; spell casting/resource payment and darkvision/sensing are not simulated.
      </p>
    </section>
  );
};

// A parent resetCount change remounts the leaf and restores the actor, resource,
// d20 faces, result, and exhaustion state to the canonical baseline.
export const DraconbloodDragonbornRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <DraconbloodDragonbornRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires this exact named registration export. Keeping it
// local lets this leaf land without a central registry edit or sibling import.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'draconblood-dragonborn-forceful-presence',
  raceId: 'draconblood_dragonborn',
  label: 'Draconblood Dragonborn Forceful Presence',
  description: 'Resolve the canonical Charisma social check at advantage through native check and dice helpers.',
  Component: DraconbloodDragonbornRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
