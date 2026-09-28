import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { DialogueInterface } from '../DialogueInterface';
import type { DialogueSession } from '../../../types/dialogue';
import type { GameState, NPC, PlayerCharacter } from '../../../types';

/**
 * Guards the conversation window against an unresolvable topic id (agora-f821.27).
 *
 * `processTopicSelection` throws `Topic <id> not found` for an id it cannot
 * resolve. That throw used to escape an async click handler with no try/catch,
 * reach the ErrorBoundary wrapping the mount in GameModals, and close the
 * window mid-conversation. A stale session or a graph-choice id is a lookup
 * miss, not a reason to end the conversation.
 *
 * These cases pin the repaired behavior: the window stays mounted, the failure
 * is readable inside it, and no session mutation, outcome callback or AI call
 * is made for a topic that never resolved.
 *
 * Called by: focused Vitest runs for the dialogue robustness packet (W13-B).
 * Depends on: DialogueInterface.tsx, services/dialogueService.ts.
 */

vi.mock('../../../services/dialogueService', () => ({
    getAvailableTopics: () => [
        { id: 'topic-stale', label: 'Ask about the old bridge' },
    ],
    processTopicSelection: (topicId: string) => {
        throw new Error(`Topic ${topicId} not found`);
    },
}));

const session: DialogueSession = {
    npcId: 'npc-grizelda',
    discussedTopicIds: [],
} as unknown as DialogueSession;

const npc: NPC = {
    id: 'npc-grizelda',
    name: 'Grizelda',
    baseDescription: 'A weathered scout.',
} as unknown as NPC;

const playerCharacter: PlayerCharacter = {
    id: 'player',
    abilityScores: { Charisma: 10 },
} as unknown as PlayerCharacter;

const gameState: GameState = {
    lastNpcResponse: '',
    npcMemory: { 'npc-grizelda': { disposition: 5 } },
} as unknown as GameState;

const makeProps = () => ({
    isOpen: true,
    session,
    gameState,
    npc,
    playerCharacter,
    onClose: vi.fn(),
    onUpdateSession: vi.fn(),
    onTopicOutcome: vi.fn(),
    onGenerateResponse: vi.fn().mockResolvedValue('response'),
});

describe('DialogueInterface - an unknown topic id keeps the window mounted', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps the conversation view rendered after the lookup throws', async () => {
        const props = makeProps();
        render(<DialogueInterface {...props} />);

        fireEvent.click(screen.getByText('Ask about the old bridge'));

        await waitFor(() => {
            expect(screen.getByTestId('dialogue-conversation-view')).toBeInTheDocument();
        });
        expect(screen.getByTestId('dialogue-end-conversation')).toBeInTheDocument();
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it('shows a readable failure message naming the unresolved topic', async () => {
        render(<DialogueInterface {...makeProps()} />);

        fireEvent.click(screen.getByText('Ask about the old bridge'));

        await waitFor(() => {
            expect(
                screen.getByText('(That subject leads nowhere: Topic topic-stale not found)'),
            ).toBeInTheDocument();
        });
    });

    it('leaves the session, the outcome callback and the AI reply untouched', async () => {
        const props = makeProps();
        render(<DialogueInterface {...props} />);

        fireEvent.click(screen.getByText('Ask about the old bridge'));

        await waitFor(() => {
            expect(
                screen.getByText('(That subject leads nowhere: Topic topic-stale not found)'),
            ).toBeInTheDocument();
        });
        expect(props.onUpdateSession).not.toHaveBeenCalled();
        expect(props.onTopicOutcome).not.toHaveBeenCalled();
        expect(props.onGenerateResponse).not.toHaveBeenCalled();
    });

    it('clears the thinking state so the topic buttons stay clickable', async () => {
        render(<DialogueInterface {...makeProps()} />);

        const topicButton = screen.getByText('Ask about the old bridge').closest('button');
        fireEvent.click(topicButton as HTMLButtonElement);

        await waitFor(() => {
            expect(topicButton).not.toBeDisabled();
        });
    });
});
