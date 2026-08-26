/**
 * @file battlefieldEscape.ts — the edge-of-map escape referee for fight-in-place.
 *
 * Fight-in-place slice 1, sub-feature 9B ("edge-of-map escape"). Before this
 * module a combatant who walked to the rim of the battlefield had nowhere to go:
 * the referee grid simply ended, and the only exits from a fight were victory,
 * defeat, or a scripted end. That made "run away" — a first-class option at a
 * real table — unrepresentable.
 *
 * The rule this module owns, and ONLY this rule:
 *
 *   a combatant standing within `edgeDepth` tiles of the battlefield rectangle,
 *   with movement still left this turn, may forfeit their whole remaining
 *   movement action to leave the fight.
 *
 * WHY "REMAINING" AND NOT "UNSPENT". Requiring a completely fresh movement
 * allowance would make the feature almost unreachable: walking to the rim is
 * itself movement, so a character who just arrived at the edge could never flee
 * on the turn they got there. Charging whatever movement is left keeps the cost
 * real — the escapee cannot move again this turn — while letting "run to the
 * edge and keep running" work the way a player expects.
 *
 * Everything here is pure (no React, no Three, no reducers) for the same reason
 * `inSceneMovement.ts` is pure: the 3D scene, the 2D board, and the turn manager
 * must all reach the SAME verdict about whether an escape is legal, so the rule
 * lives in one testable function rather than three UI branches.
 *
 * Deliberately NOT decided here (kept open for later slices):
 *  - opportunity attacks on the way out. Fleeing is a movement action, so
 *    `useActionExecutor.handleOpportunityAttacks` is the natural home; this
 *    module reports the verdict and the caller owns reactions.
 *  - a Dexterity/Athletics contest to disengage. `EscapeVerdict.contested` is
 *    reserved for it; slice 1 always resolves uncontested.
 *  - what the world does with a fled character (re-encounter, pursuit). The
 *    caller removes the combatant; the encounter layer owns the aftermath.
 */
import type { BattleMapData, CombatCharacter, Position } from '../../../types/combat';

/**
 * The battlefield rectangle, in INCLUSIVE tile coordinates. Derived from
 * `mapData.dimensions`, which is the same extent the tile map is keyed on
 * (`${x}-${y}` for 0 <= x < width, 0 <= y < height).
 */
