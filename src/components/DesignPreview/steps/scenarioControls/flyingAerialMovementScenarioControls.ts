// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 03:23:04
 * Dependents: components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the deterministic Flying & Aerial Movement sandbox board.
 *
 * Its flyer carries a real 40-foot Fly Speed and persisted altitude. The legal
 * control delegates movement, full-footprint airspace, elevation, and budget
 * checks to the shared aerial resolver. Controls resolve against live state so
 * repeated flight consumes one budget, and landing or lost support delegates
 * to the canonical falling-ground-impact transaction.
 *
 * Called by: PreviewCombatScenarios and the scenario-control registry.
 * Depends on: shared aerial movement, elevation, placement, and map state.
 */

import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  LightSource,
  Position,
  SpellSlots,
} from '../../../../types/combat';
import {
  buildAerialRoute,
  resolveAerialMovement,
} from '../../../../utils/combat/aerialMovementUtils';
import {
  resolveAerialLandingImpact,
  resolveAerialSupportLossImpact,
} from '../../../../systems/combat/fallingGroundImpactResolution';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Authored Board Facts
// ============================================================================
// The legal route travels twenty-five feet east and climbs ten feet, for a
// thirty-five-foot cost. Mud and a low wall underneath make ground/aerial
// behavior visibly different without changing the route's legal airspace.
// ============================================================================

export const FLYING_AERIAL_FLYER_ID = 'flying_aerial_movement-flyer';
export const FLYING_AERIAL_GROUND_CREATURE_ID = 'flying_aerial_movement-ground-creature';
export const FLYING_AERIAL_AIRSPACE_GUARD_ID = 'flying_aerial_movement-airspace-guard';
export const FLYING_AERIAL_START = { x: 3, y: 6 } as const;
export const FLYING_AERIAL_FIRST_DESTINATION = { x: 6, y: 6 } as const;
export const FLYING_AERIAL_LEGAL_DESTINATION = { x: 8, y: 6 } as const;
export const FLYING_AERIAL_FINAL_DESTINATION = { x: 9, y: 6 } as const;
export const FLYING_AERIAL_OCCUPIED_DESTINATION = { x: 10, y: 6 } as const;
export const FLYING_AERIAL_BLOCKED_DESTINATION = { x: 11, y: 8 } as const;
export const FLYING_AERIAL_OFF_BOARD_DESTINATION = { x: 16, y: 6 } as const;
export const FLYING_AERIAL_INSUFFICIENT_DESTINATION = { x: 13, y: 2 } as const;

export const FLYING_AERIAL_START_ALTITUDE_FEET = 10;
export const FLYING_AERIAL_DESTINATION_ALTITUDE_FEET = 20;
export const FLYING_AERIAL_FLY_SPEED_FEET = 40;
export const FLYING_AERIAL_LEGAL_COST_FEET = 20;

const INVALID_DESTINATION_CONTROL_ID = 'invalid-destination';
const LANDING_CASE_CONTROL_ID = 'landing-support-case';
const LOW_OBSTACLE = { x: 6, y: 6 } as const;
const TALL_BLOCKER = { x: 6, y: 8 } as const;
const LOW_CEILING = { x: 6, y: 9 } as const;
const AIRSPACE_GUARD_POSITION = { x: 6, y: 10 } as const;
const ROUTE_CELLS: Position[] = [
  { x: 4, y: 6 },
  { x: 5, y: 6 },
  { x: 6, y: 6 },
  { x: 7, y: 6 },
];

type InvalidDestinationChoice =
  | 'route_tall_blocker'
  | 'route_ceiling'
  | 'route_occupied_flyer'
  | 'occupied'
  | 'blocked'
  | 'off_board'
  | 'insufficient_speed';

type LandingSupportChoice =
  | 'controlled_descent'
  | 'support_loss'
  | 'support_loss_feather_fall'
  | 'support_loss_resistance'
  | 'support_loss_downing';

// ============================================================================
// Board Preparation
// ============================================================================
// Preparation is idempotent, so initial mount, every isolated control, and
// Reset Board all return to the same published speed, altitude, terrain, and
// destination facts before resolving one outcome.
// ============================================================================

