import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Glossary from '../Glossary';
import GlossaryContext from '../../../context/GlossaryContext';
import { GlossaryEntry } from '../../../types';
import type { GateResult } from '../spellGateChecker/useSpellGateChecks';
import { fetchWithTimeout } from '../../../utils/networkUtils';

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

// The glossary shell still owns the hook integration, but the detailed bucket
// rendering now lives in SpellGateChecksPanel.test.tsx beside the dedicated module.
vi.mock('../spellGateChecker/useSpellGateChecks', () => ({
  useSpellGateChecks: () => mockGateHookReturn,
}));
vi.mock('../../../hooks/useSpellGateChecks', () => ({
  useSpellGateChecks: () => mockGateHookReturn,
}));

vi.mock('../../../utils/networkUtils', () => ({
  fetchWithTimeout: vi.fn().mockImplementation(() => Promise.resolve({})),
}));

const fetchWithTimeoutMock = vi.mocked(fetchWithTimeout);

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
  const mergedProps = { isOpen: true, onClose, isDevModeEnabled: false, ...props };
  return render(
    <GlossaryContext.Provider value={providedEntries}>
      <Glossary {...mergedProps} />
    </GlossaryContext.Provider>
  );
};

describe('Glossary', () => {
  beforeEach(() => {
    mockGateHookReturn = { results: {}, recheck: vi.fn(), isLoading: false };
    vi.clearAllMocks();
    fetchWithTimeoutMock.mockResolvedValue({});
  });

  it('renders categories, selects the first entry, and allows selecting another', async () => {
    renderGlossary({ isDevModeEnabled: true });

    expect(screen.getByText('Game Glossary')).toBeInTheDocument();
    expect(screen.getByText('Alpha (1)')).toBeInTheDocument();
    expect(screen.getByText('Beta (2)')).toBeInTheDocument();
    expect(screen.getByTestId('full-entry')).toHaveTextContent('Entry A');

    fireEvent.click(screen.getByText('Beta (2)'));
    fireEvent.click(screen.getByText('Entry B'));

    await waitFor(() => {
      expect(screen.getByTestId('full-entry')).toHaveTextContent('Entry B');
    });
  });

  it('filters entries by search term and shows empty state when no match', () => {
    renderGlossary({ isDevModeEnabled: true });

    fireEvent.click(screen.getByText(/Search/));
    fireEvent.change(screen.getByLabelText('Search glossary terms'), { target: { value: 'zzzz' } });

    expect(screen.getByText('No terms match your search.')).toBeInTheDocument();
  });

  it('invokes onClose via Escape key and close button', () => {
    const onClose = vi.fn();
    renderGlossary({ onClose });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();

    const closeButtons = screen.getAllByLabelText('Close');
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing when closed', () => {
    const { container } = renderGlossary({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it('navigates to see-also targets and expands nested parents', () => {
    renderGlossary();

    fireEvent.click(screen.getByText('See entry-b-1'));

    expect(screen.getAllByText('Entry B Child').length).toBeGreaterThan(0);
  });

  it('shows gap status messaging for spell entries', async () => {
    mockGateHookReturn = {
      ...mockGateHookReturn,
      results: {
        'spell-entry': {
          status: 'gap',
          reasons: ['Known schema gap'],
          issueSummaries: ['Known behavior gaps: targeting-gap.'],
          level: 1,
          checklist: { manifestPathOk: true, spellJsonExists: true, spellJsonValid: true, noKnownGaps: false },
        },
      },
    };
    renderGlossary({ isDevModeEnabled: true });

    fireEvent.click(screen.getByRole('button', { name: /show spell gate checks/i }));
    fireEvent.click(screen.getByText('Spells (1)'));
    fireEvent.click(screen.getByText('Spell Entry'));

    expect(screen.getByText(/Marked as a gap/)).toBeInTheDocument();
    await waitFor(() => {});
  });

  it('keeps spell gate diagnostics hidden until the glossary-local toggle is enabled', () => {
    mockGateHookReturn = {
      ...mockGateHookReturn,
      results: {
        'spell-entry': {
          status: 'fail',
          reasons: ['Spell JSON not found'],
          issueSummaries: ['Spell JSON could not be loaded for this glossary entry.'],
          level: 3,
          checklist: { manifestPathOk: true, spellJsonExists: false, spellJsonValid: false, noKnownGaps: true },
        },
      },
    };
    renderGlossary({ isDevModeEnabled: true });

    fireEvent.click(screen.getByText('Spells (1)'));
    fireEvent.click(screen.getByText('Spell Entry'));

    expect(screen.queryByText(/Spell Gate Checks/)).not.toBeInTheDocument();
    expect(screen.queryByTitle('Spell JSON not found')).not.toBeInTheDocument();
  });

  it('requests a dev-only glossary index rebuild when the glossary opens in dev mode', async () => {
    renderGlossary({ isDevModeEnabled: true });

    await waitFor(() => {
      expect(fetchWithTimeoutMock).toHaveBeenCalledWith('/api/glossary/rebuild-index', expect.any(Object));
    });
  });

  it('uses the visible refresh button to re-check spells and request a glossary index rebuild in dev mode', async () => {
    const recheck = vi.fn();
    mockGateHookReturn = { results: {}, recheck, isLoading: false };
    renderGlossary({ isDevModeEnabled: true });

    const baselineCallCount = fetchWithTimeoutMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /re-check spells/i }));

    expect(recheck).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(fetchWithTimeoutMock.mock.calls.length).toBeGreaterThan(baselineCallCount);
    });
  });

  it('does not request a glossary index rebuild when dev mode is disabled', async () => {
    renderGlossary({ isDevModeEnabled: false });

    await waitFor(() => {});
    expect(fetchWithTimeoutMock).not.toHaveBeenCalledWith('/api/glossary/rebuild-index', expect.any(Object));
  });
});
