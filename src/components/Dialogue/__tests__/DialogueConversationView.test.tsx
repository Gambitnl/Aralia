/**
 * This file proves the shared dialogue body exposes the same visible controls
 * and callbacks to both the production modal and the Design Preview.
 *
 * The tests target the presentation contract rather than Tailwind details so
 * future visual refinements can preserve game behavior and preview parity.
 *
 * Runs with: focused Vitest through the repository test command
 * Depends on: DialogueConversationView and React Testing Library
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationTopic } from '../../../types/dialogue';
import { DialogueConversationView } from '../DialogueConversationView';

// ============================================================================
// Shared Topic Fixtures
// ============================================================================
// A deterministic topic is enough to prove the shared body forwards the same
// choice object the production controller supplied.
// ============================================================================
const topics: ConversationTopic[] = [
  {
    id: 'adventure',
    label: 'I am looking for adventure.',
    category: 'quest',
    playerPrompt: 'I am looking for adventure.',
  },
];

describe('DialogueConversationView', () => {
  it('renders NPC context, response, topics, recruitment, and exit controls', () => {
    render(
      <DialogueConversationView
        npcDescription="A watchful traveler in a weathered cloak."
        currentResponse="Greetings, traveler."
        isThinking={false}
        topics={topics}
        onTopicSelect={vi.fn()}
        onInvite={vi.fn()}
        onEndConversation={vi.fn()}
      />,
    );

    expect(screen.getByTestId('dialogue-conversation-view')).toBeInTheDocument();
    expect(screen.getByText('A watchful traveler in a weathered cloak.')).toBeInTheDocument();
    expect(screen.getByText('Greetings, traveler.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Topics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite to party' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End Conversation' })).toBeInTheDocument();
  });

  it('forwards topic, invite, and end actions to the owning controller', () => {
    const onTopicSelect = vi.fn();
    const onInvite = vi.fn();
    const onEndConversation = vi.fn();

    render(
      <DialogueConversationView
        npcDescription="A watchful traveler in a weathered cloak."
        currentResponse="Greetings, traveler."
        isThinking={false}
        topics={topics}
        onTopicSelect={onTopicSelect}
        onInvite={onInvite}
        onEndConversation={onEndConversation}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'I am looking for adventure.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Invite to party' }));
    fireEvent.click(screen.getByRole('button', { name: 'End Conversation' }));

    expect(onTopicSelect).toHaveBeenCalledWith(topics[0]);
    expect(onInvite).toHaveBeenCalledTimes(1);
    expect(onEndConversation).toHaveBeenCalledTimes(1);
  });
});
