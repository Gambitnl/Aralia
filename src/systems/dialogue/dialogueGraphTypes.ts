/**
 * @file src/systems/dialogue/dialogueGraphTypes.ts
 * Schema for scripted, authored NPC conversations (DIAL-001).
 *
 * WHY THIS EXISTS ALONGSIDE `src/types/dialogue.ts`
 * -------------------------------------------------
 * Aralia already had a dialogue system before this file: `ConversationTopic`
 * in `src/types/dialogue.ts`, resolved at runtime by `dialogueService.ts`.
 * That system is a *topic pool* — a flat, always-available list of things the
 * player may ask, gated by prerequisites, with the NPC's actual words produced
 * by an LLM. It is deliberately open-ended and non-linear.
 *
 * A `DialogueGraph` is the complementary, authored half: a fixed node/edge
 * conversation where every line is written in advance and the player walks a
 * branching path. Quest hand-offs, haggling, and gate-keeper confrontations
 * need exact wording and deterministic branching that a topic pool cannot give.
 *
 * Neither replaces the other. Nothing here modifies `ConversationTopic`; the
 * two can run in the same window (see `DialogueInterface`, which accepts an
 * optional graph and otherwise falls through to the existing topic flow).
 *
 * Called by: dialogueGraphLoader.ts, dialogueGraphRuntime.ts,
 *            components/Dialogue/DialogueInterface.tsx
 * Depends on: nothing — these are plain data shapes so authored JSON under
 *             `public/data/dialogue/` is the source of truth.
 */

// ============================================================================
// Conditions
// ============================================================================
// A condition gates whether a choice is offered. `params` is intentionally
// loose (`Record<string, unknown>`) so new condition kinds can be authored in
// JSON before the evaluator learns them — an unknown condition is reported by
// the validator rather than crashing the conversation.
//
// The per-type `params` contracts the runtime understands today:
//   quest_status  { questId: string; status: string }
//   disposition   { min?: number; max?: number }
//   has_item      { itemId: string; quantity?: number }
//   time_of_day   { is: string | string[] }   e.g. "Night" or ["Dawn","Day"]
//   unlock_flag   { flag: string; negate?: boolean }
// ============================================================================

/**
 * Condition kinds a choice may be gated on.
 *
 * `unlock_flag` is the seam for the world-fact / unlock registry work
 * (`src/systems/facts/worldFactStore.ts` and its follow-ups): a flag set by one
 * conversation gates a choice in another, across NPCs and across saves.
 */
export type DialogueConditionType =
  | 'quest_status'
  | 'disposition'
  | 'has_item'
  | 'time_of_day'
  | 'unlock_flag';

export interface DialogueCondition {
  type: DialogueConditionType;
  /** Kind-specific arguments; see the contracts documented above. */
  params: Record<string, unknown>;
}

// ============================================================================
// Effects
// ============================================================================
// Effects are DESCRIBED here, never applied here. `applyDialogueEffects` in
// dialogueGraphRuntime.ts returns a plain outcome list so the caller's reducer
// stays the only thing that mutates a save. That keeps graphs replayable in
// tests and safe to evaluate in a preview that must not touch game state.
//
// The per-type `params` contracts the runtime understands today:
//   grant_item          { itemId: string; quantity?: number }
//   update_disposition  { delta: number }
//   start_quest         { questId: string }
//   unlock_topic        { topicId: string }
//   set_flag            { flag: string; value?: unknown }
// ============================================================================

/**
 * Effect kinds a node may fire when it is entered.
 *
 * `set_flag` is the write side of `unlock_flag`, and `unlock_topic` is the
 * bridge back into the pre-existing `ConversationTopic` pool — a scripted
 * conversation can open a free-form topic that persists after the graph ends.
 */
export type DialogueEffectType =
  | 'grant_item'
  | 'update_disposition'
  | 'start_quest'
  | 'unlock_topic'
  | 'set_flag';

export interface DialogueEffect {
  type: DialogueEffectType;
  /** Kind-specific arguments; see the contracts documented above. */
  params: Record<string, unknown>;
}

// ============================================================================
// Nodes and choices
// ============================================================================

export interface DialogueChoice {
  /** The line the player picks, shown verbatim as a button label. */
  text: string;
  /** Node this choice walks to. Must exist in the graph's `nodes` map. */
  nextNodeId: string;
  /** When present and unmet, the choice is hidden rather than disabled. */
  condition?: DialogueCondition;
}

export interface DialogueNode {
  id: string;
  /**
   * Who speaks this line. `player` nodes exist so an authored graph can show
   * the player's own words as a beat, not only as a button.
   */
  speaker: 'npc' | 'player';
  text: string;
  /** Branching continuations. A node with neither `choices` nor `next` ends the conversation. */
  choices?: DialogueChoice[];
  /** Fired once when this node is entered. */
  effects?: DialogueEffect[];
  /** Unconditional continuation, used for linear runs of dialogue. */
  next?: string;
}

export interface DialogueGraph {
  id: string;
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
}

// ============================================================================
// Evaluation context
// ============================================================================
// Deliberately NOT `GameState`. A graph must be evaluable from a test fixture,
// from the Design Preview, and from a live save; a narrow context keeps all
// three honest and keeps this system free of a hard dependency on the game
// state shape, which changes far more often than a conversation does.
// ============================================================================

export interface DialogueGraphContext {
  /** Quest id -> current status string, matched against `quest_status.status`. */
  questStatuses?: Record<string, string>;
  /** Disposition toward the speaking NPC, on the same scale as `npcMemory`. */
  disposition?: number;
  /** Item id -> quantity carried. */
  inventory?: Record<string, number>;
  /** Current day part, matched against `time_of_day.is` (case-insensitive). */
  timeOfDay?: string;
  /** Flags already set, read by `unlock_flag`. */
  flags?: Record<string, unknown>;
}

/**
 * A resolved effect, ready for a reducer to apply. Carries the original effect
 * so a caller that understands a kind this module does not can still act on it.
 */
export interface DialogueEffectOutcome {
  type: DialogueEffectType;
  effect: DialogueEffect;
  /** False when required params were missing; `reason` says what. */
  applied: boolean;
  reason?: string;
  /** Normalized payload for the kinds the runtime understands. */
  itemId?: string;
  quantity?: number;
  dispositionDelta?: number;
  questId?: string;
  topicId?: string;
  flag?: string;
  flagValue?: unknown;
}
