import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ActionPane from '../ActionPane';
import { Action, Item, Location, NPC } from '../../types';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    button: React.forwardRef(({ whileHover, whileTap, layout, initial, animate, exit, transition, ...props }: any, ref) => (
      <button ref={ref} {...props} />
    )),
    div: React.forwardRef(({ initial, animate, exit, transition, ...props }: any, ref) => <div ref={ref} {...props} />),
  },
}));

describe('ActionPane', () => {
  const baseLocation: Location = {
    id: 'town_square',
    name: 'Town Square',
    baseDescription: 'A busy hub',
    exits: { Market: 'market_1', North: 'coord_north' },
    mapCoordinates: { x: 0, y: 0 },
    biomeId: 'plains',
  };

  const npcsInLocation: NPC[] = [
    { id: 'npc-1', name: 'Ava', baseDescription: '', initialPersonalityPrompt: '', role: 'civilian' },
  ];

  const itemsInLocation: Item[] = [
    { id: 'item-1', name: 'Ancient Coin', description: '', type: 'treasure' },
  ];

  const defaultProps = {
    currentLocation: baseLocation,
    npcsInLocation,
    itemsInLocation,
    onAction: vi.fn(),
    disabled: false,
    geminiGeneratedActions: null as Action[] | null,
    isDevDummyActive: false,
    unreadDiscoveryCount: 0,
    hasNewRateLimitError: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders context-aware actions for NPCs, items, and named exits', () => {
    render(<ActionPane {...defaultProps} />);

    expect(screen.getByText('Talk to Ava')).toBeInTheDocument();
    expect(screen.getByText('Take Ancient Coin')).toBeInTheDocument();
    expect(screen.getByText('Go Market')).toBeInTheDocument();
    expect(screen.queryByText('Go North')).not.toBeInTheDocument();
  });

  it('invokes onAction when an action button is clicked', () => {
    render(<ActionPane {...defaultProps} />);

    fireEvent.click(screen.getByText('Talk to Ava'));
    expect(defaultProps.onAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'talk', targetId: 'npc-1' })
    );
  });

  it('submits oracle queries with the provided text', () => {
    render(<ActionPane {...defaultProps} />);

    fireEvent.click(screen.getByText('Ask the Oracle'));
    fireEvent.change(screen.getByPlaceholderText('Ask your question...'), { target: { value: 'What now?' } });
    fireEvent.click(screen.getByText('Submit'));

    expect(defaultProps.onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ask_oracle',
        payload: expect.objectContaining({ query: 'What now?' }),
      })
    );
  });

  it('disables interaction when disabled is true', () => {
    const onAction = vi.fn();
    render(<ActionPane {...defaultProps} disabled={true} onAction={onAction} />);

    fireEvent.click(screen.getByText('Survey Surroundings'));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('converts non-string move targetIds when invoking onAction', () => {
    const onAction = vi.fn();
    const geminiActions: Action[] = [{ type: 'move', label: 'Move to point', targetId: 123 as any }];
    render(<ActionPane {...defaultProps} geminiGeneratedActions={geminiActions} onAction={onAction} />);

    fireEvent.click(screen.getByText('Move to point'));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'move', targetId: '123' }));
  });

  it('opens the system menu, shows a badge for discoveries, and triggers system actions', () => {
    const onAction = vi.fn();
    render(
      <ActionPane
        {...defaultProps}
        unreadDiscoveryCount={7}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Discoveries')).toBeInTheDocument();
    expect(screen.getByText('Save Game')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Save Game'));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'save_game' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders Dev Menu when dev mode is active and rate limit notification is present', () => {
    render(
      <ActionPane
        {...defaultProps}
        isDevDummyActive={true}
        hasNewRateLimitError={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByText('Dev Menu')).toBeInTheDocument();
  });
});
