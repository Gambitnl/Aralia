// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This leaf is a disjoint Race-domain integration point. It deliberately keeps
 * the Fairy-specific adapter here so this task does not change shared combat
 * utilities or create a registry merge point for another agent to resolve.
 *
 * MULTI-AGENT SAFETY:
 * If imports or exports change, refresh the dependency header with:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 */
// @dependencies-end

import React, { useState } from 'react';
import { Button } from '../../../../ui/Button';
import { ALL_ITEMS } from '../../../../../data/items';
import {
  getRacialSpellCastingAbilityChoiceForRace,
} from '../../../../../data/races';
import type { Item, Race } from '../../../../../types';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../../../types/combat';
import { createCombatEquipmentState } from '../../../../../utils/combat/combatUtils';
import {
  resolveAerialMovement,
  type AerialMovementResolution,
} from '../../../../../utils/combat/aerialMovementUtils';
import {
  createQuickCombatCharacter,
  type QuickCharacterConfig,
} from '../../../../../utils/sandbox/quickCharacterGenerator';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Fairy race one deterministic Flight transaction
 * inside the Tactical Sandbox Race domain.
 *
 * It builds the actor through the production quick-character seam, projects
 * real catalogue armour into the combat equipment view, and sends legal flight
 * to the native aerial resolver. The only local rule adapter is the Fairy
 * armour gate because the shared resolver does not yet know race-specific
 * restrictions. The leaf reports position, altitude, movement spent, armour,
 * Fairy Magic facts, and atomic rejection outcomes without pretending to cast a
 * spell or apply a visual effect.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Fairy data, ALL_ITEMS, combat equipment projection,
 * and src/utils/combat/aerialMovementUtils.ts.
 */

// ============================================================================
// Canonical Fairy Facts
// ============================================================================
// These helpers read the supplied Race record and the shared racial-choice
// library. They are intentionally pure from the leaf's point of view, so tests
// can prove the preview is showing production facts rather than copied prose.
// ============================================================================

export const FAIRY_FLIGHT_CONTROL_ID = 'resolve-fairy-flight';
export const FAIRY_ARMOR_CONTROL_ID = 'fairy-flight-armor';
export const FAIRY_FLYER_ID = 'fairy-flight-tester';

export type FairyArmorCase = 'none' | 'light' | 'medium' | 'heavy';

export const FAIRY_ARMOR_CASES: readonly FairyArmorCase[] = [
  'none',
  'light',
  'medium',
  'heavy',
];

const FAIRY_ARMOR_ITEM_IDS: Record<Exclude<FairyArmorCase, 'none'>, string> = {
  light: 'leather_armor',
  medium: 'breastplate',
  heavy: 'plate_armor',
};

export interface FairyMagicFacts {
  traitName: string;
  spellGates: readonly { minLevel: number; spellId: string }[];
  availableAbilities: readonly string[];
  chosenAbility: string | null;
  boundary: string;
}

/** Read the canonical walking speed from the Fairy Speed trait. */
export function getCanonicalFairyWalkingSpeedFeet(race: Race): number | null {
  const speedTrait = race.traits.find(trait => /^Speed:/i.test(trait.trim()));
  const speed = speedTrait?.match(/(\d+)\s*feet/i)?.[1];
  return speed ? Number(speed) : null;
}

/** Confirm both halves of the canonical Fairy Flight sentence are present. */
export function hasCanonicalFairyFlight(race: Race): boolean {
  return race.id === 'fairy' && race.traits.some(trait => (
    /Flight:/i.test(trait)
    && /flying speed equal to your walking speed/i.test(trait)
    && /medium or heavy armor/i.test(trait)
  ));
}

/**
 * Return Fairy Magic's level gates and ability choices without selecting an
 * ability. Race data records the available choices, not a character's final
 * choice, so this leaf keeps `chosenAbility` explicitly null.
 */
export function getCanonicalFairyMagicFacts(race: Race): FairyMagicFacts {
  const choice = getRacialSpellCastingAbilityChoiceForRace(race.id);
  const magicTrait = race.traits.find(trait => /^Fairy Magic:/i.test(trait));
  // The shared library can return a legacy choice record without parsed ability
  // names. In that case, read the three names from the same canonical trait
  // text instead of inventing a new ability-choice source for this leaf.
  const traitAbilities = ['Intelligence', 'Wisdom', 'Charisma'].filter(ability => (
    new RegExp(`\\b${ability}\\b`, 'i').test(magicTrait ?? '')
  ));
  return {
    traitName: race.racialSpellChoice?.traitName ?? 'Fairy Magic',
    spellGates: (race.knownSpells ?? []).map(spell => ({
      minLevel: spell.minLevel,
      spellId: spell.spellId,
    })),
    availableAbilities: choice?.availableAbilities?.length
      ? choice.availableAbilities.map(ability => String(ability))
      : traitAbilities,
    chosenAbility: null,
    boundary: 'Facts only: this leaf does not choose an ability, cast a spell, spend a spell slot, or create an effect.',
  };
}