function updateTile(
  mapData: BattleMapData,
  position: Position,
  patch: Partial<BattleMapTile>,
): BattleMapData {
  const key = `${position.x}-${position.y}`;
  const tile = mapData.tiles.get(key);
  if (!tile) return mapData;

  const tiles = new Map(mapData.tiles);
  tiles.set(key, { ...tile, ...patch });
  return { ...mapData, tiles };
}

export function prepareFlyingAerialMovementMapData(
  mapData: BattleMapData,
): BattleMapData {
  let prepared = mapData;

  // Mud beneath the first two path cells is real difficult terrain. The aerial
  // resolver receives these cells as evidence but never multiplies flight cost.
  for (const position of ROUTE_CELLS.slice(0, 2)) {
    prepared = updateTile(prepared, position, {
      terrain: 'mud',
      movementCost: 10,
      blocksMovement: false,
      blocksLoS: false,
      decoration: null,
      effects: ['aerial-route-difficult-ground'],
    });
  }

  // The ten-foot obstacle blocks ground movement and sight. The legal route's
  // twenty-foot altitude clears it without removing the wall from either view.
  prepared = updateTile(prepared, LOW_OBSTACLE, {
    terrain: 'wall',
    elevation: 10,
    movementCost: 10,
    blocksMovement: true,
    blocksLoS: true,
    decoration: null,
    effects: ['aerial-route-low-obstacle-10-ft'],
  });

  // A raised open landing and neighboring rock pad make the destination height
  // legible in 3D. The flyer remains ten feet above that ten-foot surface.
  for (let y = 5; y <= 7; y += 1) {
    prepared = updateTile(prepared, { x: 8, y }, {
      terrain: 'rock',
      elevation: 10,
      movementCost: 5,
      blocksMovement: false,
      blocksLoS: false,
      decoration: null,
      effects: y === 6 ? ['legal-aerial-destination-20-ft'] : ['raised-landing-pad-10-ft'],
    });
  }

  prepared = updateTile(prepared, FLYING_AERIAL_OCCUPIED_DESTINATION, {
    terrain: 'sand',
    elevation: 0,
    movementCost: 5,
    blocksMovement: false,
    blocksLoS: false,
    decoration: null,
    effects: ['occupied-ground-destination'],
  });

  prepared = updateTile(prepared, FLYING_AERIAL_BLOCKED_DESTINATION, {
    terrain: 'wall',
    elevation: 10,
    movementCost: 10,
    blocksMovement: true,
    blocksLoS: true,
    decoration: null,
    effects: ['blocked-airspace-at-10-ft'],
    airspace: { blocksFlight: true },
  });

  // These volumes sit away from the legal lane. Invalid controls deliberately
  // route through them so failure identifies the traversed segment rather than
  // merely checking the endpoint.
  prepared = updateTile(prepared, TALL_BLOCKER, {
    terrain: 'wall',
    elevation: 10,
    movementCost: 10,
    blocksMovement: true,
    blocksLoS: true,
    decoration: null,
    effects: ['tall-flight-blocker-top-30-ft'],
    airspace: { blockerTopFeet: 30 },
  });
  prepared = updateTile(prepared, LOW_CEILING, {
    effects: ['low-flight-ceiling-18-ft'],
    airspace: { ceilingFeet: 18 },
  });
  prepared = updateTile(prepared, AIRSPACE_GUARD_POSITION, {
    effects: ['occupied-flying-footprint-15-ft'],
  });

  return prepared;
}

/** Supplies the complete resource record required by Feather Fall. */
function createFeatherFallSpellSlots(): SpellSlots {
  return {
    level_1: { current: 1, max: 1 },
    level_2: { current: 0, max: 0 },
    level_3: { current: 0, max: 0 },
    level_4: { current: 0, max: 0 },
    level_5: { current: 0, max: 0 },
    level_6: { current: 0, max: 0 },
    level_7: { current: 0, max: 0 },
    level_8: { current: 0, max: 0 },
    level_9: { current: 0, max: 0 },
  };
}

