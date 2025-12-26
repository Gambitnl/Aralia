import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DialogueInterface } from './DialogueInterface';
import { DialogueSession, ProcessTopicResult } from '../../types/dialogue';
import { GameState, NPC, PlayerCharacter } from '../../types';

// Mock dialogueService methods
vi.mock('../../services/dialogueService', () => ({
    getAvailableTopics: () => [
        { id: 'topic1', label: 'Ask about Logic', category: 'lore', playerPrompt: 'Tell me logic' },
        { id: 'topic2', label: 'Ask about Magic', category: 'lore', playerPrompt: 'Tell me magic', skillCheck: { skill: 'Arcana', dc: 15 } }
    ],
    processTopicSelection: (id: string) => {
        if (id === 'topic2') {
             return { status: 'failure', responsePrompt: 'You fail to understand.', unlocks: [], dispositionChange: -5 } as ProcessTopicResult;
        }
        return { status: 'neutral', responsePrompt: 'Logic is cool.', unlocks: ['unlocked_topic'] } as ProcessTopicResult;
    }
}));

describe('DialogueInterface', () => {
    const mockSession: DialogueSession = {
        npcId: 'npc1',
        availableTopicIds: ['topic1', 'topic2'],
        discussedTopicIds: [],
        sessionDispositionMod: 0
    };

    const mockGameState = {
        npcMemory: { 'npc1': { disposition: 10 } },
        lastNpcResponse: null
    } as unknown as GameState;

    const mockNPC = {
        id: 'npc1',
        name: 'Test NPC',
        baseDescription: 'A test npc'
    } as unknown as NPC;

    const mockPC = {
        stats: { charisma: 14 }
    } as unknown as PlayerCharacter;

    const mockHandlers = {
        onClose: vi.fn(),
        onUpdateSession: vi.fn(),
        onUpdateGameState: vi.fn(),
        onGenerateResponse: vi.fn().mockResolvedValue("AI Response Text"),
        onApplyTopicResult: vi.fn()
    };

    it('renders correctly', () => {
        render(
            <DialogueInterface
                isOpen={true}
                session={mockSession}
                gameState={mockGameState}
                npc={mockNPC}
                playerCharacter={mockPC}
                {...mockHandlers}
            />
        );

        expect(screen.getByText('Test NPC')).toBeTruthy();
        expect(screen.getByText('Ask about Logic')).toBeTruthy();
    });

    it('handles topic selection and triggers callbacks', async () => {
        render(
            <DialogueInterface
                isOpen={true}
                session={mockSession}
                gameState={mockGameState}
                npc={mockNPC}
                playerCharacter={mockPC}
                {...mockHandlers}
            />
        );

        fireEvent.click(screen.getByText('Ask about Logic'));

        await waitFor(() => {
            expect(mockHandlers.onGenerateResponse).toHaveBeenCalledWith('Logic is cool.');
            expect(mockHandlers.onApplyTopicResult).toHaveBeenCalled();
        });

        // Verify result passed to onApplyTopicResult
        const callArgs = mockHandlers.onApplyTopicResult.mock.calls[0];
        expect(callArgs[0]).toEqual(expect.objectContaining({ status: 'neutral', unlocks: ['unlocked_topic'] }));
        expect(callArgs[1]).toBe('npc1');
    });
});
