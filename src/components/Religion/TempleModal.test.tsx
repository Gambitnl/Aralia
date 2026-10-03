/**
 * This test file proves the temple header draws the deity it is actually
 * standing in front of.
 *
 * Before agora-1b88 the header rendered one hardcoded sun emoji for every god,
 * so a player in Lolth's shrine saw Pelor's mark. These tests pin the two halves
 * of the fix: the glyph table covers every authored deity, and the rendered
 * header carries that deity's own glyph plus its authored symbol prose.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Temple } from '../../types/religion';
import { DEITIES } from '../../data/deities';
import TempleModal, { DEITY_SYMBOL_GLYPHS, getDeitySymbolGlyph } from './TempleModal';

// ============================================================================
// Frame, Animation, and State Test Doubles
// ============================================================================
// The test cares about the deity symbol, not window chrome, animation timing, or
// the live reducer. These doubles keep the header stable in jsdom.
// ============================================================================

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentPropsWithoutRef<'div'>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('../ui/WindowFrame', () => ({
  WindowFrame: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section aria-label={title} data-testid="window-temple-modal">
      {children}
    </section>
  ),
}));

vi.mock('../../state/GameContext', () => ({
  useGameState: () => ({ state: { religion: { divineFavor: {} }, divineFavor: {} } }),
}));

const lolthTemple: Temple = {
  id: 'temple-lolth-test',
  deityId: 'lolth',
  name: 'The Weaver\'s Descent',
  description: 'A web-strung shrine beneath the city.',
  services: [],
};

describe('DEITY_SYMBOL_GLYPHS', () => {
  it('covers every deity authored in DEITIES', () => {
    const missing = DEITIES.filter(d => !DEITY_SYMBOL_GLYPHS[d.id]).map(d => d.id);
    expect(missing).toEqual([]);
  });

  it('gives each deity its own mark rather than one shared placeholder', () => {
    const glyphs = DEITIES.map(d => DEITY_SYMBOL_GLYPHS[d.id]);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
});

describe('getDeitySymbolGlyph', () => {
  it('returns the authored glyph for a known deity', () => {
    expect(getDeitySymbolGlyph('lolth', 'Lolth')).toBe(DEITY_SYMBOL_GLYPHS.lolth);
  });

  it('derives an initial from the deity itself when no glyph is authored yet', () => {
    // A deity added to DEITIES without a glyph entry must never borrow another
    // god's mark; it falls back to its own initial.
    expect(getDeitySymbolGlyph('unmapped_new_god', 'Nerull')).toBe('N');
  });
});

describe('TempleModal header', () => {
  it('renders the temple deity\'s own symbol and authored symbol prose', () => {
    render(
      <TempleModal
        isOpen
        temple={lolthTemple}
        playerGold={100}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />
    );

    const lolth = DEITIES.find(d => d.id === 'lolth');
    expect(lolth).toBeDefined();

    const symbol = screen.getByRole('img', { name: `Holy symbol of Lolth: ${lolth!.symbol}` });
    expect(symbol).toHaveTextContent(DEITY_SYMBOL_GLYPHS.lolth);
    expect(symbol).toHaveAttribute('data-deity-id', 'lolth');
    expect(screen.getByText(`Holy symbol: ${lolth!.symbol}`)).toBeInTheDocument();

    // The old hardcoded sun belonged to Pelor, not to this temple.
    expect(symbol).not.toHaveTextContent(DEITY_SYMBOL_GLYPHS.pelor);
  });
});
