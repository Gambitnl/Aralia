// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 08:00:59
 * Dependents: components/DesignPreview/steps/scenarioControls/fallingGroundImpactScenarioControls.ts, components/DesignPreview/steps/scenarioControls/flyingAerialMovementScenarioControls.ts, hooks/combat/useActionExecutor.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves one creature's fall from an in-flight event to a legal
 * ground landing.
 *
 * The transaction validates the complete destination before changing state,
 * optionally resolves the canonical Feather Fall reaction and its shared
 * Reaction/slot payment, then sends rolled bludgeoning damage through the same
 * defense and HP/downing helpers used elsewhere in combat. The fall receipt on
 * the creature makes delivery idempotent when a UI or event bridge repeats it.
 *
 * Called by: Tactical Sandbox today and future movement/support-loss bridges.
 * Depends on: canonical spell data, placement, line of sight, action economy,
 * fall dice, damage defenses, HP/downing, and paired condition helpers.
 */

import featherFallData from '../../data/spells/level-1/feather-fall.json';
import type {
  BattleMapData,
  CombatCharacter,
  Position,
} from '../../types/combat';
import {
  calculateDamage,
  getCharacterDistance,
  rollDamage,
  validateCharacterPlacement,
} from '../../utils/combat/combatUtils';
import {
  canAffordActionCost,
  consumeActionCost,
} from '../../utils/combat/actionEconomyUtils';
import { applyDamageAndCheckDowned } from '../../utils/combat/deathSaveUtils';
import { calculateFallDamage } from '../../utils/combat/physicsUtils';
import { applyRuntimeStatusCondition } from '../../utils/combat/statusConditionUtils';
import {
  getBattleMapGroundAltitudeFeet,
  resolveAerialSupportLoss,
} from '../../utils/combat/aerialMovementUtils';
import { hasLineOfSight } from '../../utils/spatial/lineOfSight';

// ============================================================================
// Public Transaction Contract
// ============================================================================
// Callers provide the live roster and one already-authored fall event. The
// result returns the complete copied roster plus explicit rule facts for logs,
// tests, and renderers; callers never need to reconstruct the damage math.
// ============================================================================

export type FeatherFallChoice = 'accept' | 'decline';

export interface FeatherFallReactionRequest {
  casterId: string;
  selectedTargetIds: string[];
  choice: FeatherFallChoice;
}

export interface FallingGroundImpactInput {
  eventId: string;
  fallerId: string;
  landingPosition: Position;
  mapData: BattleMapData;
  characters: CombatCharacter[];
  damageRng?: () => number;
  featherFall?: FeatherFallReactionRequest;
}

export type FallingGroundImpactStatus = 'resolved' | 'rejected' | 'repeat';
export type FeatherFallOutcome = 'not_requested' | 'accepted' | 'declined' | 'rejected';

export interface FallingGroundImpactResult {
  status: FallingGroundImpactStatus;
  reason: string;
  characters: CombatCharacter[];
  faller?: CombatCharacter;
  featherFallCaster?: CombatCharacter;
  landingPosition?: Position;
  fallDistanceFeet: number;
  damageDice: number;
  damageSides: number;
  rawDamage: number;
  defendedDamage: number;
  hpDamage: number;
  temporaryHitPointsSpent: number;
  proneApplied: boolean;
  featherFallOutcome: FeatherFallOutcome;
  featherFallReason?: string;
}

export interface AerialLandingImpactInput {
  eventId: string;
  character: CombatCharacter;
  landingPosition: Position;
  mapData: BattleMapData;
  characters: CombatCharacter[];
  /** Controlled descent uses zero; unsupported flight uses the actual drop. */
  fallDistanceFeet: number;
  damageRng?: () => number;
  featherFall?: FeatherFallReactionRequest;
}

export interface AerialSupportLossImpactInput extends Omit<
  AerialLandingImpactInput,
  'character' | 'fallDistanceFeet'
> {
  characterId: string;
}

// ============================================================================
// Shared Character And Visibility Helpers
// ============================================================================
// These helpers keep live-character lookup, replacement, ownership, and sight
// checks in one place so rejection paths do not partially mutate the roster.
// ============================================================================

function replaceCharacters(
  characters: CombatCharacter[],
  replacements: CombatCharacter[],
): CombatCharacter[] {
  const replacementsById = new Map(replacements.map(character => [character.id, character]));
  return characters.map(character => replacementsById.get(character.id) ?? character);
}

