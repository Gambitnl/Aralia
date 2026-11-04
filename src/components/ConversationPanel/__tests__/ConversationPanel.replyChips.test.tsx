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
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConversationPanel } from '../ConversationPanel';
import type { GameState } from '../../../types';
import type { ModelPreparationResult } from '../../../services/ollama';
import { OLLAMA_TIMEOUT_MS } from '../../../config/llmProviderConfig';

const sendPlayerMessage = vi.fn().mockResolvedValue({ delivery: 'delivered', reply: 'failed' });
const prepareForTask = vi.fn(async (_task?: unknown, _options?: { signal?: AbortSignal }): Promise<ModelPreparationResult> => ({ status: 'ready', model: 'test-model' }));
const runIntentFlow = vi.fn().mockResolvedValue({ outcome: 'combat', note: '' });
const resolvePlayerIntent = vi.fn().mockResolvedValue({ kind: 'attack' });
const replyState = vi.hoisted(() => ({ error: null as string | null }));

vi.mock('../../../hooks/useConversation', () => ({
  useConversation: () => ({
    sendPlayerMessage: (...a: unknown[]) => sendPlayerMessage(...a),
    endConversation: vi.fn(),
    isInteractionLocked: false,
    preparationStatus: null,
    cancelPreparation: vi.fn(),
    responseError: replyState.error,
  }),
}));

