/**
 * Regression test for the new-player "empty Log void" gap.
 *
 * On a brand-new game the message log is empty for the seconds it takes the local
 * model to write the opening scene. WorldPane must fill that window with an honest
 * "the world is taking shape" placeholder (it invents no scene content), and must
 * NOT show it once messages exist or when no opening is generating.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll } from 'vitest';
import WorldPane from '../WorldPane';
import GlossaryContext from '../../context/GlossaryContext';
import type { GameMessage, GlossaryEntry } from '../../types';

// jsdom does not implement Element.scrollTo, which WorldPane's auto-scroll effect
// calls on mount/update. Stub it so rendering doesn't throw.
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  Element.prototype.scrollTo = Element.prototype.scrollTo || (() => {});
});

const msg = (text: string): GameMessage => ({
  id: `m-${text}`,
  text,
  sender: 'system',
  timestamp: Date.now(),
});

const glossaryEntries: GlossaryEntry[] = [
  {
    id: 'adventure',
    title: 'adventure',
    category: 'world',
    excerpt: 'A player-facing journey or expedition.',
  },
];

describe('WorldPane opening-situation placeholder', () => {
  it('shows the placeholder when the log is empty and the opening is generating', () => {
    render(<WorldPane messages={[]} openingStatus="generating" />);
    expect(screen.getByTestId('world-pane-opening-generating')).toBeInTheDocument();
    expect(screen.getByText(/taking shape around you/i)).toBeInTheDocument();
  });

  it('does NOT show the placeholder once narrative messages exist', () => {
    render(<WorldPane messages={[msg('You head North.')]} openingStatus="generating" />);
    expect(screen.queryByTestId('world-pane-opening-generating')).not.toBeInTheDocument();
  });

  it('does NOT show the placeholder when no opening is generating (e.g. dev/skip/load)', () => {
    render(<WorldPane messages={[]} openingStatus="idle" />);
    expect(screen.queryByTestId('world-pane-opening-generating')).not.toBeInTheDocument();
  });

  it('does NOT show the placeholder when status is undefined', () => {
    render(<WorldPane messages={[]} />);
    expect(screen.queryByTestId('world-pane-opening-generating')).not.toBeInTheDocument();
  });

  it('keeps inline glossary terms touch-sized inside log prose', () => {
    render(
      <GlossaryContext.Provider value={glossaryEntries}>
        <WorldPane messages={[msg('Your adventure begins.')]} />
      </GlossaryContext.Provider>
    );

    expect(screen.getByRole('button', { name: 'adventure' })).toHaveClass('min-h-11');
  });
});
