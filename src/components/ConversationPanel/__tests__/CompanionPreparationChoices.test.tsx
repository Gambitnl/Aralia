import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompanionPreparationChoices } from '../CompanionPreparationChoices';
import { createMockGameState } from '@/utils/core';
import { COMPANIONS } from '@/data/companions';

const state = () => createMockGameState({
  companions: { elara_vance: COMPANIONS.elara_vance }, metNpcIds: ['elara_vance'], currentLocationActiveDynamicNpcIds: ['elara_vance'],
  activeConversation: { id: 'elara-talk', participants: ['elara_vance'], messages: [], startedAt: 1, isPlayerTurn: true, pendingResponse: false },
});
describe('authored companion preparation controls', () => {
  it('submits an explicit authored choice without free-text intent or an automatic gift', () => {
    const dispatch = vi.fn();
    render(<CompanionPreparationChoices state={state()} dispatch={dispatch} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask how her preparations are going' }));
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ type: 'COMPANION_PREPARATION_CHOICE', payload: { companionId: 'elara_vance', choice: 'ask' } });
  });
  it('locks authored choices while the existing conversation is resolving an action', () => {
    render(<CompanionPreparationChoices state={state()} dispatch={vi.fn()} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
