/**
 * @file combat/turn.ts
 * Initiative groups and independently owned member turns.
 *
 * Declarations moved unchanged from combat.ts. That file remains the public
 * compatibility entry; direct type imports here make ownership explicit.
 * Reciprocal type references are erased at runtime, not new state owners.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 24/10/2026, 21:16:06
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CombatAction } from './actions.js';

// ============================================================================
// Initiative group turns
// ============================================================================
// A shared-initiative group owns one place in the initiative sequence while
// its members remain independently playable creatures. The group controls only
// member order and completion; every member keeps its own combat resources and
// receives its own start/end effect boundaries.
// ============================================================================

export interface CombatTurnGroup {
  /** Stable scheduler identity derived from the group's first authored member. */
  id: string;
  /** Shared initiative count used to place the group among ordinary actors. */
  initiative: number;
  /** Deterministic member order; the first eligible member becomes active. */
  memberIds: string[];
}


export interface ActiveCombatTurnGroup {
  groupId: string;
  memberIds: string[];
  activeMemberId: string;
  completedMemberIds: string[];
  /** Actions, movement, and reactions never leak between group members. */
  actionOwnership: "member";
  movementOwnership: "member";
  reactionOwnership: "member";
  /** Start/end effects run for the active member, not once for the whole group. */
  effectTiming: "member_start_and_end";
}


export interface TurnState {
  currentTurn: number;
  turnOrder: string[]; // character IDs in initiative order
  currentCharacterId: string | null;
  /** Production group definitions. Optional only for old saves/test fixtures. */
  turnGroups?: CombatTurnGroup[];
  /** Current group/member contract; null when combat has no eligible actor. */
  activeGroup?: ActiveCombatTurnGroup | null;
  phase: "planning" | "action" | "resolution" | "end_turn";
  actionsThisTurn: CombatAction[];
}