export function prepareFlyingAerialMovementCharacters(
  characters: CombatCharacter[],
): CombatCharacter[] {
  return characters.map(character => {
    if (character.id === FLYING_AERIAL_FLYER_ID) {
      return {
        ...character,
        name: 'Aerial Scout · Fly 40 ft · altitude 10 ft · Move 0/40 · no hover',
        position: { ...FLYING_AERIAL_START },
        team: 'player',
        stats: {
          ...character.stats,
          speed: 30,
          size: 'Medium',
          extraMovementSpeeds: { ...character.stats.extraMovementSpeeds, fly: FLYING_AERIAL_FLY_SPEED_FEET },
        },
        aerialMovement: {
          altitudeFeet: FLYING_AERIAL_START_ALTITUDE_FEET,
          isFlying: true,
          canHover: false,
          source: 'Aerial Scout stat block',
        },
        actionEconomy: {
          ...character.actionEconomy,
          movement: { used: 0, total: FLYING_AERIAL_FLY_SPEED_FEET },
        },
        abilities: [],
      };
    }

    if (character.id === FLYING_AERIAL_GROUND_CREATURE_ID) {
      return {
        ...character,
        name: 'Ground Warden · altitude 0 ft · occupies 10,6',
        position: { ...FLYING_AERIAL_OCCUPIED_DESTINATION },
        team: 'enemy',
        stats: { ...character.stats, size: 'Medium' },
        aerialMovement: undefined,
        abilities: [],
      };
    }

    if (character.id === FLYING_AERIAL_AIRSPACE_GUARD_ID) {
      return {
        ...character,
        name: 'Aerie Mage | altitude 15 ft | Feather Fall | Reaction ready | L1 1/1',
        position: { ...AIRSPACE_GUARD_POSITION },
        team: 'player',
        spellbook: { knownSpells: ['feather-fall'], preparedSpells: [], cantrips: [] },
        spellSlots: createFeatherFallSpellSlots(),
        aerialMovement: {
          altitudeFeet: 15,
          isFlying: true,
          canHover: true,
          source: 'Aerie Mage hover trait',
        },
        actionEconomy: {
          ...character.actionEconomy,
          reaction: { ...character.actionEconomy.reaction, used: false, remaining: 1 },
        },
        abilities: [],
      };
    }

    return character;
  });
}

function baselineCueLights(): LightSource[] {
  return [
    {
      id: 'flying-aerial-source-cue',
      sourceSpellId: 'flying-aerial-movement-scenario',
      casterId: FLYING_AERIAL_FLYER_ID,
      brightRadius: 5,
      dimRadius: 5,
      attachedTo: 'point',
      position: { ...FLYING_AERIAL_START },
      color: '#fbbf24',
      createdTurn: 0,
    },
    {
      id: 'flying-aerial-path-cue',
      sourceSpellId: 'flying-aerial-movement-scenario',
      casterId: FLYING_AERIAL_FLYER_ID,
      brightRadius: 5,
      dimRadius: 5,
      attachedTo: 'point',
      position: { ...LOW_OBSTACLE },
      color: '#22d3ee',
      createdTurn: 0,
    },
    {
      id: 'flying-aerial-destination-cue',
      sourceSpellId: 'flying-aerial-movement-scenario',
      casterId: FLYING_AERIAL_FLYER_ID,
      brightRadius: 5,
      dimRadius: 5,
      attachedTo: 'point',
      position: { ...FLYING_AERIAL_LEGAL_DESTINATION },
      color: '#38bdf8',
      createdTurn: 0,
    },
  ];
}

function prepareBaseline(application: PreviewCombatScenarioControlApplication) {
  const mapData = application.snapshot.mapData
    ? prepareFlyingAerialMovementMapData(application.snapshot.mapData)
    : null;
  const characters = prepareFlyingAerialMovementCharacters(application.snapshot.characters);
  const flyer = characters.find(character => character.id === FLYING_AERIAL_FLYER_ID);
  return { mapData, characters, flyer };
}

/** Reads the current turn state without re-baselining its actors. */
function readLiveBoard(application: PreviewCombatScenarioControlApplication) {
  const mapData = application.snapshot.mapData
    ? prepareFlyingAerialMovementMapData(application.snapshot.mapData)
    : null;
  const characters = application.snapshot.characters;
  const flyer = characters.find(character => character.id === FLYING_AERIAL_FLYER_ID);
  return { mapData, characters, flyer };
}

