/**
 * @file src/systems/dialogue/__tests__/dialogueGraph.test.ts
 * Covers the DIAL-001 scripted dialogue graph: loading, validation, condition
 * evaluation, effect resolution, and linear traversal.
 *
 * The three shipped graphs under `public/data/dialogue/` are read from disk and
 * validated here. That is deliberate: a content file with a dangling edge is
 * the failure mode this system is most likely to hit, and a test that only
 * checks hand-built fixtures would never catch it.
 *
 * Called by: focused Vitest runs for agora-676a.
 * Depends on: dialogueGraphLoader.ts, dialogueGraphRuntime.ts.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  validateDialogueGraph,
  parseDialogueGraph,
  loadDialogueGraph,
  clearDialogueGraphCache,
  dialogueGraphUrl,
} from '../dialogueGraphLoader';
import {
  evaluateDialogueCondition,
  getAvailableChoices,
  applyDialogueEffects,
  advanceLinear,
  isTerminalNode,
} from '../dialogueGraphRuntime';
import type { DialogueGraph } from '../dialogueGraphTypes';

const SHIPPED_GRAPH_IDS = ['quest-giver', 'merchant-haggling', 'guard-interrogation'];

function readShippedGraph(id: string): DialogueGraph {
  const path = resolve(process.cwd(), 'public/data/dialogue', `${id}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as DialogueGraph;
}

/** Minimal valid graph used where the shipped content would be noise. */
function makeGraph(): DialogueGraph {
  return {
    id: 'test-graph',
    startNodeId: 'a',
    nodes: {
      a: { id: 'a', speaker: 'npc', text: 'Opening line.', next: 'b' },
      b: {
        id: 'b',
        speaker: 'npc',
        text: 'Branch point.',
        effects: [{ type: 'update_disposition', params: { delta: 3 } }],
        choices: [
          { text: 'Plain choice.', nextNodeId: 'c' },
          {
            text: 'Gated choice.',
            nextNodeId: 'c',
            condition: { type: 'unlock_flag', params: { flag: 'seen_the_ledger' } },
          },
        ],
      },
      c: { id: 'c', speaker: 'npc', text: 'Ending line.' },
    },
  };
}

describe('validateDialogueGraph', () => {
  it('accepts a well-formed graph', () => {
    expect(validateDialogueGraph(makeGraph())).toEqual([]);
  });

  it.each(SHIPPED_GRAPH_IDS)('validates the shipped graph %s', (id) => {
    const graph = readShippedGraph(id);
    expect(graph.id).toBe(id);
    expect(validateDialogueGraph(graph)).toEqual([]);
  });

  it('reports a missing start node', () => {
    const graph = makeGraph();
    graph.startNodeId = 'nowhere';
    expect(validateDialogueGraph(graph)).toContain(
      'startNodeId "nowhere" does not exist in nodes',
    );
  });

  it('reports a dangling choice edge', () => {
    const graph = makeGraph();
    graph.nodes.b.choices![0].nextNodeId = 'ghost';
    const errors = validateDialogueGraph(graph);
    expect(errors.some((e) => e.includes('nextNodeId "ghost" does not exist'))).toBe(true);
  });

  it('reports a node whose id disagrees with its map key', () => {
    const graph = makeGraph();
    graph.nodes.c.id = 'renamed';
    const errors = validateDialogueGraph(graph);
    expect(errors.some((e) => e.includes('does not match its map key'))).toBe(true);
  });

  it('reports unknown condition and effect kinds', () => {
    const graph = makeGraph();
    // Cast through unknown: the point is content that the TYPES forbid but a
    // hand-edited JSON file can still contain.
    graph.nodes.b.choices![1].condition = {
      type: 'moon_phase',
      params: {},
    } as unknown as never;
    graph.nodes.b.effects = [{ type: 'summon_dragon', params: {} }] as unknown as never;
    const errors = validateDialogueGraph(graph);
    expect(errors.some((e) => e.includes('unknown condition type "moon_phase"'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown effect type "summon_dragon"'))).toBe(true);
  });

  it('reports an unreachable node', () => {
    const graph = makeGraph();
    graph.nodes.orphan = { id: 'orphan', speaker: 'npc', text: 'Nobody hears this.' };
    const errors = validateDialogueGraph(graph);
    expect(errors.some((e) => e.includes('node "orphan" is unreachable'))).toBe(true);
  });
});

describe('loadDialogueGraph', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearDialogueGraphCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    clearDialogueGraphCache();
  });

  it('builds a URL under the dialogue data directory', () => {
    expect(dialogueGraphUrl('quest-giver')).toContain('data/dialogue/quest-giver.json');
  });

  it('fetches, validates, and caches a graph', async () => {
    const payload = readShippedGraph('quest-giver');
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const first = await loadDialogueGraph('quest-giver');
    const second = await loadDialogueGraph('quest-giver');

    expect(first.startNodeId).toBe('greeting');
    expect(second).toBe(first);
    // Cached: two callers, one request.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid graph instead of half-playing it', async () => {
    const broken = { id: 'broken', startNodeId: 'missing', nodes: {} };
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(broken), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    await expect(loadDialogueGraph('broken')).rejects.toThrow(/Invalid dialogue graph/);
  });

  it('parseDialogueGraph throws with the collected errors', () => {
    expect(() => parseDialogueGraph({ id: 'x', startNodeId: 'y', nodes: {} }, 'x')).toThrow(
      /does not exist in nodes/,
    );
  });
});

