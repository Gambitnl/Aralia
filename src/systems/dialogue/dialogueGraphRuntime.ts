/**
 * @file src/systems/dialogue/dialogueGraphRuntime.ts
 * Pure playback rules for an authored dialogue graph (DIAL-001).
 *
 * Everything here is a pure function over a `DialogueGraphContext`. Nothing
 * touches `GameState`, dispatches, or fetches. That is the whole point: a graph
 * must be walkable from a unit test, from the Design Preview, and from a live
 * save with identical results, and the reducer must stay the only writer.
 *
 * `applyDialogueEffects` therefore RESOLVES effects into outcomes rather than
 * performing them. The caller decides how a `grant_item` outcome reaches the
 * inventory, and a caller that understands an effect kind this module does not
 * still receives the original effect object to act on.
 *
 * Called by: components/Dialogue/DialogueInterface.tsx and graph tests.
 * Depends on: dialogueGraphTypes.ts only.
 */

import type {
  DialogueGraph,
  DialogueNode,
  DialogueChoice,
  DialogueCondition,
  DialogueEffect,
  DialogueEffectOutcome,
  DialogueGraphContext,
} from './dialogueGraphTypes';

// ============================================================================
// Conditions
// ============================================================================
// An unmet condition HIDES a choice; it never disables it. A greyed-out
// "[Bribe him] (requires 50 gold)" tells the player what they are missing,
// which is a different design decision than a scripted conversation wants —
// the guard should not advertise that he takes bribes.
//
// A missing context field means "unknown", and unknown fails closed. A graph
// evaluated with an empty context therefore shows only its unconditional
// choices, which is the safe default for a preview.
// ============================================================================

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function evaluateDialogueCondition(
  condition: DialogueCondition,
  context: DialogueGraphContext,
): boolean {
  const params = (condition?.params ?? {}) as Record<string, unknown>;

  switch (condition?.type) {
    case 'quest_status': {
      const questId = params.questId;
      if (typeof questId !== 'string') return false;
      const actual = context.questStatuses?.[questId];
      return actual !== undefined && actual === params.status;
    }

    case 'disposition': {
      const disposition = context.disposition ?? 0;
      const min = asNumber(params.min);
      const max = asNumber(params.max);
      if (min !== undefined && disposition < min) return false;
      if (max !== undefined && disposition > max) return false;
      // A disposition condition with neither bound is an authoring mistake, but
      // it is the validator's job to say so; playback treats it as satisfied.
      return true;
    }

    case 'has_item': {
      const itemId = params.itemId;
      if (typeof itemId !== 'string') return false;
      const required = asNumber(params.quantity) ?? 1;
      return (context.inventory?.[itemId] ?? 0) >= required;
    }

    case 'time_of_day': {
      const current = context.timeOfDay;
      if (typeof current !== 'string') return false;
      const wanted = params.is;
      const list = Array.isArray(wanted) ? wanted : [wanted];
      // Case-insensitive: the engine's `TimeOfDay` enum is capitalized
      // ("Night") while hand-authored JSON tends to be lowercase.
      return list.some(
        (entry) => typeof entry === 'string' && entry.toLowerCase() === current.toLowerCase(),
      );
    }

    case 'unlock_flag': {
      const flag = params.flag;
      if (typeof flag !== 'string') return false;
      const raw = context.flags?.[flag];
      // Absent or explicitly false both count as "not set". Any other stored
      // value counts as set, so a flag can carry a payload as well as truth.
      const isSet = raw !== undefined && raw !== false;
      return params.negate === true ? !isSet : isSet;
    }

    default:
      // Unknown kinds fail closed. The loader already rejects them, so this is
      // only reachable for a graph built in memory rather than loaded.
      return false;
  }
}

/** Choices whose condition is met (or absent), in authored order. */
export function getAvailableChoices(
  node: DialogueNode | undefined,
  context: DialogueGraphContext,
): DialogueChoice[] {
  if (!node?.choices) return [];
  return node.choices.filter(
    (choice) => !choice.condition || evaluateDialogueCondition(choice.condition, context),
  );
}

// ============================================================================
// Effects
// ============================================================================

