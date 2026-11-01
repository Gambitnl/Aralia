import test from 'node:test';
import assert from 'node:assert/strict';

import { A2H_FILTERS, A2H_FILTER_LABELS, A2H_NEEDS, collectA2H, filterA2H, formatA2H, formatA2HReply, isAnswered, parseA2H, parseA2HReply, refKind, refTitle } from './a2h-feed.mjs';

/**
 * Proves the agent-to-human feed shows only well-formed messages from agents,
 * each with its need, its board reference and its sender's identity, newest
 * first, and that the client's message format round-trips through the parser.
 *
 * Exercises: dashboard/a2h-feed.mjs
 */

test('formatA2H and parseA2H round-trip a plain-English message', () => {
  const body = formatA2H({ need: 'decision', ref: 'agora-437d.6', text: '  Should the queue adapter go live?  ' });
  assert.equal(body, 'A2H need=decision ref=agora-437d.6\nShould the queue adapter go live?');
  assert.deepEqual(parseA2H(body), { need: 'decision', ref: 'agora-437d.6', text: 'Should the queue adapter go live?' });
});

test('formatA2H refuses a bad need, a bad ref, or empty text', () => {
  assert.throws(() => formatA2H({ need: 'urgent', ref: 'x', text: 'hi' }), /need must be one of/);
  assert.throws(() => formatA2H({ need: 'info', ref: 'has space', text: 'hi' }), /ref must be/);
  assert.throws(() => formatA2H({ need: 'info', ref: 'x', text: '   ' }), /must not be empty/);
});

test('parseA2H ignores ordinary messages and malformed tag lines', () => {
  assert.equal(parseA2H('ordinary command traffic'), null);
  assert.equal(parseA2H('A2H need=decision ref=x'), null); // no plain text after the tag
  assert.equal(parseA2H('A2H need=maybe ref=x\ntext'), null);
  assert.equal(parseA2H('note first\nA2H need=info ref=x\ntext'), null); // tag must be the first line
});

test('refKind names a task, a campaign, or nothing', () => {
  const board = { tasks: [{ id: 'agora-1.2' }], campaigns: [{ id: 'agora-1' }] };
  assert.equal(refKind('agora-1.2', board), 'task');
  assert.equal(refKind('agora-1', board), 'campaign');
  assert.equal(refKind('agora-9', board), null);
});

test('refTitle names the work in plain words, not the raw id', () => {
  const board = { tasks: [{ id: 'agora-1.2', title: 'Build the To Remy feed' }], campaigns: [{ id: 'agora-1', scope: 'Fix the Codex wake' }] };
  assert.equal(refTitle('agora-1.2', board), 'Build the To Remy feed');
  assert.equal(refTitle('agora-1', board), 'Fix the Codex wake');
  assert.equal(refTitle('agora-9', board), '');
});

test('collectA2H keeps agent messages only, newest first, with sender identity', () => {
  const agents = [
    { id: 'claude-id', handle: 'claude-agora-review', role: 'orchestrator', model: 'claude-opus-5-5', status: 'online' },
    { id: 'remy-id', handle: 'Remy', role: 'human' },
  ];
  const messages = [
    { id: 'm1', seq: 10, from: 'claude-id', to: 'remy-id', body: formatA2H({ need: 'info', ref: 'agora-1', text: 'Q1 passed.' }) },
    { id: 'm2', seq: 12, from: 'claude-id', to: 'remy-id', body: formatA2H({ need: 'decision', ref: 'agora-1.2', text: 'Flip the adapter?' }) },
    { id: 'm3', seq: 13, from: 'remy-id', to: 'all', body: formatA2H({ need: 'info', ref: 'agora-1', text: 'human post' }) },
    { id: 'm4', seq: 14, from: 'claude-id', to: 'all', body: 'plain command traffic' },
  ];
  const items = collectA2H(messages, { agents, tasks: [{ id: 'agora-1.2' }], campaigns: [{ id: 'agora-1' }] });
  assert.deepEqual(items.map((item) => item.id), ['m2', 'm1']);
  assert.equal(items[0].needLabel, A2H_NEEDS.decision);
  assert.equal(items[0].refKind, 'task');
  assert.equal(items[1].refKind, 'campaign');
  assert.deepEqual(items[0].from, { id: 'claude-id', handle: 'claude-agora-review', role: 'orchestrator', model: 'claude-opus-5-5', status: 'online' });
});

