/**
 * This file proves turn-order enemy cards open the shared monster information panel.
 *
 * It covers the current enemy shown in the browser comment, a later enemy that
 * still supports Shift+click turn skipping, panel closure, and the unchanged
 * ally-selection path. This protects both Tactical Sandbox and real combat
 * because they mount the same InitiativeTracker component.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import { InitiativeTracker } from '../InitiativeTracker';

vi.mock('../CombatCharacterInspector', () => ({
  CombatCharacterInspector: ({
    character,
    onClose,
  }: {
    character: { name: string };
    onClose: () => void;
  }) => (
    <section role="dialog" aria-label={`Monster Info · ${character.name}`}>
      <span>{character.name} details</span>
      {/* A native input keeps this mock intentionally tiny while exposing the
          same accessible close action that WindowFrame provides in production. */}
      <input type="button" value="Close monster info" onClick={onClose} />
    </section>
  ),
}));

// ============================================================================
// Shared Turn Fixture
// ============================================================================
// One enemy owns the current turn, another is later in the queue, and an ally
// proves the existing character-selection path remains available.
// ============================================================================

const currentEnemy = createMockCombatCharacter({
  id: 'escape-target',
  name: 'Escape Target',
  team: 'enemy',
});
const laterEnemy = createMockCombatCharacter({
  id: 'grappler',
  name: 'Grappler',
  team: 'enemy',
});
const ally = createMockCombatCharacter({
  id: 'player-ranger',
  name: 'Player Ranger',
  team: 'player',
});

const turnState = {
  currentTurn: 1,
  turnOrder: [currentEnemy.id, laterEnemy.id, ally.id],
  currentCharacterId: currentEnemy.id,
  phase: 'planning' as const,
  actionsThisTurn: [],
};

describe('InitiativeTracker monster inspection', () => {
  it('opens and closes monster info from the current enemy turn card', () => {
    render(<InitiativeTracker characters={[currentEnemy, laterEnemy, ally]} turnState={turnState} />);

    fireEvent.click(screen.getByRole('button', {
      name: /escape target, turn 1, click for monster info/i,
    }));

    expect(screen.getByRole('dialog', { name: 'Monster Info · Escape Target' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close monster info/i }));
    expect(screen.queryByRole('dialog', { name: 'Monster Info · Escape Target' })).not.toBeInTheDocument();
  });

  it('opens a later enemy normally and preserves Shift+click turn skipping', () => {
    const onSkipToCharacter = vi.fn();
    render(
      <InitiativeTracker
        characters={[currentEnemy, laterEnemy, ally]}
        turnState={turnState}
        onSkipToCharacter={onSkipToCharacter}
      />,
    );

    const laterEnemyButton = screen.getByRole('button', {
      name: /grappler, turn 2, click for monster info, shift plus click to skip here/i,
    });
    fireEvent.click(laterEnemyButton);
    expect(screen.getByRole('dialog', { name: 'Monster Info · Grappler' })).toBeInTheDocument();
    expect(onSkipToCharacter).not.toHaveBeenCalled();

    fireEvent.click(laterEnemyButton, { shiftKey: true });
    expect(onSkipToCharacter).toHaveBeenCalledWith(laterEnemy.id);
  });

  it('retains ally selection when no turn skip is available', () => {
    const onCharacterSelect = vi.fn();
    const allyTurnState = { ...turnState, currentCharacterId: ally.id };
    render(
      <InitiativeTracker
        characters={[currentEnemy, laterEnemy, ally]}
        turnState={allyTurnState}
        onCharacterSelect={onCharacterSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /player ranger, turn 3/i }));
    expect(onCharacterSelect).toHaveBeenCalledWith(ally.id);
  });

  it('shows completed, active, and waiting members from production group state', () => {
    const groupedTurnState = {
      ...turnState,
      currentCharacterId: laterEnemy.id,
      turnGroups: [
        { id: 'initiative-group:escape-target', initiative: 15, memberIds: [currentEnemy.id, laterEnemy.id] },
        { id: 'initiative-group:player-ranger', initiative: 11, memberIds: [ally.id] },
      ],
      activeGroup: {
        groupId: 'initiative-group:escape-target',
        memberIds: [currentEnemy.id, laterEnemy.id],
        activeMemberId: laterEnemy.id,
        completedMemberIds: [currentEnemy.id],
        actionOwnership: 'member' as const,
        movementOwnership: 'member' as const,
        reactionOwnership: 'member' as const,
        effectTiming: 'member_start_and_end' as const,
      },
    };

    render(
      <InitiativeTracker
        characters={[currentEnemy, laterEnemy, ally]}
        turnState={groupedTurnState}
      />,
    );

    expect(screen.getByText('Member done')).toBeInTheDocument();
    expect(screen.getByText('Active member')).toBeInTheDocument();
    expect(screen.queryByText('Group waiting')).not.toBeInTheDocument();
  });
});
