/**
 * @file src/components/Dialogue/__tests__/DialogueInterfaceGraph.test.tsx
 * Guards scripted-graph mode in the dialogue window (DIAL-001).
 *
 * Three things must hold: a linear authored run renders through to its first
 * branch, picking a choice walks the graph and reports the node's effects
 * WITHOUT the component applying them, and a graph supplied by id goes through
 * `loadDialogueGraph`. The last one is the actual "wired the loader in" claim.
 *
 * dialogueService is mocked so the topic pool contributes nothing and any
 * button on screen came from the graph.
 *
 * Called by: focused Vitest runs for agora-676a.
 * Depends on: DialogueInterface.tsx, dialogueGraphLoader.ts.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { DialogueInterface } from '../DialogueInterface';
import type { DialogueSession } from '../../../types/dialogue';
import type { GameState, NPC, PlayerCharacter } from '../../../types';
import type { DialogueGraph } from '../../../systems/dialogue/dialogueGraphTypes';

vi.mock('../../../services/dialogueService', () => ({
    getAvailableTopics: () => [],
    processTopicSelection: () => ({ status: 'neutral', responsePrompt: 'ok' }),
}));

const loadDialogueGraphMock = vi.hoisted(() => vi.fn());
vi.mock('../../../systems/dialogue/dialogueGraphLoader', () => ({
    loadDialogueGraph: loadDialogueGraphMock,
}));

const graph: DialogueGraph = {
    id: 'test-quest-giver',
    startNodeId: 'greeting',
    nodes: {
        greeting: { id: 'greeting', speaker: 'npc', text: 'You are not from the valley.', next: 'pitch' },
        pitch: {
            id: 'pitch',
            speaker: 'npc',
            text: 'Something is taking lambs from the high pasture.',
            choices: [
                { text: "I'll take the job.", nextNodeId: 'accept' },
                { text: 'Find someone else.', nextNodeId: 'decline' },
                {
                    text: 'The seneschal sent me.',
                    nextNodeId: 'accept',
                    condition: { type: 'unlock_flag', params: { flag: 'has_writ' } },
                },
            ],
        },
        accept: {
            id: 'accept',
            speaker: 'npc',
            text: 'Then it is yours.',
            effects: [
                { type: 'start_quest', params: { questId: 'quest_pasture_predator' } },
                { type: 'update_disposition', params: { delta: 10 } },
            ],
        },
        decline: { id: 'decline', speaker: 'npc', text: 'Then the lambs keep going.' },
    },
};

const session = { npcId: 'npc-shepherd', discussedTopicIds: [] } as unknown as DialogueSession;
const npc = { id: 'npc-shepherd', name: 'Aldric', baseDescription: 'A weathered shepherd.' } as unknown as NPC;
const playerCharacter = { id: 'player', abilityScores: { Charisma: 10 } } as unknown as PlayerCharacter;
const gameState = {
    lastNpcResponse: '',
    npcMemory: { 'npc-shepherd': { disposition: 5 } },
} as unknown as GameState;

const baseProps = {
    isOpen: true,
    session,
    gameState,
    npc,
    playerCharacter,
    onClose: vi.fn(),
    onUpdateSession: vi.fn(),
    onGenerateResponse: vi.fn().mockResolvedValue('unused in graph mode'),
};

describe('DialogueInterface - scripted graph mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('plays the opening linear run and shows only the reachable choices', () => {
        render(<DialogueInterface {...baseProps} dialogueGraph={graph} />);

        // `greeting` has an unconditional `next`, so playback lands on `pitch`.
        expect(screen.getByText('Something is taking lambs from the high pasture.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: "I'll take the job." })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Find someone else.' })).toBeInTheDocument();
        // The flag is unset, so the gated line is hidden rather than disabled.
        expect(screen.queryByRole('button', { name: 'The seneschal sent me.' })).toBeNull();
    });

    it('shows a gated choice once its flag is present in the graph context', () => {
        render(
            <DialogueInterface
                {...baseProps}
                dialogueGraph={graph}
                graphContext={{ flags: { has_writ: true } }}
            />,
        );
        expect(screen.getByRole('button', { name: 'The seneschal sent me.' })).toBeInTheDocument();
    });

    it('walks to the chosen node and reports its effects without applying them', () => {
        const onGraphEffects = vi.fn();
        render(
            <DialogueInterface {...baseProps} dialogueGraph={graph} onGraphEffects={onGraphEffects} />,
        );

        fireEvent.click(screen.getByRole('button', { name: "I'll take the job." }));

        expect(screen.getByText('Then it is yours.')).toBeInTheDocument();
        expect(onGraphEffects).toHaveBeenCalledTimes(1);
        const outcomes = onGraphEffects.mock.calls[0][0];
        expect(outcomes.map((o: { type: string }) => o.type)).toEqual([
            'start_quest',
            'update_disposition',
        ]);
        // Reported, not applied: nothing wrote to the game state we passed in.
        expect(gameState.npcMemory['npc-shepherd'].disposition).toBe(5);
    });

    it('loads a graph through the loader when given only an id', async () => {
        loadDialogueGraphMock.mockResolvedValue(graph);

        render(<DialogueInterface {...baseProps} dialogueGraphId="quest-giver" />);

        expect(loadDialogueGraphMock).toHaveBeenCalledWith('quest-giver');
        await waitFor(() =>
            expect(
                screen.getByText('Something is taking lambs from the high pasture.'),
            ).toBeInTheDocument(),
        );
    });

    it('surfaces a loader failure instead of showing an empty window', async () => {
        loadDialogueGraphMock.mockRejectedValue(new Error('graph "broken" is invalid'));

        render(<DialogueInterface {...baseProps} dialogueGraphId="broken" />);

        await waitFor(() =>
            expect(screen.getByText(/Dialogue unavailable: graph "broken" is invalid/)).toBeInTheDocument(),
        );
    });
});
