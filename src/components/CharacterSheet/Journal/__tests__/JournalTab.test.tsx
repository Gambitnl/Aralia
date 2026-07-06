/**
 * This file verifies the Character Sheet Journal tab wiring.
 *
 * The tests keep the tab focused on its contract with the sheet: quests must
 * reach the quest sidebar, journal entries must reach the spread, and the panes
 * must expose stable classes for the cramped responsive layout used in small
 * character-sheet windows.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JournalTab } from '../JournalTab';
import { QuestStatus, type Quest } from '../../../../types';
import { type JournalEntry, type JournalState } from '../../../../types/journal';

// ============================================================================
// Child Component Fakes
// ============================================================================
// The Journal tab only needs to prove what it sends to its child panes here.
// The sidebar and spread have their own rendering responsibilities elsewhere,
// so these fakes expose the data that JournalTab passes into them.
// ============================================================================
vi.mock('../QuestLogSidebar', () => ({
  QuestLogSidebar: ({ quests }: { quests: Quest[] }) => (
    <div data-testid="quest-log-sidebar" data-quest-count={quests.length} />
  ),
}));

vi.mock('../JournalSpread', () => ({
  JournalSpread: ({
    entry,
  }: {
    entry: JournalEntry | null;
  }) => (
    <div
      data-testid="journal-spread"
      data-entry-id={entry?.id ?? 'none'}
      data-entry-session={entry?.sessionNumber ?? 'none'}
      data-entry-page={entry?.pageNumber ?? 'none'}
    />
  ),
}));

// ============================================================================
// Journal Tab Contract Tests
// ============================================================================
// These checks guard the player-facing sheet behavior: empty journals still show
// a readable starter page, real journal entries are forwarded, and the responsive
// panes remain present for CSS to stack at phone width.
// ============================================================================
describe('JournalTab', () => {
  // A small active quest proves the quest sidebar receives live quest data
  // without requiring the full quest card renderer in this focused test.
  const quests: Quest[] = [
    {
      id: 'quest-1',
      title: 'Test Quest',
      description: 'A quest used to prove the sidebar contract.',
      status: QuestStatus.Active,
      objectives: [],
    },
  ];

  it('renders a fallback journal entry when the journal payload is omitted', () => {
    render(<JournalTab quests={quests} />);

    expect(screen.getByTestId('quest-log-sidebar')).toHaveAttribute('data-quest-count', '1');
    expect(screen.getByTestId('journal-spread')).toHaveAttribute('data-entry-id', 'mock-entry-1');
    expect(screen.getByTestId('journal-spread')).toHaveAttribute('data-entry-session', '1');
    expect(screen.getByTestId('journal-spread')).toHaveAttribute('data-entry-page', '1');
  });

  it('forwards a provided journal entry to the spread', () => {
    // This save-backed entry proves the tab prefers real journal state over the
    // starter page once the campaign has recorded an actual journal page.
    const journalEntry: JournalEntry = {
      id: 'journal-entry-7',
      sessionNumber: 7,
      gameDate: 'The 14th of Kythorn',
      gameYear: 'Year 1492 DR',
      pageNumber: 12,
      narrativeText: 'A real journal entry',
      recap: {
        sessionNumber: 7,
        keyEvents: [],
        loot: [],
        currentObjectives: [],
      },
      autoLoggedEvents: [],
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
    };

    const journal: JournalState = {
      entries: [journalEntry],
      currentSessionNumber: 7,
      currentPageNumber: 12,
      pendingEvents: [],
    };

    render(<JournalTab quests={[]} journal={journal} />);

    expect(screen.getByTestId('quest-log-sidebar')).toHaveAttribute('data-quest-count', '0');
    expect(screen.getByTestId('journal-spread')).toHaveAttribute('data-entry-id', journalEntry.id);
    expect(screen.getByTestId('journal-spread')).toHaveAttribute('data-entry-session', String(journalEntry.sessionNumber));
    expect(screen.getByTestId('journal-spread')).toHaveAttribute('data-entry-page', String(journalEntry.pageNumber));
  });

  it('marks the quest list and journal spread as responsive panes', () => {
    // The class names are part of the UI contract because JournalTab.css uses
    // them to stack the panes in narrow character-sheet windows.
    const { container } = render(<JournalTab quests={quests} />);

    const shell = container.firstElementChild;

    expect(shell).toHaveClass('journal-tab-shell');
    expect(screen.getByTestId('quest-log-sidebar').parentElement).toHaveClass('journal-tab-quest-column');
    expect(screen.getByTestId('journal-spread').parentElement).toHaveClass('journal-tab-content-column');
  });
});
