import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Glossary from '../Glossary';
import GlossaryContext from '../../../context/GlossaryContext';
import { GlossaryEntry } from '../../../types';
import type { GateResult } from '../../../hooks/useSpellGateChecks';

// Prevent errors from scrollIntoView in JSDOM
window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('../FullEntryDisplay', () => ({
  FullEntryDisplay: ({ entry, onNavigate }: { entry: GlossaryEntry | null; onNavigate?: (id: string) => void }) => (
    <div data-testid="full-entry">
      {entry?.title}
      {entry?.seeAlso?.map((id) => (
        <button key={id} onClick={() => onNavigate?.(id)}>
          See {id}
        </button>
      ))}
    </div>
  ),
}));

let mockGateHookReturn: { results: Record<string, GateResult>; recheck: () => void; isLoading: boolean } = {
  results: {},
  recheck: vi.fn(),
  isLoading: false,
};
vi.mock('../../../hooks/useSpellGateChecks', () => ({
  useSpellGateChecks: () => mockGateHookReturn,
}));

const entries: GlossaryEntry[] = [
  { id: 'entry-a', title: 'Entry A', category: 'Alpha', filePath: '/alpha.md', seeAlso: ['entry-b-1'] },
  {
    id: 'entry-b',
    title: 'Entry B',
    category: 'Beta',
    filePath: '/beta.md',
    subEntries: [{ id: 'entry-b-1', title: 'Entry B Child', category: 'Beta', filePath: '/beta/child.md' }],
  },
  { id: 'spell-entry', title: 'Spell Entry', category: 'Spells', filePath: '/spells/spell-entry.md' },
];

const renderGlossary = (props?: Partial<React.ComponentProps<typeof Glossary>>, providedEntries = entries) => {
  const onClose = props?.onClose ?? vi.fn();
  const mergedProps = { isOpen: true, onClose, ...props };
  return render(
    <GlossaryContext.Provider value={providedEntries}>
      <Glossary {...mergedProps} />
    </GlossaryContext.Provider>
  );
};

describe('Glossary', () => {
  beforeEach(() => {
    mockGateHookReturn = { results: {}, recheck: vi.fn(), isLoading: false };
  });

  it('renders categories, selects the first entry, and allows selecting another', () => {
    renderGlossary();

    expect(screen.getByText('Game Glossary')).toBeInTheDocument();
    expect(screen.getByText('Alpha (1)')).toBeInTheDocument();
    expect(screen.getByText('Beta (1)')).toBeInTheDocument();

    expect(screen.getByTestId('full-entry')).toHaveTextContent('Entry A');

    fireEvent.click(screen.getByText('Beta (1)'));
    fireEvent.click(screen.getByText('Entry B'));
    expect(screen.getByTestId('full-entry')).toHaveTextContent('Entry B');
  });

  it('filters entries by search term and shows empty state when no match', () => {
    renderGlossary();

    fireEvent.change(screen.getByLabelText('Search glossary terms'), { target: { value: 'zzzz' } });
    expect(screen.getByText('No terms match your search.')).toBeInTheDocument();
  });

  it('invokes onClose via Escape key and close button', () => {
    const onClose = vi.fn();
    renderGlossary({ onClose });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();

    const closeButtons = screen.getAllByLabelText('Close glossary');
    fireEvent.click(closeButtons[0]);
    fireEvent.click(closeButtons[1]);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('renders nothing when closed', () => {
    const { container } = renderGlossary({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it('shows spell gate indicators and checklist for spell entries', () => {
    mockGateHookReturn = {
      ...mockGateHookReturn,
      results: {
        'spell-entry': {
        status: 'fail',
        reasons: ['Spell JSON not found'],
        level: 3,
        checklist: { manifestPathOk: true, spellJsonExists: false, spellJsonValid: false, knownGap: false },
        },
      },
    };
    renderGlossary();

    fireEvent.click(screen.getByText('Spells (1)'));
    fireEvent.click(screen.getByText('Spell Entry'));

    expect(screen.getAllByTitle('Spell JSON not found').length).toBeGreaterThan(0);
    expect(screen.getByText(/Spell Gate Checks/)).toBeInTheDocument();
    expect(screen.getByText(/Spell JSON not found/)).toBeInTheDocument();
  });

  it('navigates to see-also targets and expands nested parents', () => {
    renderGlossary();

    // From Entry A, click the see-also link to the Beta child
    fireEvent.click(screen.getByText('See entry-b-1'));

    // Beta category should be expanded and child visible/selected
    expect(screen.getAllByText('Entry B Child').length).toBeGreaterThan(0);
  });

  it('shows gap status messaging for spell entries', () => {
    mockGateHookReturn = {
      ...mockGateHookReturn,
      results: {
        'spell-entry': {
        status: 'gap',
        reasons: ['Known schema gap'],
        level: 1,
        checklist: { manifestPathOk: true, spellJsonExists: true, spellJsonValid: true, knownGap: true },
        },
      },
    };
    renderGlossary();

    fireEvent.click(screen.getByText('Spells (1)'));
    fireEvent.click(screen.getByText('Spell Entry'));

    expect(screen.getByText(/Marked as a gap/)).toBeInTheDocument();
  });
});