function ownsFeatherFall(character: CombatCharacter): boolean {
  const ownedSpellIds = [
    ...(character.spellbook?.knownSpells ?? []),
    ...(character.spellbook?.preparedSpells ?? []),
  ];

  return ownedSpellIds.includes(featherFallData.id);
}

function canSeeTarget(
  caster: CombatCharacter,
  target: CombatCharacter,
  mapData: BattleMapData,
): boolean {
  // A caster always sees itself for this reaction. Other targets must have
  // authored endpoint tiles and a clear line through the shared grid rule.
  if (caster.id === target.id) return true;

  const casterTile = mapData.tiles.get(`${caster.position.x}-${caster.position.y}`);
  const targetTile = mapData.tiles.get(`${target.position.x}-${target.position.y}`);
  return Boolean(casterTile && targetTile && hasLineOfSight(casterTile, targetTile, mapData));
}

function getFeatherFallEligibilityReason(
  request: FeatherFallReactionRequest,
  faller: CombatCharacter,
  characters: CombatCharacter[],
  mapData: BattleMapData,
): { caster?: CombatCharacter; reason?: string } {
  const caster = characters.find(character => character.id === request.casterId);
  if (!caster) return { reason: 'Feather Fall caster is missing.' };
  if (!ownsFeatherFall(caster)) return { caster, reason: 'Caster does not own Feather Fall.' };

  // The canonical spell chooses one to five currently falling creatures. The
  // whole selection is validated before a Reaction or slot is paid.
  if (
    request.selectedTargetIds.length < 1
    || request.selectedTargetIds.length > featherFallData.targeting.maxTargets
  ) {
    return {
      caster,
      reason: `Feather Fall must choose 1-${featherFallData.targeting.maxTargets} falling creatures.`,
    };
  }
  if (!request.selectedTargetIds.includes(faller.id)) {
    return { caster, reason: 'The resolving faller was not chosen for Feather Fall.' };
  }

  for (const targetId of request.selectedTargetIds) {
    const target = characters.find(character => character.id === targetId);
    if (!target?.fallingState?.isFalling) {
      return { caster, reason: `Selected target ${targetId} is not currently falling.` };
    }

    const distanceFeet = getCharacterDistance(caster, target) * 5;
    if (distanceFeet > featherFallData.range.distance) {
      return {
        caster,
        reason: `Selected target ${target.name} is ${distanceFeet} feet away, beyond Feather Fall's ${featherFallData.range.distance}-foot range.`,
      };
    }
    if (!canSeeTarget(caster, target, mapData)) {
      return { caster, reason: `Caster cannot see selected falling target ${target.name}.` };
    }
  }

  const reactionCost = { type: 'reaction', spellSlotLevel: featherFallData.level } as const;
  if (!canAffordActionCost(caster, reactionCost)) {
    const reactionSpent = caster.actionEconomy.reaction.used
      || (caster.actionEconomy.reaction.remaining ?? 1) <= 0;
    const slotEmpty = (caster.spellSlots?.level_1.current ?? 0) <= 0;
    const reason = reactionSpent
      ? 'Caster has already spent its Reaction.'
      : slotEmpty
        ? 'Caster has no level-1 spell slot remaining.'
        : 'Caster cannot currently pay Feather Fall\'s Reaction and slot cost.';
    return { caster, reason };
  }

  return { caster };
}

// ============================================================================
// Landing And Damage Resolution
// ============================================================================
// Placement is the atomic boundary. Once legal, mitigation is offered, damage
// is rolled and defended, temporary HP/HP/death state resolves, and Prone is
// applied only when the creature actually takes a nonzero damage packet.
// ============================================================================

function applyFallingProne(character: CombatCharacter): CombatCharacter {
  return applyRuntimeStatusCondition(
    character,
    {
      id: 'falling-ground-impact-prone',
      name: 'Prone',
      type: 'debuff',
      description: 'The creature landed after taking falling damage and must stand before moving normally.',
      duration: 10,
      source: 'Falling',
      effect: { type: 'condition' },
    },
    {
      name: 'Prone',
      duration: { type: 'rounds', value: 10 },
      appliedTurn: 0,
      source: 'Falling',
    },
  ).character;
}

function emptyResult(
  input: FallingGroundImpactInput,
  status: Extract<FallingGroundImpactStatus, 'rejected' | 'repeat'>,
  reason: string,
  faller?: CombatCharacter,
): FallingGroundImpactResult {
  return {
    status,
    reason,
    characters: input.characters,
    faller,
    fallDistanceFeet: faller?.fallingState?.fallDistanceFeet ?? 0,
    damageDice: 0,
    damageSides: 6,
    rawDamage: 0,
    defendedDamage: 0,
    hpDamage: 0,
    temporaryHitPointsSpent: 0,
    proneApplied: false,
    featherFallOutcome: 'not_requested',
  };
}