describe('evaluateDialogueCondition', () => {
  it('matches quest status exactly', () => {
    const condition = {
      type: 'quest_status' as const,
      params: { questId: 'q1', status: 'Active' },
    };
    expect(evaluateDialogueCondition(condition, { questStatuses: { q1: 'Active' } })).toBe(true);
    expect(evaluateDialogueCondition(condition, { questStatuses: { q1: 'Completed' } })).toBe(false);
    expect(evaluateDialogueCondition(condition, {})).toBe(false);
  });

  it('honors disposition bounds', () => {
    const condition = { type: 'disposition' as const, params: { min: 10, max: 50 } };
    expect(evaluateDialogueCondition(condition, { disposition: 25 })).toBe(true);
    expect(evaluateDialogueCondition(condition, { disposition: 5 })).toBe(false);
    expect(evaluateDialogueCondition(condition, { disposition: 80 })).toBe(false);
  });

  it('counts item quantity', () => {
    const condition = {
      type: 'has_item' as const,
      params: { itemId: 'item_coin_purse', quantity: 2 },
    };
    expect(evaluateDialogueCondition(condition, { inventory: { item_coin_purse: 2 } })).toBe(true);
    expect(evaluateDialogueCondition(condition, { inventory: { item_coin_purse: 1 } })).toBe(false);
  });

  it('matches time of day case-insensitively across a list', () => {
    const condition = { type: 'time_of_day' as const, params: { is: ['Night', 'Dusk'] } };
    expect(evaluateDialogueCondition(condition, { timeOfDay: 'night' })).toBe(true);
    expect(evaluateDialogueCondition(condition, { timeOfDay: 'Day' })).toBe(false);
  });

  it('reads unlock flags and supports negation', () => {
    const set = { type: 'unlock_flag' as const, params: { flag: 'undercroft_access' } };
    const unset = {
      type: 'unlock_flag' as const,
      params: { flag: 'undercroft_access', negate: true },
    };
    expect(evaluateDialogueCondition(set, { flags: { undercroft_access: true } })).toBe(true);
    expect(evaluateDialogueCondition(set, { flags: {} })).toBe(false);
    expect(evaluateDialogueCondition(unset, { flags: {} })).toBe(true);
  });

  it('hides gated choices and keeps ungated ones', () => {
    const graph = makeGraph();
    expect(getAvailableChoices(graph.nodes.b, {})).toHaveLength(1);
    expect(getAvailableChoices(graph.nodes.b, { flags: { seen_the_ledger: true } })).toHaveLength(2);
  });
});