export interface BattlefieldBoundary {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * How many tiles in from the rim still count as "at the edge". One tile means
 * only the literal outermost ring qualifies; the referee grid is a 5-ft lattice,
 * so one ring is 5 feet from open ground and is the tightest rule that still
 * lets a token that is visibly at the map border flee.
 */
export const DEFAULT_ESCAPE_EDGE_DEPTH = 1;

/** Why an escape is not currently offered. Machine-readable for UI + tests. */
export type EscapeUnavailableCode =
  | 'no-map'
  | 'downed'
  | 'not-at-edge'
  | 'movement-already-spent'
  | 'no-movement';

/** The referee's verdict on one combatant's escape option. */
export interface EscapeVerdict {
  /** True when the Escape command should be offered and will resolve. */
  available: boolean;
  /** Set when `available` is false. */
  code?: EscapeUnavailableCode;
  /** Human-readable rationale, safe to show in a tooltip or the combat log. */
  reason: string;
  /**
   * Chebyshev distance from the combatant to the nearest map edge, in tiles.
   * Null when there is no map to measure against. Exposed so a UI can hint
   * "3 tiles from an exit" without re-deriving the boundary.
   */
  tilesFromEdge: number | null;
  /**
   * Movement feet the escape consumes: everything the combatant has LEFT this
   * turn, not the distance to the rim. The whole movement action is forfeited.
   */
  movementCostFeet: number;
  /**
   * Reserved for a later slice that makes fleeing a contested check. Always
   * false in slice 1 — kept on the verdict so adding the check later does not
   * change this module's public shape.
   */
  contested: boolean;
}

/**
 * The battlefield rectangle for a map. Inclusive bounds, so a 40x30 board yields
 * `{ minX: 0, minY: 0, maxX: 39, maxY: 29 }`.
 */
export function getBattlefieldBoundary(mapData: BattleMapData): BattlefieldBoundary {
  return {
    minX: 0,
    minY: 0,
    maxX: Math.max(0, mapData.dimensions.width - 1),
    maxY: Math.max(0, mapData.dimensions.height - 1),
  };
}

/**
 * Chebyshev distance from a position to the nearest edge of the rectangle.
 * Zero on the outermost ring. Positions already outside the rectangle clamp to
 * zero rather than returning a negative depth — a token pushed off-board is at
 * an exit by any reading.
 */
export function distanceToBoundary(boundary: BattlefieldBoundary, position: Position): number {
  const fromLeft = position.x - boundary.minX;
  const fromRight = boundary.maxX - position.x;
  const fromTop = position.y - boundary.minY;
  const fromBottom = boundary.maxY - position.y;
  return Math.max(0, Math.min(fromLeft, fromRight, fromTop, fromBottom));
}

/**
 * True when `position` sits within `edgeDepth` tiles of the battlefield rim.
 */
export function isAtBattlefieldEdge(
  mapData: BattleMapData,
  position: Position,
  edgeDepth: number = DEFAULT_ESCAPE_EDGE_DEPTH,
): boolean {
  return distanceToBoundary(getBattlefieldBoundary(mapData), position) < Math.max(1, edgeDepth);
}

export interface EvaluateEscapeArgs {
  /** The battlefield. Null is a legal input (mapless encounters) and fails closed. */
  mapData: BattleMapData | null;
  /** The combatant asking to flee. */
  character: CombatCharacter;
  /** Override the edge ring width; defaults to {@link DEFAULT_ESCAPE_EDGE_DEPTH}. */
  edgeDepth?: number;
}

/**
 * Rule one combatant's escape option. Pure; the single source of truth for both
 * "should the Escape button appear" and "may this escape resolve".
 */
export function evaluateEscape(args: EvaluateEscapeArgs): EscapeVerdict {
  const { mapData, character, edgeDepth = DEFAULT_ESCAPE_EDGE_DEPTH } = args;

  if (!mapData) {
    return {
      available: false,
      code: 'no-map',
      reason: 'This encounter has no battlefield to flee across.',
      tilesFromEdge: null,
      movementCostFeet: 0,
      contested: false,
    };
  }

  const movement = character.actionEconomy?.movement ?? { used: 0, total: 0 };
  const remainingFeet = Math.max(0, movement.total - movement.used);
  const tilesFromEdge = distanceToBoundary(getBattlefieldBoundary(mapData), character.position);

  // A downed or dead combatant cannot walk off the map. Checked before position
  // so the reason a player sees is the true blocker.
  if (character.currentHP <= 0) {
    return {
      available: false,
      code: 'downed',
      reason: `${character.name} is down and cannot flee.`,
      tilesFromEdge,
      movementCostFeet: remainingFeet,
      contested: false,
    };
  }

  if (tilesFromEdge >= Math.max(1, edgeDepth)) {
    return {
      available: false,
      code: 'not-at-edge',
      reason: `${character.name} must reach the edge of the battlefield to flee (${tilesFromEdge} tiles away).`,
      tilesFromEdge,
      movementCostFeet: remainingFeet,
      contested: false,
    };
  }

  if (movement.total <= 0) {
    return {
      available: false,
      code: 'no-movement',
      reason: `${character.name} has no movement speed to flee with.`,
      tilesFromEdge,
      movementCostFeet: 0,
      contested: false,
    };
  }

  // The whole REMAINING movement action buys the escape. A combatant who has
  // already used every foot this turn has nothing left to flee with and must
  // wait for their next turn.
  if (remainingFeet <= 0) {
    return {
      available: false,
      code: 'movement-already-spent',
      reason: `Fleeing costs the rest of a movement action; ${character.name} has already used all ${movement.total} ft this turn.`,
      tilesFromEdge,
      movementCostFeet: 0,
      contested: false,
    };
  }

  return {
    available: true,
    reason: `${character.name} is at the edge of the battlefield and can flee, forfeiting their remaining ${remainingFeet} ft of movement.`,
    tilesFromEdge,
    movementCostFeet: remainingFeet,
    contested: false,
  };
}

/**
 * Charge the escape to the action economy: the entire movement allowance is
 * spent. Returned as a new character so callers stay on the immutable update
 * path the turn manager already uses; the caller then removes the combatant.
 *
 * Movement is the ONLY resource escape consumes — the action and bonus action
 * survive, matching 5e's Dash/Disengage shape where leaving is a movement
 * decision, not an attack-replacing one.
 */
export function applyEscapeMovementCost(character: CombatCharacter): CombatCharacter {
  const movement = character.actionEconomy?.movement ?? { used: 0, total: 0 };
  return {
    ...character,
    actionEconomy: {
      ...character.actionEconomy,
      movement: { ...movement, used: movement.total },
    },
  };
}