export function resolveFallingGroundImpact(
  input: FallingGroundImpactInput,
): FallingGroundImpactResult {
  const faller = input.characters.find(character => character.id === input.fallerId);
  if (!faller) {
    return emptyResult(input, 'rejected', 'Falling creature is missing.');
  }

  const fallingState = faller.fallingState;
  if (!fallingState?.isFalling) {
    return emptyResult(
      input,
      'repeat',
      `Fall event ${input.eventId} is already resolved or the creature is not falling.`,
      faller,
    );
  }
  if (fallingState.eventId !== input.eventId) {
    return emptyResult(
      input,
      'rejected',
      `Fall event ${input.eventId} does not match the creature's live event ${fallingState.eventId}.`,
      faller,
    );
  }
  if (
    faller.position.x !== fallingState.sourcePosition.x
    || faller.position.y !== fallingState.sourcePosition.y
  ) {
    return emptyResult(input, 'rejected', 'Falling creature no longer occupies the event source.', faller);
  }

  // A landing is all-or-nothing. Occupied ground, blocking terrain, and any
  // off-board footprint preserve the complete incoming roster and resources.
  const placement = validateCharacterPlacement(
    faller,
    input.landingPosition,
    input.mapData,
    input.characters,
  );
  if (!placement.allowed) {
    return emptyResult(input, 'rejected', placement.reason, faller);
  }

  let featherFallOutcome: FeatherFallOutcome = 'not_requested';
  let featherFallReason: string | undefined;
  let paidCaster: CombatCharacter | undefined;

  if (input.featherFall) {
    const eligibility = getFeatherFallEligibilityReason(
      input.featherFall,
      faller,
      input.characters,
      input.mapData,
    );
    featherFallReason = eligibility.reason;

    if (eligibility.reason) {
      // An unavailable reaction changes no resource. The physical fall still
      // resolves because rejecting Feather Fall does not suspend gravity.
      featherFallOutcome = 'rejected';
    } else if (input.featherFall.choice === 'decline') {
      featherFallOutcome = 'declined';
      featherFallReason = 'Eligible caster declined Feather Fall.';
    } else if (eligibility.caster) {
      featherFallOutcome = 'accepted';
      featherFallReason = 'Feather Fall accepted; Reaction and one level-1 slot paid once.';
      paidCaster = consumeActionCost(eligibility.caster, {
        type: 'reaction',
        spellSlotLevel: featherFallData.level,
      });
    }
  }

  const damageRoll = calculateFallDamage(fallingState.fallDistanceFeet);
  const rawDamage = featherFallOutcome === 'accepted' || damageRoll.dice === 0
    ? 0
    : rollDamage(
        `${damageRoll.dice}d${damageRoll.sides}`,
        false,
        1,
        input.damageRng,
      );
  const defendedDamage = rawDamage > 0
    ? calculateDamage(rawDamage, null, faller, damageRoll.type)
    : 0;
  // Self-casting is legal. When the falling creature is also the caster, start
  // the landing from the paid resource copy so position and payment survive in
  // one character record instead of either update overwriting the other.
  const fallerAfterReaction = paidCaster?.id === faller.id ? paidCaster : faller;
  const landed: CombatCharacter = {
    ...fallerAfterReaction,
    position: { ...input.landingPosition },
    fallingState: {
      ...fallingState,
      isFalling: false,
      resolvedAt: { ...input.landingPosition },
      mitigation: featherFallOutcome === 'accepted' ? 'feather_fall' : undefined,
    },
  };

  // Zero defended damage means the creature did not take falling damage. That
  // includes short falls, immunity, and Feather Fall, so none mark damage or
  // apply Prone. A nonzero packet still flows through temporary HP and downing.
  const damaged = defendedDamage > 0
    ? applyDamageAndCheckDowned(landed, defendedDamage)
    : landed;
  const resolvedFaller = defendedDamage > 0 ? applyFallingProne(damaged) : damaged;
  const replacements = paidCaster && paidCaster.id !== resolvedFaller.id
    ? [resolvedFaller, paidCaster]
    : [resolvedFaller];
  const characters = replaceCharacters(input.characters, replacements);
  const liveFaller = characters.find(character => character.id === faller.id) ?? resolvedFaller;
  const liveCaster = paidCaster
    ? characters.find(character => character.id === paidCaster.id)
    : undefined;

  return {
    status: 'resolved',
    reason: featherFallOutcome === 'accepted'
      ? 'Legal landing resolved with Feather Fall protection.'
      : 'Legal landing resolved through canonical fall damage.',
    characters,
    faller: liveFaller,
    featherFallCaster: liveCaster,
    landingPosition: { ...input.landingPosition },
    fallDistanceFeet: fallingState.fallDistanceFeet,
    damageDice: damageRoll.dice,
    damageSides: damageRoll.sides,
    rawDamage,
    defendedDamage,
    hpDamage: Math.max(0, faller.currentHP - liveFaller.currentHP),
    temporaryHitPointsSpent: Math.max(0, (faller.tempHP ?? 0) - (liveFaller.tempHP ?? 0)),
    proneApplied: defendedDamage > 0,
    featherFallOutcome,
    featherFallReason,
  };
}