// ============================================================================
// Canonical Equipment Projection And Narrow Fairy Gate
// ============================================================================
// ALL_ITEMS supplies the actual armour records. createCombatEquipmentState is
// the production projection used at the persistent-character/combat boundary.
// The Fairy rule is kept as a narrow adapter because resolveAerialMovement has
// no race-aware armour policy yet; the resolver remains authoritative for every
// legal movement transaction after this gate passes.
// ============================================================================

function getFairyArmorItem(armorCase: FairyArmorCase): Item | undefined {
  if (armorCase === 'none') return undefined;
  return ALL_ITEMS[FAIRY_ARMOR_ITEM_IDS[armorCase]];
}

function getFairyArmorCategory(
  character: CombatCharacter,
): string | null {
  return character.equipment?.wornArmor?.category ?? null;
}

export function canFairyFlyWithArmor(character: CombatCharacter): boolean {
  const category = getFairyArmorCategory(character);
  return category === null || category === 'Light';
}

function getFairyArmorGateReason(character: CombatCharacter): string | null {
  const category = getFairyArmorCategory(character);
  if (category === 'Medium' || category === 'Heavy') {
    return `Fairy Flight is blocked by canonical ${category.toLowerCase()} armor.`;
  }
  return null;
}

// ============================================================================
// Deterministic Fairy Flight Scenario
// ============================================================================
// The board is deliberately small and open. A 15-foot horizontal move plus a
// 10-foot climb costs 25 feet, which proves the native resolver's 3D cost while
// leaving five feet visible in the 30-foot Fairy movement pool.
// ============================================================================

export interface FairyFlightScenarioState {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  armorCase: FairyArmorCase;
  lastResolution: AerialMovementResolution | null;
  outcome: string;
}

function createFairyFlightMap(): BattleMapData {
  const dimensions = { width: 10, height: 6 };
  const tiles = new Map<string, BattleMapTile>();

  // Every tile is a flat, open grass square so a rejection can be attributed
  // to Fairy armour or the native movement budget, not an accidental fixture.
  for (let y = 0; y < dimensions.height; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      const id = `${x}-${y}`;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: 'grass',
        elevation: 0,
        movementCost: 5,
        blocksLoS: false,
        blocksMovement: false,
        decoration: null,
        effects: [],
      });
    }
  }

  return {
    dimensions,
    tiles,
    theme: 'grass',
    seed: 25025,
  };
}

interface FairyFixtureSpec {
  id: string;
  position: { x: number; y: number };
  team: CombatCharacter['team'];
  config: QuickCharacterConfig;
}

function replaceCharacter(
  characters: CombatCharacter[],
  replacement: CombatCharacter,
): CombatCharacter[] {
  return characters.map(character => (
    character.id === replacement.id ? replacement : character
  ));
}

