/**
 * @file src/systems/dialogue/dialogueGraphLoader.ts
 * Loads and validates authored dialogue graphs from `public/data/dialogue/`.
 *
 * SIGNATURE NOTE (deviation from the DIAL-001 brief, deliberate)
 * -------------------------------------------------------------
 * The task text specifies `loadDialogueGraph(id: string): DialogueGraph`.
 * That cannot be honored literally: graphs live as JSON under `public/`, which
 * this app reaches over the network (see `SpellService`, the established
 * pattern for `public/data` in this repo), so the load is asynchronous. The
 * function therefore returns `Promise<DialogueGraph>`. `parseDialogueGraph`
 * below is the synchronous half for callers that already hold the JSON — for
 * example tests and any future build-time bundling step.
 *
 * Caching mirrors `SpellService`: the in-flight promise is cached so N callers
 * during one conversation share one request, and a failed load evicts itself
 * so a retry is possible.
 *
 * Called by: components/Dialogue/DialogueInterface.tsx and graph tests.
 * Depends on: dialogueGraphTypes.ts, config/env (assetUrl),
 *             utils/context (fetchWithTimeout), utils/core (logger).
 */

import { assetUrl } from '../../config/env';
import { fetchWithTimeout } from '../../utils/context';
import { logger } from '../../utils/core';
import type {
  DialogueGraph,
  DialogueNode,
  DialogueChoice,
  DialogueCondition,
  DialogueEffect,
} from './dialogueGraphTypes';

/** Directory (relative to the served base URL) holding authored graphs. */
export const DIALOGUE_GRAPH_DIR = 'data/dialogue';

const VALID_CONDITION_TYPES = new Set([
  'quest_status',
  'disposition',
  'has_item',
  'time_of_day',
  'unlock_flag',
]);

const VALID_EFFECT_TYPES = new Set([
  'grant_item',
  'update_disposition',
  'start_quest',
  'unlock_topic',
  'set_flag',
]);

/** Resolves the served URL for a graph id (`quest-giver` -> `.../data/dialogue/quest-giver.json`). */
export function dialogueGraphUrl(id: string): string {
  return assetUrl(`${DIALOGUE_GRAPH_DIR}/${id}.json`);
}

// ============================================================================
// Validation
// ============================================================================
// Returns a list of human-readable errors, empty when valid. Every problem is
// collected rather than thrown on first sight: an author fixing a hand-written
// graph wants the whole list, not one error per edit-reload cycle.
//
// Structural problems that would crash playback (missing start node, dangling
// edge, duplicate/renamed key) are errors. Unknown condition/effect KINDS are
// also errors, because a silently ignored gate is a content bug that reads as
// a working conversation.
// ============================================================================

function validateCondition(
  condition: DialogueCondition | undefined,
  where: string,
  errors: string[],
): void {
  if (condition === undefined) return;
  if (typeof condition !== 'object' || condition === null) {
    errors.push(`${where}: condition must be an object`);
    return;
  }
  if (!VALID_CONDITION_TYPES.has(condition.type)) {
    errors.push(`${where}: unknown condition type "${String(condition.type)}"`);
  }
  if (typeof condition.params !== 'object' || condition.params === null) {
    errors.push(`${where}: condition "${String(condition.type)}" is missing params`);
  }
}

function validateEffect(effect: DialogueEffect, where: string, errors: string[]): void {
  if (typeof effect !== 'object' || effect === null) {
    errors.push(`${where}: effect must be an object`);
    return;
  }
  if (!VALID_EFFECT_TYPES.has(effect.type)) {
    errors.push(`${where}: unknown effect type "${String(effect.type)}"`);
  }
  if (typeof effect.params !== 'object' || effect.params === null) {
    errors.push(`${where}: effect "${String(effect.type)}" is missing params`);
  }
}

function validateChoice(
  choice: DialogueChoice,
  nodeId: string,
  index: number,
  nodeIds: Set<string>,
  errors: string[],
): void {
  const where = `node "${nodeId}" choice ${index}`;
  if (typeof choice !== 'object' || choice === null) {
    errors.push(`${where}: must be an object`);
    return;
  }
  if (typeof choice.text !== 'string' || choice.text.length === 0) {
    errors.push(`${where}: missing text`);
  }
  if (typeof choice.nextNodeId !== 'string' || choice.nextNodeId.length === 0) {
    errors.push(`${where}: missing nextNodeId`);
  } else if (!nodeIds.has(choice.nextNodeId)) {
    errors.push(`${where}: nextNodeId "${choice.nextNodeId}" does not exist`);
  }
  validateCondition(choice.condition, where, errors);
}

/**
 * Validates a dialogue graph.
 *
 * @returns list of errors; an empty array means the graph is playable.
 */