describe('applyDialogueEffects', () => {
  it('resolves every supported effect kind and folds local state forward', () => {
    const { outcomes, context } = applyDialogueEffects(
      [
        { type: 'update_disposition', params: { delta: 10 } },
        { type: 'grant_item', params: { itemId: 'item_shepherds_lantern' } },
        { type: 'set_flag', params: { flag: 'quest_giver_pasture_accepted' } },
        { type: 'start_quest', params: { questId: 'quest_pasture_predator' } },
        { type: 'unlock_topic', params: { topicId: 'topic_high_pasture' } },
      ],
      { disposition: 5 },
    );

    expect(outcomes.every((o) => o.applied)).toBe(true);
    expect(context.disposition).toBe(15);
    expect(context.inventory).toEqual({ item_shepherds_lantern: 1 });
    expect(context.flags).toEqual({ quest_giver_pasture_accepted: true });
    // Quest and topic writes belong to the caller's reducer, so they are
    // reported but change no local context.
    expect(outcomes.find((o) => o.type === 'start_quest')?.questId).toBe('quest_pasture_predator');
    expect(outcomes.find((o) => o.type === 'unlock_topic')?.topicId).toBe('topic_high_pasture');
  });

  it('marks an effect with missing params as not applied instead of throwing', () => {
    const { outcomes, context } = applyDialogueEffects(
      [{ type: 'grant_item', params: {} }],
      { disposition: 0 },
    );
    expect(outcomes[0].applied).toBe(false);
    expect(outcomes[0].reason).toMatch(/requires params.itemId/);
    expect(context.inventory).toBeUndefined();
  });

  it('returns the same context reference when there is nothing to apply', () => {
    const context = { disposition: 1 };
    expect(applyDialogueEffects(undefined, context).context).toBe(context);
  });
});

describe('advanceLinear', () => {
  it('plays a linear run to the first branch, applying effects on the way', () => {
    const graph = makeGraph();
    const run = advanceLinear(graph, graph.startNodeId, { disposition: 0 });
    expect(run.visited.map((n) => n.id)).toEqual(['a', 'b']);
    expect(run.nodeId).toBe('b');
    expect(run.context.disposition).toBe(3);
  });

  it('walks the shipped quest-giver graph from greeting to the accepted ending', () => {
    const graph = readShippedGraph('quest-giver');
    const opening = advanceLinear(graph, graph.startNodeId, { disposition: 0 });
    expect(opening.nodeId).toBe('pitch');

    const choices = getAvailableChoices(graph.nodes.pitch, opening.context);
    expect(choices.map((c) => c.text)).toEqual([
      "I'll take the job.",
      'What does it pay?',
      'Find someone else.',
    ]);

    const accepted = advanceLinear(graph, choices[0].nextNodeId, opening.context);
    expect(accepted.visited.map((n) => n.id)).toEqual(['accept', 'farewell_accepted']);
    expect(accepted.context.disposition).toBe(10);
    expect(accepted.context.inventory).toEqual({ item_shepherds_lantern: 1 });
    expect(accepted.outcomes.map((o) => o.type)).toContain('start_quest');
    expect(isTerminalNode(graph.nodes[accepted.nodeId], accepted.context)).toBe(true);
  });

  it('hides the guard bribe branch without the purse and shows it with one', () => {
    const graph = readShippedGraph('guard-interrogation');
    const withoutPurse = getAvailableChoices(graph.nodes.challenge, {});
    const withPurse = getAvailableChoices(graph.nodes.challenge, {
      inventory: { item_coin_purse: 1 },
    });
    expect(withoutPurse.some((c) => c.nextNodeId === 'bribe')).toBe(false);
    expect(withPurse.some((c) => c.nextNodeId === 'bribe')).toBe(true);
  });

  it('opens the merchant reserved-stock branch only after the flag is set', () => {
    const graph = readShippedGraph('merchant-haggling');
    const opening = advanceLinear(graph, graph.startNodeId, { disposition: 0 });
    expect(
      getAvailableChoices(graph.nodes.offer, opening.context).some(
        (c) => c.nextNodeId === 'reserved_stock',
      ),
    ).toBe(false);

    const afterFullPrice = advanceLinear(graph, 'buy_full', opening.context);
    expect(afterFullPrice.context.flags).toMatchObject({ merchant_reserved_stock: true });
    expect(
      getAvailableChoices(graph.nodes.offer, afterFullPrice.context).some(
        (c) => c.nextNodeId === 'reserved_stock',
      ),
    ).toBe(true);
  });

  it('does not loop forever on a cyclic graph', () => {
    const cyclic: DialogueGraph = {
      id: 'cyclic',
      startNodeId: 'x',
      nodes: {
        x: { id: 'x', speaker: 'npc', text: 'x', next: 'y' },
        y: { id: 'y', speaker: 'npc', text: 'y', next: 'x' },
      },
    };
    const run = advanceLinear(cyclic, 'x', {});
    expect(run.visited.map((n) => n.id)).toEqual(['x', 'y']);
  });
});