/** Build a Fairy actor from canonical race, equipment, and movement facts. */
export function createFairyFlightScenario(
  race: Race,
  armorCase: FairyArmorCase = 'none',
): FairyFlightScenarioState {
  const walkingSpeedFeet = getCanonicalFairyWalkingSpeedFeet(race) ?? 0;
  const armor = getFairyArmorItem(armorCase);
  const mapData = createFairyFlightMap();
  const fixtureSpecs: readonly FairyFixtureSpec[] = [
    {
      id: FAIRY_FLYER_ID,
      position: { x: 2, y: 2 },
      team: 'player',
      config: {
        name: 'Fairy Flight Tester',
        raceId: 'fairy',
        classId: 'fighter',
        level: 1,
        stats: [10, 15, 12, 10, 10, 10],
      },
    },
  ];

  // Use the production quick-character seam and leave a missing canonical
  // catalogue record visible instead of substituting a fake actor.
  const generatedCharacters = fixtureSpecs.map(spec => {
    const character = createQuickCombatCharacter(spec.config);
    return character
      ? {
          ...character,
          id: spec.id,
          position: { ...spec.position },
          team: spec.team,
        }
      : null;
  });
  const baseCharacters = generatedCharacters.filter(
    (character): character is CombatCharacter => character !== null,
  );
  if (baseCharacters.length !== fixtureSpecs.length) {
    return {
      mapData,
      characters: baseCharacters,
      armorCase,
      lastResolution: null,
      outcome: 'Fairy Flight fixture unavailable: canonical quick-character generation returned null.',
    };
  }

  const baseFlyer = baseCharacters[0];
  const equipment = armor
    ? createCombatEquipmentState({ Torso: armor })
    : undefined;
  const flyer: CombatCharacter = {
    ...baseFlyer,
    name: `Fairy · Fly ${walkingSpeedFeet} ft · Armor ${armor?.armorCategory ?? 'none'}`,
    stats: {
      ...baseFlyer.stats,
      speed: walkingSpeedFeet,
      extraMovementSpeeds: {
        ...baseFlyer.stats.extraMovementSpeeds,
        // Medium/heavy armour has no effective Fly Speed. The canonical 30-foot
        // fact remains visible in the UI, while this effective value prevents a
        // caller from mistaking a blocked Fairy for an airborne actor.
        fly: armor && (armor.armorCategory === 'Medium' || armor.armorCategory === 'Heavy')
          ? 0
          : walkingSpeedFeet,
      },
    },
    equipment,
    aerialMovement: {
      altitudeFeet: 0,
      isFlying: true,
      canHover: false,
      source: 'Fairy Flight canonical race trait',
    },
    actionEconomy: {
      ...baseFlyer.actionEconomy,
      movement: { used: 0, total: walkingSpeedFeet },
    },
  };

  const outcome = hasCanonicalFairyFlight(race)
    ? `Ready: Fairy Flight equals walking speed (${walkingSpeedFeet} ft); effective Fly ${flyer.stats.extraMovementSpeeds?.fly ?? 0} ft.`
    : 'Flight unavailable: canonical Fairy Speed and Flight traits were not both present.';

  return {
    mapData,
    characters: replaceCharacter(baseCharacters, flyer),
    armorCase,
    lastResolution: null,
    outcome,
  };
}

/** Resolve one deterministic 3D destination through the native aerial helper. */
export function resolveFairyFlight(
  scenario: FairyFlightScenarioState,
): FairyFlightScenarioState {
  const flyer = scenario.characters.find(character => character.id === FAIRY_FLYER_ID);
  if (!flyer) {
    return {
      ...scenario,
      outcome: 'Flight rejected: the deterministic Fairy actor is missing.',
    };
  }

  // Race-aware armour policy is the explicit local boundary. No position,
  // altitude, or movement resource is changed when this check rejects.
  const armorGateReason = getFairyArmorGateReason(flyer);
  if (armorGateReason) {
    const unchanged = `${flyer.position.x},${flyer.position.y}@${flyer.aerialMovement?.altitudeFeet ?? 0} ft; Move ${flyer.actionEconomy.movement.used}/${flyer.actionEconomy.movement.total}`;
    return {
      ...scenario,
      lastResolution: null,
      outcome: `Flight rejected atomically: ${armorGateReason} Unchanged: ${unchanged}.`,
    };
  }

  const resolution = resolveAerialMovement({
    character: flyer,
    destination: { x: 5, y: 2 },
    destinationAltitudeFeet: 10,
    mapData: scenario.mapData,
    characters: scenario.characters,
  });
  const before = `${flyer.position.x},${flyer.position.y}@${flyer.aerialMovement?.altitudeFeet ?? 0} ft; Move ${flyer.actionEconomy.movement.used}/${flyer.actionEconomy.movement.total}`;

  if (!resolution.allowed) {
    return {
      ...scenario,
      lastResolution: resolution,
      outcome: `Flight rejected atomically: ${resolution.reason} Unchanged: ${before}.`,
    };
  }

  return {
    ...scenario,
    characters: replaceCharacter(scenario.characters, resolution.character),
    lastResolution: resolution,
    outcome: `Flight resolved: ${resolution.horizontalDistanceFeet} horizontal + ${resolution.verticalDistanceFeet} vertical = ${resolution.costFeet} ft; Move ${resolution.character.actionEconomy.movement.used}/${resolution.character.actionEconomy.movement.total}.`,
  };
}

function getFairyFlyer(scenario: FairyFlightScenarioState): CombatCharacter | undefined {
  return scenario.characters.find(character => character.id === FAIRY_FLYER_ID);
}

// ============================================================================
// Fairy Leaf UI
// ============================================================================
// The UI keeps the canonical facts, effective actor state, and event outcome
// together. The parent shell owns Reset through resetCount; a keyed content
// boundary below remounts all local state from the canonical baseline.
// ============================================================================

const FairyRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  state,
  onScenarioEvent,
}) => {
  const [armorCase, setArmorCase] = useState<FairyArmorCase>('none');
  const [scenario, setScenario] = useState<FairyFlightScenarioState>(
    () => createFairyFlightScenario(race),
  );
  const walkingSpeedFeet = getCanonicalFairyWalkingSpeedFeet(race);
  const magicFacts = getCanonicalFairyMagicFacts(race);
  const flyer = getFairyFlyer(scenario);

  const handleArmorChange = (nextArmorCase: FairyArmorCase) => {
    // Changing the authored armour case starts a fresh deterministic actor so
    // a previous movement payment cannot leak into a different equipment proof.
    setArmorCase(nextArmorCase);
    setScenario(createFairyFlightScenario(race, nextArmorCase));
  };

  const handleResolve = () => {
    const nextScenario = resolveFairyFlight(scenario);
    setScenario(nextScenario);
    const resolution = nextScenario.lastResolution;
    const message = resolution?.allowed
      ? `Fairy FLIGHT RESOLVED: ${resolution.costFeet} ft paid; position ${resolution.character.position.x},${resolution.character.position.y}@${resolution.character.aerialMovement?.altitudeFeet ?? 0} ft; Move ${resolution.character.actionEconomy.movement.used}/${resolution.character.actionEconomy.movement.total}.`
      : `Fairy FLIGHT REJECTED ATOMICALLY: ${nextScenario.outcome}`;
    onScenarioEvent(message);
  };

  return (
    <section aria-labelledby="fairy-flight-title" data-testid="fairy-race-leaf">
      {/* The heading names the exact canonical racial transaction. */}
      <h4 id="fairy-flight-title">Fairy Flight</h4>
      <p data-testid="fairy-canonical-traits">
        Canonical: Speed {walkingSpeedFeet ?? 'unknown'} ft; Flight equals walking speed; medium/heavy armor blocks Flight.
      </p>

      {/* The selector uses real catalogue items and restarts the isolated proof actor. */}
      <label htmlFor={FAIRY_ARMOR_CONTROL_ID}>Worn armor</label>
      <select
        id={FAIRY_ARMOR_CONTROL_ID}
        value={armorCase}
        onChange={event => handleArmorChange(event.target.value as FairyArmorCase)}
      >
        <option value="none">No armor</option>
        <option value="light">Light · Leather Armor</option>
        <option value="medium">Medium · Breastplate</option>
        <option value="heavy">Heavy · Plate Armor</option>
      </select>
      <Button type="button" onClick={handleResolve}>
        Resolve Fairy flight
      </Button>

      {/* These facts prove live state and resource payment, rather than only a label. */}
      <p data-testid="fairy-flight-actor">
        Actor: {flyer?.name ?? 'missing'}; Armor {flyer?.equipment?.wornArmor?.category ?? 'none'}; Position {flyer?.position.x},{flyer?.position.y}@{flyer?.aerialMovement?.altitudeFeet ?? 0} ft; Canonical Fly {walkingSpeedFeet ?? 0} ft; Effective Fly {flyer?.stats.extraMovementSpeeds?.fly ?? 0} ft; Move {flyer?.actionEconomy.movement.used}/{flyer?.actionEconomy.movement.total}.
      </p>
      <p aria-live="polite" role="status" data-testid="fairy-flight-outcome">{scenario.outcome}</p>

      {/* Fairy Magic is displayed as source facts only; no cast button is exposed. */}
      <p data-testid="fairy-magic-facts">
        {magicFacts.traitName}: {magicFacts.spellGates.map(gate => `${gate.spellId} at level ${gate.minLevel}`).join(', ')}; abilities {magicFacts.availableAbilities.join(', ') || 'not resolved'}; chosen ability {magicFacts.chosenAbility ?? 'not selected'}.
      </p>
      <p data-testid="fairy-magic-boundary">{magicFacts.boundary}</p>

      {/* The shared resolver has no race-aware armour policy, so this boundary is explicit. */}
      <p data-testid="fairy-armor-boundary">
        Boundary: Fairy armor gating is a canonical-derived leaf adapter; native aerial movement still owns route, altitude, footprint, and movement atomicity.
      </p>
      <span data-testid="fairy-reset-count" hidden>{state.resetCount}</span>
    </section>
  );
};

export const FairyRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <FairyRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires this exact named registration export. Keeping
// it local lets another race leaf land without a shared registry edit.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'fairy-flight',
  raceId: 'fairy',
  label: 'Fairy Flight',
  description: 'Resolve canonical Fairy Flight with production movement, equipment, and armour boundaries.',
  Component: FairyRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
