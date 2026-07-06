import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { DialogueInterface } from '../DialogueInterface';
import type { DialogueSession } from '../../../types/dialogue';
import type { GameState, NPC, PlayerCharacter } from '../../../types';

/**
 * Guards the "Invite to party" affordance in the dialogue UI.
 *
 * The button must ALWAYS render when `onInvite` is wired (the consent gate
 * declines ineligible NPCs downstream — the button is not hidden), and clicking
 * it must call back with the NPC id so the hook can dispatch talk+recruitOffer.
 *
 * dialogueService is mocked so topic computation stays deterministic and the
 * test exercises only the Player Choices render path.
 *
 * Called by: focused Vitest runs for the dialogue-invite packet (W2).
 * Depends on: DialogueInterface.tsx.
 */

vi.mock('../../../services/dialogueService', () => ({
    getAvailableTopics: () => [
        { id: 'topic-weather', label: 'Talk about the weather' },
    ],
    processTopicSelection: () => ({ status: 'neutral', responsePrompt: 'ok' }),
}));

const session: DialogueSession = {
    npcId: 'npc-grizelda',
    discussedTopicIds: [],
    availableTopicIds: [],
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

const baseProps = {
    isOpen: true,
    session,
    gameState,
    npc,
    playerCharacter,
    onClose: vi.fn(),
    onUpdateSession: vi.fn(),
    onTopicOutcome: vi.fn(),
    onGenerateResponse: vi.fn().mockResolvedValue('response'),
};

describe('DialogueInterface - Invite to party', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the Invite to party button when onInvite is provided', () => {
        render(<DialogueInterface {...baseProps} onInvite={vi.fn()} />);
        expect(screen.getByTestId('dialogue-invite-to-party')).toBeInTheDocument();
        expect(screen.getByTestId('dialogue-end-conversation')).toBeInTheDocument();
    });

    it('calls onInvite with the NPC id when clicked', () => {
        const onInvite = vi.fn();
        render(<DialogueInterface {...baseProps} onInvite={onInvite} />);

        fireEvent.click(screen.getByTestId('dialogue-invite-to-party'));

        expect(onInvite).toHaveBeenCalledTimes(1);
        expect(onInvite).toHaveBeenCalledWith('npc-grizelda');
    });

    it('does not render the button when onInvite is omitted', () => {
        render(<DialogueInterface {...baseProps} />);
        expect(screen.queryByTestId('dialogue-invite-to-party')).not.toBeInTheDocument();
    });
});
