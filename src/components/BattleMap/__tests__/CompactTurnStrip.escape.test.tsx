/**
 * @file CompactTurnStrip.escape.test.tsx — the UI half of edge-of-map escape (9B).
 *
 * The referee's verdict is proven in `battlefieldEscape.test.ts` and its
 * consequences in `useTurnManager.edgeEscape.test.ts`. This pins the last link:
 * the Escape command appears only when the parent says the actor can flee, and
 * clicking it asks the parent to resolve.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CompactTurnStrip from '../CompactTurnStrip';
import type { CombatCharacter } from '../../../types/combat';

const character = {
  id: 'hero',
  name: 'Hero',
  team: 'player',
  currentHP: 10,
  maxHP: 10,
  position: { x: 0, y: 5 },
  statusEffects: [],
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    legendary: { used: 0, total: 0 },
    movement: { used: 0, total: 30 },
    freeActions: 1,
  },
} as unknown as CombatCharacter;

describe('CompactTurnStrip escape command (9B)', () => {
  it('does not draw the Escape command when the referee refuses', () => {
    render(
      <CompactTurnStrip
        character={character}
        isCharactersTurn
        onEndTurn={vi.fn()}
        onRestoreCommands={vi.fn()}
        canEscape={false}
        onEscape={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('compact-turn-strip-escape')).toBeNull();
    // End Turn is untouched by the addition.
    expect(screen.getByRole('button', { name: /End Hero's turn/i })).toBeTruthy();
  });

  it('draws the Escape command at the battlefield edge and reports the click', () => {
    const onEscape = vi.fn();
    render(
      <CompactTurnStrip
        character={character}
        isCharactersTurn
        onEndTurn={vi.fn()}
        onRestoreCommands={vi.fn()}
        canEscape
        escapeReason="Hero is at the edge of the battlefield and can flee for their full movement."
        onEscape={onEscape}
      />,
    );

    const button = screen.getByTestId('compact-turn-strip-escape');
    expect(button.getAttribute('title')).toContain('edge of the battlefield');
    fireEvent.click(button);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('disables the Escape command when it is not this actor turn', () => {
    const onEscape = vi.fn();
    render(
      <CompactTurnStrip
        character={character}
        isCharactersTurn={false}
        onEndTurn={vi.fn()}
        onRestoreCommands={vi.fn()}
        canEscape
        onEscape={onEscape}
      />,
    );
    const button = screen.getByTestId('compact-turn-strip-escape') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('stays exactly as it was for callers that never wire escape', () => {
    render(
      <CompactTurnStrip
        character={character}
        isCharactersTurn
        onEndTurn={vi.fn()}
        onRestoreCommands={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('compact-turn-strip-escape')).toBeNull();
  });
});