function positionsMatch(first: Position, second: Position): boolean {
  return first.x === second.x && first.y === second.y;
}

function replaceCharacter(
  characters: CombatCharacter[],
  replacement: CombatCharacter,
): CombatCharacter[] {
  return characters.map(character => (
    character.id === replacement.id ? replacement : character
  ));
}

// ============================================================================
// Invalid Destination Boundaries
// ============================================================================
// Endpoint fixtures are combined with live routed hazards below. Each rejected
// transaction returns the same actor object and movement ledger.
// ============================================================================

function invalidDestination(choice: InvalidDestinationChoice): {
  position: Position;
  altitudeFeet: number;
} {
  if (choice === 'occupied') {
    return { position: FLYING_AERIAL_OCCUPIED_DESTINATION, altitudeFeet: 0 };
  }
  if (choice === 'blocked') {
    return { position: FLYING_AERIAL_BLOCKED_DESTINATION, altitudeFeet: 10 };
  }
  if (choice === 'off_board') {
    return { position: FLYING_AERIAL_OFF_BOARD_DESTINATION, altitudeFeet: 20 };
  }
  return { position: FLYING_AERIAL_INSUFFICIENT_DESTINATION, altitudeFeet: 25 };
}

// ============================================================================
// Live Same-Turn Flight And Route Rejections
// ============================================================================
// Every action preserves the mounted snapshot and consumes only canonical
// movement or fall state returned by production helpers.
// ============================================================================

function resolveNextLiveFlight(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const live = readLiveBoard(application);
  if (!live.mapData || !live.flyer || !live.flyer.aerialMovement) {
    return { logMessage: 'Aerial move skipped because its live map or flyer is missing.' };
  }

  const current = live.flyer.position;
  const destination = positionsMatch(current, FLYING_AERIAL_START)
    ? FLYING_AERIAL_FIRST_DESTINATION
    : positionsMatch(current, FLYING_AERIAL_FIRST_DESTINATION)
    ? FLYING_AERIAL_LEGAL_DESTINATION
    : positionsMatch(current, FLYING_AERIAL_LEGAL_DESTINATION)
    ? FLYING_AERIAL_FINAL_DESTINATION
    : FLYING_AERIAL_OCCUPIED_DESTINATION;
  const destinationAltitudeFeet = positionsMatch(destination, FLYING_AERIAL_FIRST_DESTINATION)
    ? 15
    : 20;
  const startAltitudeFeet = live.flyer.aerialMovement.altitudeFeet;
  const result = resolveAerialMovement({
    character: live.flyer,
    destination,
    destinationAltitudeFeet,
    mapData: live.mapData,
    characters: live.characters,
  });

  if (!result.allowed) {
    return {
      mapData: live.mapData,
      characters: live.characters,
      activeLightSources: baselineCueLights(),
      logMessage: `AERIAL MOVE REJECTED ATOMICALLY: ${result.reason} Position ${current.x},${current.y}@${startAltitudeFeet} ft and Move ${live.flyer.actionEconomy.movement.used}/${live.flyer.actionEconomy.movement.total} remain unchanged.`,
    };
  }

  const namedResult: CombatCharacter = {
    ...result.character,
    name: `Aerial Scout | Fly ${result.flySpeedFeet} ft | ${current.x},${current.y}@${startAltitudeFeet} -> ${destination.x},${destination.y}@${destinationAltitudeFeet} | 3D ${result.horizontalDistanceFeet}+${result.verticalDistanceFeet}=${result.costFeet} ft | Move ${result.character.actionEconomy.movement.used}/${result.character.actionEconomy.movement.total}`,
  };
  return {
    mapData: live.mapData,
    characters: replaceCharacter(live.characters, namedResult),
    activeLightSources: baselineCueLights(),
    logMessage: `AERIAL MOVE RESOLVED: ${current.x},${current.y}@${startAltitudeFeet} ft -> ${destination.x},${destination.y}@${destinationAltitudeFeet} ft. 3D path ${result.horizontalDistanceFeet} horizontal + ${result.verticalDistanceFeet} vertical = ${result.costFeet} ft; live movement ${namedResult.actionEconomy.movement.used}/${namedResult.actionEconomy.movement.total}. Difficult ground adds 0 aerial cost and legal air clears the low obstacle.`,
  };
}

