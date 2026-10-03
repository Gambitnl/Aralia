/**
 * Regression test: suggested-reply chips must SUBMIT the line through the same
 * intent path as free text + Send. They previously only filled the input box
 * (setInputText) so a click appeared to do nothing.
 *
 * Also pins the rule that made the reader universal: an ordinary line is read
 * on EVERY submission, and a `talk` verdict is the only thing that reaches the
 * plain conversation path.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationPanel } from '../ConversationPanel';
import type { GameState } from '../../../types';

const sendPlayerMessage = vi.fn();
const runIntentFlow = vi.fn().mockResolvedValue({ outcome: 'combat', note: '' });
const resolvePlayerIntent = vi.fn().mockResolvedValue({ kind: 'attack' });

vi.mock('../../../hooks/useConversation', () => ({
  useConversation: () => ({
    sendPlayerMessage: (...a: unknown[]) => sendPlayerMessage(...a),
    endConversation: vi.fn(),
    isInteractionLocked: false,
  }),
}));

vi.mock('../../../hooks/useDeEscalation', () => ({
  useDeEscalation: () => ({ rollCheckDice: vi.fn() }),
}));

vi.mock('../../../systems/intent/resolvePlayerIntent', () => ({
  resolvePlayerIntent: (...a: unknown[]) => resolvePlayerIntent(...a),
}));

vi.mock('../../../systems/intent/runIntentFlow', () => ({
  runIntentFlow: (...a: unknown[]) => runIntentFlow(...a),
}));

vi.mock('../../../systems/gameEntry/runDeEscalationCheck', () => ({
  computeSkillModifier: () => 0,
}));

vi.mock('../../../services/SpellService', () => ({
  spellService: { getSpellDetails: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../../hooks/actions/handleResourceActions', () => ({
  handleCastSpell: vi.fn(),
}));

function makeState(overrides: Record<string, unknown> = {}): GameState {
  return {
    party: [{ id: 'pc1', name: 'Hero', skills: [], statusEffects: [] }],
    companions: {},
    activeConversation: {
      kind: 'situation',
      isPlayerTurn: true,
      participants: [],
      npcParticipants: [{ id: 'npc1', name: 'Guard', personality: 'a city guard' }],
      messages: [],
    },
    gameEntry: {
      situation: {
        threat: { tension: 'standoff', deEscalationDC: 13 },
        npcs: [{ id: 'npc1', name: 'Guard', role: 'a city guard' }],
        suggestedReplies: ["What's this about?", "I didn't do anything, I swear!"],
      },
    },
    ...overrides,
  } as unknown as GameState;
}

/** The same state with no threat — the peaceful case that used to be inert. */
function makePeacefulState(): GameState {
  return makeState({
    gameEntry: {
      situation: {
        predicament: 'A festival argument.',
        npcs: [{ id: 'npc1', name: 'Guard', role: 'a festival organizer' }],
        suggestedReplies: ['Perhaps I can help.'],
      },
    },
  });
}

describe('ConversationPanel suggested-reply chips', () => {
  // jsdom has no scrollIntoView; the panel calls it on message updates.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resolvePlayerIntent.mockResolvedValue({ kind: 'attack' });
    runIntentFlow.mockResolvedValue({ outcome: 'combat', note: '' });
  });

  it('clicking a chip submits the line through the intent flow', async () => {
    render(<ConversationPanel gameState={makeState()} dispatch={vi.fn()} />);

    const firstChip = screen.getAllByTestId('reply-chip')[0];
    expect(firstChip).toHaveClass('min-h-11');
    expect(screen.getByTestId('opening-attack')).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /End conversation/i })).toHaveClass('conversation-close-btn');

    fireEvent.click(firstChip);

    await waitFor(() => {
      expect(resolvePlayerIntent).toHaveBeenCalledWith(
        "What's this about?",
        expect.objectContaining({ hostile: true, tension: 'standoff' }),
        expect.anything(),
      );
      expect(runIntentFlow).toHaveBeenCalledTimes(1);
    });
    // An attack goes to combat, never to the prose path.
    expect(sendPlayerMessage).not.toHaveBeenCalled();
  });

  it('chip click behaves like typing the same text and pressing Send', async () => {
    render(<ConversationPanel gameState={makeState()} dispatch={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: "What's this about?" } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(resolvePlayerIntent).toHaveBeenCalledTimes(1));
    const freeTextArgs = resolvePlayerIntent.mock.calls[0];

    resolvePlayerIntent.mockClear();
    fireEvent.click(screen.getAllByTestId('reply-chip')[0]);
    await waitFor(() => expect(resolvePlayerIntent).toHaveBeenCalledTimes(1));

    expect(resolvePlayerIntent.mock.calls[0]).toEqual(freeTextArgs);
  });
});

describe('ConversationPanel universal intent reading', () => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    runIntentFlow.mockResolvedValue({ outcome: 'talk', note: '' });
  });

  it('reads intent in a PEACEFUL scene, which used to bypass the reader entirely', async () => {
    resolvePlayerIntent.mockResolvedValue({ kind: 'talk' });
    render(<ConversationPanel gameState={makePeacefulState()} dispatch={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Perhaps I can help.' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(resolvePlayerIntent).toHaveBeenCalledWith(
        'Perhaps I can help.',
        expect.objectContaining({ hostile: false }),
        expect.anything(),
      );
    });
  });

  it('sends plain talk straight to the conversation, with no roll', async () => {
    resolvePlayerIntent.mockResolvedValue({ kind: 'talk' });
    render(<ConversationPanel gameState={makePeacefulState()} dispatch={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello there.' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(sendPlayerMessage).toHaveBeenCalledWith('Hello there.'));
    expect(runIntentFlow).not.toHaveBeenCalled();
  });

  it('attaches a resolved check to the message so the NPCs answer the result', async () => {
    resolvePlayerIntent.mockResolvedValue({
      kind: 'skill', skill: 'Performance', ability: 'Charisma',
      dc: 13, stakes: 'moderate', rationale: 'dazzle them',
    });
    runIntentFlow.mockResolvedValue({
      outcome: 'check', note: 'Performance check: 17 + 5 = 22 vs DC 13 — success.', success: true,
    });
    render(<ConversationPanel gameState={makePeacefulState()} dispatch={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'I juggle three lit torches.' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(sendPlayerMessage).toHaveBeenCalledWith(
        'I juggle three lit torches.',
        'Performance check: 17 + 5 = 22 vs DC 13 — success.',
      );
    });
  });

  it('surfaces an honest error when the reader cannot judge the line', async () => {
    resolvePlayerIntent.mockRejectedValue(new Error('Could not read your intent — try rephrasing.'));
    render(<ConversationPanel gameState={makePeacefulState()} dispatch={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'mrrgle' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByTestId('intent-error')).toHaveTextContent('try rephrasing');
    });
    expect(sendPlayerMessage).not.toHaveBeenCalled();
  });
});