export function validateDialogueGraph(graph: DialogueGraph): string[] {
  const errors: string[] = [];

  if (typeof graph !== 'object' || graph === null) {
    return ['graph must be an object'];
  }
  if (typeof graph.id !== 'string' || graph.id.length === 0) {
    errors.push('graph is missing an id');
  }
  if (typeof graph.nodes !== 'object' || graph.nodes === null) {
    errors.push('graph is missing a nodes map');
    return errors;
  }

  const nodeIds = new Set(Object.keys(graph.nodes));
  if (nodeIds.size === 0) {
    errors.push('graph has no nodes');
  }

  if (typeof graph.startNodeId !== 'string' || graph.startNodeId.length === 0) {
    errors.push('graph is missing a startNodeId');
  } else if (!nodeIds.has(graph.startNodeId)) {
    errors.push(`startNodeId "${graph.startNodeId}" does not exist in nodes`);
  }

  for (const [key, node] of Object.entries(graph.nodes)) {
    const where = `node "${key}"`;
    if (typeof node !== 'object' || node === null) {
      errors.push(`${where}: must be an object`);
      continue;
    }
    // The map key is the addressable id. A node whose `id` field disagrees is
    // almost always a copy-paste rename, and every edge would silently target
    // the wrong line, so it is reported rather than quietly reconciled.
    if (node.id !== key) {
      errors.push(`${where}: node.id "${String(node.id)}" does not match its map key`);
    }
    if (node.speaker !== 'npc' && node.speaker !== 'player') {
      errors.push(`${where}: speaker must be "npc" or "player", got "${String(node.speaker)}"`);
    }
    if (typeof node.text !== 'string' || node.text.length === 0) {
      errors.push(`${where}: missing text`);
    }
    if (node.next !== undefined) {
      if (typeof node.next !== 'string' || !nodeIds.has(node.next)) {
        errors.push(`${where}: next "${String(node.next)}" does not exist`);
      }
    }
    if (node.choices !== undefined) {
      if (!Array.isArray(node.choices)) {
        errors.push(`${where}: choices must be an array`);
      } else {
        node.choices.forEach((choice, index) =>
          validateChoice(choice, key, index, nodeIds, errors),
        );
      }
    }
    if (node.effects !== undefined) {
      if (!Array.isArray(node.effects)) {
        errors.push(`${where}: effects must be an array`);
      } else {
        node.effects.forEach((effect, index) =>
          validateEffect(effect, `${where} effect ${index}`, errors),
        );
      }
    }
  }

  // Unreachable nodes are authoring waste, not a crash, but they are the single
  // most common symptom of a mistyped edge, so they are surfaced as errors too.
  if (nodeIds.has(graph.startNodeId)) {
    const reachable = new Set<string>();
    const queue: string[] = [graph.startNodeId];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (reachable.has(current)) continue;
      reachable.add(current);
      const node: DialogueNode | undefined = graph.nodes[current];
      if (!node) continue;
      if (node.next && nodeIds.has(node.next)) queue.push(node.next);
      for (const choice of node.choices ?? []) {
        if (choice?.nextNodeId && nodeIds.has(choice.nextNodeId)) queue.push(choice.nextNodeId);
      }
    }
    for (const id of nodeIds) {
      if (!reachable.has(id)) {
        errors.push(`node "${id}" is unreachable from startNodeId "${graph.startNodeId}"`);
      }
    }
  }

  return errors;
}

// ============================================================================
// Loading
// ============================================================================

/**
 * Synchronous half of the loader: validates already-parsed JSON and returns a
 * typed graph. Throws with the collected errors so a bad graph fails loudly at
 * the load boundary instead of half-playing in front of a player.
 */
export function parseDialogueGraph(raw: unknown, sourceLabel = 'graph'): DialogueGraph {
  const graph = raw as DialogueGraph;
  const errors = validateDialogueGraph(graph);
  if (errors.length > 0) {
    throw new Error(`Invalid dialogue graph "${sourceLabel}": ${errors.join('; ')}`);
  }
  return graph;
}

const graphCache = new Map<string, Promise<DialogueGraph>>();

/**
 * Loads an authored graph by id from `public/data/dialogue/<id>.json`.
 *
 * Rejects when the file is missing or fails validation. Callers that would
 * rather degrade than throw should catch and fall back to the topic pool.
 */
export function loadDialogueGraph(id: string): Promise<DialogueGraph> {
  const cached = graphCache.get(id);
  if (cached) return cached;

  const url = dialogueGraphUrl(id);
  const pending = fetchWithTimeout<unknown>(url, { timeoutMs: 10000 })
    .then((raw) => parseDialogueGraph(raw, id))
    .catch((error) => {
      // Evict so a transient network failure does not poison the whole session.
      graphCache.delete(id);
      logger.error('[dialogueGraphLoader] Failed to load dialogue graph', { id, url, error });
      throw error;
    });

  graphCache.set(id, pending);
  return pending;
}

/** Drops cached graphs. Used by tests and by hot content reloads. */
export function clearDialogueGraphCache(): void {
  graphCache.clear();
}