function routeThrough(
  flyer: CombatCharacter,
  destination: Position,
  destinationAltitudeFeet: number,
  via: Position,
  viaAltitudeFeet: number,
) {
  const startAltitudeFeet = flyer.aerialMovement?.altitudeFeet ?? 0;
  const first = buildAerialRoute(flyer.position, via, startAltitudeFeet, viaAltitudeFeet);
  const second = buildAerialRoute(via, destination, viaAltitudeFeet, destinationAltitudeFeet);
  return [...first, ...second.slice(1)];
}

function liveInvalidFixture(
  choice: InvalidDestinationChoice,
  flyer: CombatCharacter,
): { position: Position; altitudeFeet: number; route?: ReturnType<typeof buildAerialRoute> } {
  if (choice === 'route_tall_blocker') {
    return {
      position: { x: 7, y: 8 },
      altitudeFeet: 20,
      route: routeThrough(flyer, { x: 7, y: 8 }, 20, TALL_BLOCKER, 20),
    };
  }
  if (choice === 'route_ceiling') {
    return {
      position: { x: 7, y: 9 },
      altitudeFeet: 20,
      route: routeThrough(flyer, { x: 7, y: 9 }, 20, LOW_CEILING, 15),
    };
  }
  if (choice === 'route_occupied_flyer') {
    return {
      position: { x: 7, y: 10 },
      altitudeFeet: 15,
      route: routeThrough(flyer, { x: 7, y: 10 }, 15, AIRSPACE_GUARD_POSITION, 15),
    };
  }
  if (choice === 'occupied') {
    return {
      position: FLYING_AERIAL_OCCUPIED_DESTINATION,
      altitudeFeet: 0,
      route: routeThrough(
        flyer,
        FLYING_AERIAL_OCCUPIED_DESTINATION,
        0,
        FLYING_AERIAL_OCCUPIED_DESTINATION,
        20,
      ),
    };
  }
  const destination = invalidDestination(choice);
  return { position: destination.position, altitudeFeet: destination.altitudeFeet };
}

function rejectInvalidLiveRoute(
  application: PreviewCombatScenarioControlApplication,
  choice: InvalidDestinationChoice,
): PreviewCombatScenarioControlPatch {
  const live = readLiveBoard(application);
  if (!live.mapData || !live.flyer || !live.flyer.aerialMovement) {
    return { logMessage: 'Invalid aerial route skipped because its live board is missing.' };
  }
  const fixture = liveInvalidFixture(choice, live.flyer);
  const result = resolveAerialMovement({
    character: live.flyer,
    destination: fixture.position,
    destinationAltitudeFeet: fixture.altitudeFeet,
    route: fixture.route,
    mapData: live.mapData,
    characters: live.characters,
  });
  const unchanged = `${live.flyer.position.x},${live.flyer.position.y}@${live.flyer.aerialMovement.altitudeFeet} ft; Move ${live.flyer.actionEconomy.movement.used}/${live.flyer.actionEconomy.movement.total}`;
  return {
    mapData: live.mapData,
    characters: live.characters,
    activeLightSources: baselineCueLights(),
    logMessage: result.allowed
      ? `INVALID ROUTE FIXTURE ERROR (${choice}): unexpectedly legal; no result applied. ${unchanged} remains unchanged.`
      : `AERIAL ROUTE REJECTED ATOMICALLY (${choice}): ${result.reason} ${unchanged} remains unchanged; no partial position, altitude, cost, landing, or cue was applied.`,
  };
}

// ============================================================================
// Controlled Landing And Lost Support
// ============================================================================
// Controlled descent first pays aerial movement and then uses the zero-damage
// landing transaction. Lost support sets Fly Speed to zero and delegates the
// actual drop, defenses, Feather Fall, HP/downing, and Prone to CS32.
// ============================================================================