vi.mock('../../../services/ollama', () => ({
  OllamaService: { prepareForTask: (...a: unknown[]) => prepareForTask(...a) },
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

describe('ConversationPanel unavailable intent reader', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a provider failure as an alert outside the fictional transcript', () => {
    replyState.error = 'No reply was received. Your words remain in the conversation.';
    try {
      render(<ConversationPanel gameState={makePeacefulState()} dispatch={vi.fn()} />);
      expect(screen.getByRole('alert')).toHaveTextContent(replyState.error);
    } finally { replyState.error = null; }
  });

  it('stops displaying intent reading while the actual companion reply is pending', async () => {
    vi.clearAllMocks();
    resolvePlayerIntent.mockResolvedValueOnce({ kind: 'talk' });
    sendPlayerMessage.mockImplementationOnce(() => new Promise(() => {}));
    render(<ConversationPanel gameState={makePeacefulState()} dispatch={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'What do you want to do next?' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => expect(sendPlayerMessage).toHaveBeenCalledOnce());
    expect(screen.queryByText(/Preparing local dialogue/)).not.toBeInTheDocument();
  });

  it('delivers a valid local-model reply after fifteen seconds exactly once', async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    let finish!: (intent: { kind: string }) => void;
    resolvePlayerIntent.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<ConversationPanel gameState={makePeacefulState()} dispatch={vi.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Thank you. What do you want to do next?' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(input).toBeDisabled();
    expect(screen.queryByTestId('intent-error')).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(resolvePlayerIntent).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ kind: 'talk' }); });
    expect(sendPlayerMessage).toHaveBeenCalledExactlyOnceWith('Thank you. What do you want to do next?', undefined, expect.any(AbortSignal));
    expect(runIntentFlow).not.toHaveBeenCalled();
  });

  it('returns the unsent words and ignores an attack arriving after the deadline', async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    let finish!: (intent: { kind: string }) => void;
    resolvePlayerIntent.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<ConversationPanel gameState={makePeacefulState()} dispatch={vi.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Where is your temple?' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText(/Preparing your local dialogue model/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /End conversation/i })).toBeEnabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(OLLAMA_TIMEOUT_MS + 5000); });
    expect(input).toHaveValue('Where is your temple?');
    expect(input).toBeEnabled();
    expect(screen.getByTestId('intent-error')).toHaveTextContent('Try again, or end the conversation.');
    await act(async () => { finish({ kind: 'attack' }); });
    expect(runIntentFlow).not.toHaveBeenCalled();
    expect(sendPlayerMessage).not.toHaveBeenCalled();
  });

  it('cancels local preparation, restores the one unsent line, and never classifies it', async () => {
    vi.clearAllMocks();
    prepareForTask.mockImplementationOnce((_task?: unknown, { signal }: { signal?: AbortSignal } = {}) => new Promise(resolve => {
      signal?.addEventListener('abort', () => resolve({ status: 'cancelled' as const }), { once: true });
    }));
    render(<ConversationPanel gameState={makePeacefulState()} dispatch={vi.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Why restore the temple?' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await screen.findByText(/Preparing your local dialogue model/);
    await act(async () => { fireEvent.click(screen.getByTestId('cancel-dialogue-preparation')); });
    expect(input).toHaveValue('Why restore the temple?');
    expect(resolvePlayerIntent).not.toHaveBeenCalled();
    expect(sendPlayerMessage).not.toHaveBeenCalled();
  });

  it('shows message understanding after local prep without labeling remote/action reading as local or NPC speech', async () => {
    vi.clearAllMocks();
    let finish!: (intent: { kind: string }) => void;
    resolvePlayerIntent.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<ConversationPanel gameState={makePeacefulState()} dispatch={vi.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'I ask where the temple stands.' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(resolvePlayerIntent).toHaveBeenCalledOnce());
    expect(screen.getByText(/Understanding your message/)).toBeInTheDocument();
    expect(screen.queryByText(/Preparing your local dialogue model/)).not.toBeInTheDocument();
    expect(screen.queryByText(/NPC/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /End conversation/i })).toBeEnabled();
    fireEvent.click(screen.getByTestId('cancel-dialogue-preparation'));
    expect(input).toHaveValue('I ask where the temple stands.');
    await act(async () => { finish({ kind: 'talk' }); });
    expect(sendPlayerMessage).not.toHaveBeenCalled();
  });

  it('does not apply a classification after the conversation panel closes', async () => {
    vi.clearAllMocks();
    let finish!: (intent: { kind: string }) => void;
    resolvePlayerIntent.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<ConversationPanel gameState={makePeacefulState()} dispatch={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Where is your temple?' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => expect(resolvePlayerIntent).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => { finish({ kind: 'attack' }); });
    expect(runIntentFlow).not.toHaveBeenCalled();
    expect(sendPlayerMessage).not.toHaveBeenCalled();
  });

  it('unlocks a replacement conversation without applying the former reader result', async () => {
    vi.clearAllMocks();
    let finish!: (intent: { kind: string }) => void;
    resolvePlayerIntent.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const first = makePeacefulState();
    first.activeConversation!.id = 'first-conversation';
    const view = render(<ConversationPanel gameState={first} dispatch={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Where is your temple?' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => expect(resolvePlayerIntent).toHaveBeenCalledOnce());
    const next = makePeacefulState();
    next.activeConversation!.id = 'next-conversation';
    view.rerender(<ConversationPanel gameState={next} dispatch={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeEnabled();
    expect(screen.queryByText(/Preparing local dialogue/)).not.toBeInTheDocument();
    await act(async () => { finish({ kind: 'attack' }); });
    expect(runIntentFlow).not.toHaveBeenCalled();
    expect(sendPlayerMessage).not.toHaveBeenCalled();
  });
});

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
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
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

    expect(resolvePlayerIntent.mock.calls[0].slice(0, 3)).toEqual(freeTextArgs.slice(0, 3));
    expect(resolvePlayerIntent.mock.calls[0][3]).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }));
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
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it('sends plain talk straight to the conversation, with no roll', async () => {
    resolvePlayerIntent.mockResolvedValue({ kind: 'talk' });
    render(<ConversationPanel gameState={makePeacefulState()} dispatch={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Hello there.' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(sendPlayerMessage).toHaveBeenCalledWith('Hello there.', undefined, expect.any(AbortSignal)));
    expect(input).toHaveValue('');
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