test('a human reply round-trips and threads under the message it answers', () => {
  const reply = formatA2HReply({ seq: 12, ref: 'agora-1.2', text: ' Yes, switch it on. ' });
  assert.equal(reply, 'A2H-REPLY seq=12 ref=agora-1.2\nYes, switch it on.');
  assert.deepEqual(parseA2HReply(reply), { seq: 12, ref: 'agora-1.2', text: 'Yes, switch it on.' });
  assert.equal(parseA2HReply('A2H-REPLY seq=12 ref=x'), null);
  assert.throws(() => formatA2HReply({ seq: 12, ref: 'x', text: '  ' }), /must not be empty/);

  const agents = [
    { id: 'claude-id', handle: 'claude-agora-review', role: 'orchestrator', model: 'claude-opus-5-5' },
    { id: 'remy-id', handle: 'Remy', role: 'human' },
  ];
  const messages = [
    { id: 'm2', seq: 12, from: 'claude-id', to: 'remy-id', body: formatA2H({ need: 'decision', ref: 'agora-1.2', text: 'Flip the adapter?' }) },
    { id: 'r1', seq: 15, from: 'remy-id', to: 'claude-id', body: reply },
    { id: 'r0', seq: 14, from: 'remy-id', to: 'claude-id', body: formatA2HReply({ seq: 12, ref: 'agora-1.2', text: 'Let me check.' }) },
  ];
  const [item] = collectA2H(messages, { agents });
  assert.equal(item.id, 'm2');
  assert.equal(item.answered, true);
  assert.equal(item.needLabel, 'Answered · needs agent follow-up');
  assert.equal(isAnswered(item), true);
  assert.deepEqual(item.replies.map((entry) => entry.text), ['Let me check.', 'Yes, switch it on.']);
  assert.equal(item.replies[0].from.handle, 'Remy');
  // A reply is never a feed item of its own.
  assert.equal(collectA2H(messages, { agents }).length, 1);
});

test('filterA2H keeps one need, counts every button, and can hide answered items (Remy, Agora 8318)', () => {
  const human = { from: { role: 'human' } };
  const agentReply = { from: { role: 'orchestrator' } };
  const items = [
    { seq: 5, need: 'decision', replies: [] },
    { seq: 4, need: 'decision', replies: [human] },
    { seq: 3, need: 'info', replies: [agentReply] },
    { seq: 2, need: 'none', replies: [] },
    { seq: 1, need: 'decision', replies: [agentReply] },
  ];
  const decisions = filterA2H(items, { need: 'decision' });
  // Answered decision (seq 4) is excluded from outstanding decisions
  assert.deepEqual(decisions.items.map((item) => item.seq), [5, 1]);
  assert.deepEqual(decisions.counts, { all: 5, decision: 2, answered: 1, info: 1, none: 1 });
  assert.equal(decisions.need, 'decision');

  // Answered filter shows the answered item
  const answered = filterA2H(items, { need: 'answered' });
  assert.deepEqual(answered.items.map((item) => item.seq), [4]);
  assert.equal(answered.counts.answered, 1);
  assert.equal(A2H_FILTER_LABELS.answered, 'Answered');

  // Only a human reply counts as an answer; an agent's follow-up does not.
  assert.equal(isAnswered(items[1]), true);
  assert.equal(isAnswered(items[4]), false);
  const open = filterA2H(items, { need: 'decision', unansweredOnly: true });
  assert.deepEqual(open.items.map((item) => item.seq), [5, 1]);
  assert.deepEqual(open.counts, { all: 4, decision: 2, answered: 0, info: 1, none: 1 });

  // An unknown filter value shows everything rather than an empty feed.
  const fallback = filterA2H(items, { need: 'urgent' });
  assert.equal(fallback.need, 'all');
  assert.equal(fallback.items.length, 5);
  assert.deepEqual(A2H_FILTERS, ['all', 'decision', 'answered', 'info', 'none']);
});

test('a reply from an agent is labeled as that agent, never "You" (Remy, Agora 8702)', () => {
  const agents = [
    { id: 'claude-id', handle: 'claude-agora-review', role: 'orchestrator' },
    { id: 'remy-id', handle: 'Remy', role: 'human' },
  ];
  const messages = [
    { id: 'm1', seq: 20, from: 'claude-id', to: 'remy-id', body: formatA2H({ need: 'decision', ref: 'agora-1', text: 'Pick a or b?' }) },
    { id: 'r1', seq: 21, from: 'remy-id', to: 'claude-id', body: formatA2HReply({ seq: 20, ref: 'agora-1', text: 'a' }) },
    { id: 'r2', seq: 22, from: 'claude-id', to: 'remy-id', body: formatA2HReply({ seq: 20, ref: 'agora-1', text: 'Done.' }) },
    { id: 'r3', seq: 23, from: 'gone-agent-1234', to: 'remy-id', body: formatA2HReply({ seq: 20, ref: 'agora-1', text: 'Also done.' }) },
  ];
  const [item] = collectA2H(messages, { agents });
  assert.deepEqual(item.replies.map((r) => [r.label, r.byHuman]), [
    ['You', true],
    ['claude-agora-review', false],
    ['an agent (gone-age)', false],
  ]);
});