function resolveLandingOrSupport(
  application: PreviewCombatScenarioControlApplication,
  choice: LandingSupportChoice,
): PreviewCombatScenarioControlPatch {
  const live = readLiveBoard(application);
  if (!live.mapData || !live.flyer || !live.flyer.aerialMovement) {
    return { logMessage: 'Landing/support resolution skipped because its live board is missing.' };
  }

  if (choice === 'controlled_descent') {
    const groundAltitudeFeet = live.mapData.tiles.get(`${live.flyer.position.x}-${live.flyer.position.y}`)?.elevation ?? 0;
    const descent = resolveAerialMovement({
      character: live.flyer,
      destination: live.flyer.position,
      destinationAltitudeFeet: groundAltitudeFeet * 5,
      mapData: live.mapData,
      characters: live.characters,
    });
    if (!descent.allowed) {
      return {
        mapData: live.mapData,
        characters: live.characters,
        logMessage: `CONTROLLED DESCENT REJECTED ATOMICALLY: ${descent.reason}`,
      };
    }
    const impact = resolveAerialLandingImpact({
      eventId: `cs33-controlled-descent-${live.flyer.actionEconomy.movement.used}`,
      character: descent.character,
      landingPosition: descent.character.position,
      mapData: live.mapData,
      characters: replaceCharacter(live.characters, descent.character),
      fallDistanceFeet: 0,
    });
    return {
      mapData: live.mapData,
      characters: impact.characters,
      activeLightSources: baselineCueLights(),
      logMessage: `CONTROLLED DESCENT ${impact.status.toUpperCase()}: paid ${descent.costFeet} ft, landed at altitude ${descent.character.aerialMovement?.altitudeFeet ?? 0} ft, damage ${impact.hpDamage}, Prone ${impact.proneApplied}; Move ${descent.character.actionEconomy.movement.used}/${descent.character.actionEconomy.movement.total}. ${impact.reason}`,
    };
  }

  let candidate: CombatCharacter = {
    ...live.flyer,
    currentHP: choice === 'support_loss_downing' ? 4 : live.flyer.currentHP,
    maxHP: Math.max(live.flyer.maxHP, 20),
    resistances: choice === 'support_loss_resistance'
      ? [...new Set([...(live.flyer.resistances ?? []), 'bludgeoning' as const])]
      : live.flyer.resistances,
    stats: {
      ...live.flyer.stats,
      extraMovementSpeeds: { ...live.flyer.stats.extraMovementSpeeds, fly: 0 },
    },
  };
  const roster = replaceCharacter(live.characters, candidate);
  const impact = resolveAerialSupportLossImpact({
    eventId: `cs33-support-loss-${choice}-${live.flyer.actionEconomy.movement.used}`,
    characterId: candidate.id,
    landingPosition: candidate.position,
    mapData: live.mapData,
    characters: roster,
    damageRng: () => 0.5,
    featherFall: choice === 'support_loss_feather_fall'
      ? {
        casterId: FLYING_AERIAL_AIRSPACE_GUARD_ID,
        selectedTargetIds: [candidate.id],
        choice: 'accept',
      }
      : undefined,
  });
  candidate = impact.faller ?? candidate;
  const caster = impact.featherFallCaster;
  const downing = candidate.currentHP === 0
    ? ` DOWNED 0 HP ${candidate.deathSaves?.successes ?? 0}S/${candidate.deathSaves?.failures ?? 0}F.`
    : '';
  const feather = impact.featherFallOutcome === 'not_requested'
    ? ''
    : ` Feather Fall ${impact.featherFallOutcome}; Reaction ${caster?.actionEconomy.reaction.used ? 'spent' : 'ready'}; L1 ${caster?.spellSlots?.level_1.current ?? 0}/1.`;
  return {
    mapData: live.mapData,
    characters: impact.characters,
    activeLightSources: baselineCueLights(),
    logMessage: `SUPPORT LOSS ${impact.status.toUpperCase()}: landed ${candidate.position.x},${candidate.position.y}@${candidate.aerialMovement?.altitudeFeet ?? 0} ft; fall ${impact.fallDistanceFeet} ft; ${impact.damageDice}d6 raw ${impact.rawDamage}, defended ${impact.defendedDamage}, HP damage ${impact.hpDamage}; Prone ${impact.proneApplied}.${feather}${downing} ${impact.reason}`,
  };
}