function resolveEffect(effect: DialogueEffect): DialogueEffectOutcome {
  const params = (effect?.params ?? {}) as Record<string, unknown>;
  const base: DialogueEffectOutcome = { type: effect?.type, effect, applied: true };

  switch (effect?.type) {
    case 'grant_item': {
      if (typeof params.itemId !== 'string') {
        return { ...base, applied: false, reason: 'grant_item requires params.itemId' };
      }
      return { ...base, itemId: params.itemId, quantity: asNumber(params.quantity) ?? 1 };
    }

    case 'update_disposition': {
      const delta = asNumber(params.delta);
      if (delta === undefined) {
        return { ...base, applied: false, reason: 'update_disposition requires numeric params.delta' };
      }
      return { ...base, dispositionDelta: delta };
    }

    case 'start_quest': {
      if (typeof params.questId !== 'string') {
        return { ...base, applied: false, reason: 'start_quest requires params.questId' };
      }
      return { ...base, questId: params.questId };
    }

    case 'unlock_topic': {
      if (typeof params.topicId !== 'string') {
        return { ...base, applied: false, reason: 'unlock_topic requires params.topicId' };
      }
      return { ...base, topicId: params.topicId };
    }

    case 'set_flag': {
      if (typeof params.flag !== 'string') {
        return { ...base, applied: false, reason: 'set_flag requires params.flag' };
      }
      // A flag with no explicit value is a boolean truth marker.
      return { ...base, flag: params.flag, flagValue: params.value ?? true };
    }

    default:
      return { ...base, applied: false, reason: `unknown effect type "${String(effect?.type)}"` };
  }
}

/**
 * Resolves a node's effects into outcomes and returns the context they imply.
 *
 * The returned context is a NEW object with the locally-knowable results folded
 * in — disposition deltas, set flags, granted items — so a graph can gate a
 * later choice on something an earlier node did without a round trip through
 * the game reducer. Kinds the graph cannot resolve locally (`start_quest`)
 * change no context; the caller applies those for real.
 */
export function applyDialogueEffects(
  effects: DialogueEffect[] | undefined,
  context: DialogueGraphContext,
): { outcomes: DialogueEffectOutcome[]; context: DialogueGraphContext } {
  if (!effects || effects.length === 0) {
    return { outcomes: [], context };
  }

  const outcomes = effects.map(resolveEffect);
  let next: DialogueGraphContext = { ...context };

  for (const outcome of outcomes) {
    if (!outcome.applied) continue;

    if (outcome.type === 'update_disposition' && outcome.dispositionDelta !== undefined) {
      next = { ...next, disposition: (next.disposition ?? 0) + outcome.dispositionDelta };
    }

    if (outcome.type === 'set_flag' && outcome.flag) {
      next = { ...next, flags: { ...(next.flags ?? {}), [outcome.flag]: outcome.flagValue } };
    }

    if (outcome.type === 'grant_item' && outcome.itemId) {
      const inventory = { ...(next.inventory ?? {}) };
      inventory[outcome.itemId] = (inventory[outcome.itemId] ?? 0) + (outcome.quantity ?? 1);
      next = { ...next, inventory };
    }

    // `unlock_topic` writes into the ConversationTopic pool, which lives outside
    // this context, and `start_quest` writes the quest log. Both are the
    // caller's to apply; leaving them out keeps this function honest about
    // what it can actually guarantee.
  }

  return { outcomes, context: next };
}

// ============================================================================
// Traversal
// ============================================================================

export function getNode(graph: DialogueGraph, nodeId: string): DialogueNode | undefined {
  return graph.nodes[nodeId];
}

/**
 * True when the conversation ends here: no unconditional continuation and no
 * choice the current context allows. A node with choices that are ALL gated off
 * is terminal in practice, which is why availability is checked rather than
 * mere presence.
 */
export function isTerminalNode(
  node: DialogueNode | undefined,
  context: DialogueGraphContext,
): boolean {
  if (!node) return true;
  if (node.next) return false;
  return getAvailableChoices(node, context).length === 0;
}

/**
 * Walks the unconditional (`next`) spine from a node, applying effects as each
 * node is entered, and stops at the first node that branches or ends.
 *
 * This is what makes a linear authored run play as one readable sequence rather
 * than requiring the player to click "continue" through every beat, and it is
 * the path exercised by the "renders a graph without conditions" acceptance
 * criterion.
 */
export function advanceLinear(
  graph: DialogueGraph,
  startNodeId: string,
  context: DialogueGraphContext,
): { visited: DialogueNode[]; nodeId: string; context: DialogueGraphContext; outcomes: DialogueEffectOutcome[] } {
  const visited: DialogueNode[] = [];
  const outcomes: DialogueEffectOutcome[] = [];
  const seen = new Set<string>();
  let currentId = startNodeId;
  let currentContext = context;

  for (;;) {
    const node = getNode(graph, currentId);
    if (!node || seen.has(currentId)) break;
    seen.add(currentId);
    visited.push(node);

    const applied = applyDialogueEffects(node.effects, currentContext);
    currentContext = applied.context;
    outcomes.push(...applied.outcomes);

    // Choices win over `next` when both are authored: an explicit branch is a
    // stronger statement of intent than a fallthrough.
    if (getAvailableChoices(node, currentContext).length > 0) break;
    if (!node.next) break;
    currentId = node.next;
  }

  return { visited, nodeId: currentId, context: currentContext, outcomes };
}
