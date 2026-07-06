/**
 * Regression test: suggested-reply chips in the hostile opening must SUBMIT
 * the line through the same de-escalation path as free text + Send. They
 * previously only filled the input box (setInputText) so a click appeared to
 * do nothing.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationPanel } from '../ConversationPanel';
import type { GameState } from '../../../types';

const sendPlayerMessage = vi.fn();
const runDeEscalationFlow = vi.fn().mockResolvedValue(undefined);
const resolveDeEscalationIntent = vi.fn().mockResolvedValue({ kind: 'attack' });

vi.mock('../../../hooks/useConversation', () => ({
  useConversation: () => ({
    sendPlayerMessage: (...a: unknown[]) => sendPlayerMessage(...a),
    endConversation: vi.fn(),
    isInteractionLocked: false,
  }),
}));

vi.mock('../../../hooks/useDeEscalation', () => ({
  useDeEscalation: () => ({
    runDeEscalationFlow: (...a: unknown[]) => runDeEscalationFlow(...a),
    rollCheckDice: vi.fn(),
  }),
}));

vi.mock('../../../systems/gameEntry/resolveDeEscalationIntent', () => ({
  resolveDeEscalationIntent: (...a: unknown[]) => resolveDeEscalationIntent(...a),
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

function makeState(): GameState {
  return {
    party: [{ id: 'pc1', name: 'Hero', skills: [], statusEffects: [] }],
    companions: {},
    activeConversation: {
      kind: 'situation',
      isPlayerTurn: true,
      participants: [],
      npcParticipants: [{ id: 'npc1', name: 'Guard' }],
      messages: [],
    },
    gameEntry: {
      situation: {
        threat: { tension: 'standoff' },
        suggestedReplies: ["What's this about?", "I didn't do anything, I swear!"],
      },
    },
  } as unknown as GameState;
}

describe('ConversationPanel suggested-reply chips', () => {
  // jsdom has no scrollIntoView; the panel calls it on message updates.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resolveDeEscalationIntent.mockResolvedValue({ kind: 'attack' });
  });

  it('clicking a chip submits the line through the de-escalation flow', async () => {
    render(<ConversationPanel gameState={makeState()} dispatch={vi.fn()} />);

    const firstChip = screen.getAllByTestId('reply-chip')[0];
    expect(firstChip).toHaveClass('min-h-11');
    expect(screen.getByTestId('opening-attack')).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /End conversation/i })).toHaveClass('conversation-close-btn');

    fireEvent.click(firstChip);

    await waitFor(() => {
      expect(resolveDeEscalationIntent).toHaveBeenCalledWith(
        "What's this about?",
        'standoff',
        expect.anything(),
      );
      expect(runDeEscalationFlow).toHaveBeenCalledTimes(1);
    });
    // Hostile path, not the plain conversation path.
    expect(sendPlayerMessage).not.toHaveBeenCalled();
  });

  it('chip click behaves like typing the same text and pressing Send', async () => {
    render(<ConversationPanel gameState={makeState()} dispatch={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: "What's this about?" } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(resolveDeEscalationIntent).toHaveBeenCalledTimes(1));
    const freeTextArgs = resolveDeEscalationIntent.mock.calls[0];

    resolveDeEscalationIntent.mockClear();
    fireEvent.click(screen.getAllByTestId('reply-chip')[0]);
    await waitFor(() => expect(resolveDeEscalationIntent).toHaveBeenCalledTimes(1));

    expect(resolveDeEscalationIntent.mock.calls[0]).toEqual(freeTextArgs);
  });
});