// ============================================================================
// Aerial Landing And Support-Loss Bridge
// ============================================================================
// Controlled descent and involuntary loss of support both finish through the
// CS32 landing transaction. The only difference is fall distance: a paid,
// controlled landing contributes zero falling damage, while support loss uses
// the full altitude above the chosen ground square and can offer Feather Fall.
// ============================================================================

export function resolveAerialLandingImpact(
  input: AerialLandingImpactInput,
): FallingGroundImpactResult {
  const groundAltitudeFeet = getBattleMapGroundAltitudeFeet(
    input.mapData,
    input.landingPosition,
  );
  if (groundAltitudeFeet === null) {
    return emptyResult(
      {
        eventId: input.eventId,
        fallerId: input.character.id,
        landingPosition: input.landingPosition,
        mapData: input.mapData,
        characters: input.characters,
      },
      'rejected',
      `Aerial landing leaves the battle map at ${input.landingPosition.x},${input.landingPosition.y}.`,
      input.character,
    );
  }

  const fallingCharacter: CombatCharacter = {
    ...input.character,
    fallingState: {
      eventId: input.eventId,
      isFalling: true,
      sourcePosition: { ...input.character.position },
      sourceElevationFeet: input.character.aerialMovement?.altitudeFeet ?? groundAltitudeFeet,
      fallDistanceFeet: Math.max(0, input.fallDistanceFeet),
    },
  };
  const fallingRoster = replaceCharacters(input.characters, [fallingCharacter]);
  const impact = resolveFallingGroundImpact({
    eventId: input.eventId,
    fallerId: input.character.id,
    landingPosition: input.landingPosition,
    mapData: input.mapData,
    characters: fallingRoster,
    damageRng: input.damageRng,
    featherFall: input.featherFall,
  });

  if (impact.status !== 'resolved' || !impact.faller) return impact;

  // The impact transaction owns HP, resources, conditions, and receipt state.
  // This final projection only closes the aerial occupancy record at ground.
  const groundedFaller: CombatCharacter = {
    ...impact.faller,
    aerialMovement: {
      ...impact.faller.aerialMovement,
      altitudeFeet: groundAltitudeFeet,
      isFlying: false,
      canHover: impact.faller.aerialMovement?.canHover ?? false,
    },
  };
  const characters = replaceCharacters(impact.characters, [groundedFaller]);

  return { ...impact, characters, faller: groundedFaller };
}

export function resolveAerialSupportLossImpact(
  input: AerialSupportLossImpactInput,
): FallingGroundImpactResult {
  const character = input.characters.find(candidate => candidate.id === input.characterId);
  if (!character) {
    return emptyResult(
      {
        eventId: input.eventId,
        fallerId: input.characterId,
        landingPosition: input.landingPosition,
        mapData: input.mapData,
        characters: input.characters,
      },
      'rejected',
      'Aerial support-loss creature is missing.',
    );
  }

  const support = resolveAerialSupportLoss(character);
  if (!support.requiresFall) {
    return emptyResult(
      {
        eventId: input.eventId,
        fallerId: character.id,
        landingPosition: input.landingPosition,
        mapData: input.mapData,
        characters: input.characters,
      },
      'repeat',
      support.reason,
      character,
    );
  }

  const groundAltitudeFeet = getBattleMapGroundAltitudeFeet(input.mapData, input.landingPosition);
  const fallDistanceFeet = groundAltitudeFeet === null
    ? 0
    : Math.max(0, (character.aerialMovement?.altitudeFeet ?? 0) - groundAltitudeFeet);

  return resolveAerialLandingImpact({
    ...input,
    character,
    fallDistanceFeet,
  });
}