// ============================================================================
// Control Dispatch And Registration
// ============================================================================
// One action proves legal 3D movement, one selector covers four atomic failure
// classes, and one action publishes the support-loss runtime boundary. Reset is
// supplied by the shared Tactical Sandbox host.
// ============================================================================

function applyControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.controlId === INVALID_DESTINATION_CONTROL_ID) {
    const choice = String(application.value) as InvalidDestinationChoice;
    const choices: InvalidDestinationChoice[] = [
      'route_tall_blocker',
      'route_ceiling',
      'route_occupied_flyer',
      'occupied',
      'blocked',
      'off_board',
      'insufficient_speed',
    ];
    return choices.includes(choice)
      ? rejectInvalidLiveRoute(application, choice)
      : { logMessage: `Unknown invalid aerial destination: ${choice}.` };
  }

  if (application.controlId === LANDING_CASE_CONTROL_ID) {
    return { logMessage: `Landing/support case selected: ${String(application.value)}.` };
  }

  // Inert action defaults still prepare the visible baseline during mount and
  // Reset Board. A real action click arrives as true and resolves one outcome.
  if (application.value === false) {
    const baseline = prepareBaseline(application);
    return {
      mapData: baseline.mapData ?? undefined,
      characters: baseline.characters,
      activeLightSources: baselineCueLights(),
      logMessage: '',
    };
  }
  if (application.value !== true) {
    return { logMessage: `Flying control ${application.controlId} requires an action trigger.` };
  }

  if (application.controlId === 'legal-aerial-move') {
    return resolveNextLiveFlight(application);
  }
  if (application.controlId === 'resolve-landing-support') {
    const choice = String(
      application.snapshot.controlValues?.[LANDING_CASE_CONTROL_ID] ?? 'controlled_descent',
    ) as LandingSupportChoice;
    const choices: LandingSupportChoice[] = [
      'controlled_descent',
      'support_loss',
      'support_loss_feather_fall',
      'support_loss_resistance',
      'support_loss_downing',
    ];
    return choices.includes(choice)
      ? resolveLandingOrSupport(application, choice)
      : { logMessage: `Unknown landing/support case: ${choice}.` };
  }

  return { logMessage: `Unknown Flying & Aerial Movement control: ${application.controlId}.` };
}

const flyingAerialMovementScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'flying_aerial_movement',
  controls: [
    {
      id: 'legal-aerial-move',
      label: 'Fly next leg',
      description: 'Spend live Fly movement: 20 ft, then 15 ft, then 5 ft; a fourth click rejects with no remaining speed.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: INVALID_DESTINATION_CONTROL_ID,
      label: 'Invalid destination',
      description: 'Reject traversed blockers, ceilings, occupied flyers, or invalid endpoints without partial state.',
      kind: 'select',
      defaultValue: 'route_tall_blocker',
      options: [
        { value: 'route_tall_blocker', label: 'Route: tall blocker' },
        { value: 'route_ceiling', label: 'Route: low ceiling' },
        { value: 'route_occupied_flyer', label: 'Route: occupied flyer' },
        { value: 'occupied', label: 'Occupied · 10,6@0 ft' },
        { value: 'blocked', label: 'Blocked · 11,8@10 ft' },
        { value: 'off_board', label: 'Off board · 16,6@20 ft' },
        { value: 'insufficient_speed', label: 'Insufficient Fly Speed' },
      ],
    },
    {
      id: LANDING_CASE_CONTROL_ID,
      label: 'Landing / support case',
      description: 'Choose controlled descent or support loss with Feather Fall, resistance, or downing.',
      kind: 'select',
      defaultValue: 'controlled_descent',
      options: [
        { value: 'controlled_descent', label: 'Controlled descent' },
        { value: 'support_loss', label: 'Support loss: ordinary' },
        { value: 'support_loss_feather_fall', label: 'Support loss: Feather Fall' },
        { value: 'support_loss_resistance', label: 'Support loss: resistance' },
        { value: 'support_loss_downing', label: 'Support loss: downing' },
      ],
    },
    {
      id: 'resolve-landing-support',
      label: 'Resolve landing / support',
      description: 'Run the selected descent or fall through the CS32 impact transaction.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl,
};

export default flyingAerialMovementScenarioControls;
