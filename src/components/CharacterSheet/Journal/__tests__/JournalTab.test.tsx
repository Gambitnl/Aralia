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
// These checks guard the player-facing sheet behavior: empty journals stay honest without invented pages, real journal entries are forwarded, and the responsive
// panes remain present in narrow desktop windows.
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

  it('keeps an omitted journal empty instead of inventing campaign history', () => {
    render(<JournalTab quests={quests} />);

    expect(screen.getByTestId('quest-log-sidebar')).toHaveAttribute('data-quest-count', '1');
    expect(screen.getByTestId('journal-spread')).toHaveAttribute('data-entry-id', 'none');
    expect(screen.getByTestId('journal-spread')).toHaveAttribute('data-entry-session', 'none');
    expect(screen.getByTestId('journal-spread')).toHaveAttribute('data-entry-page', 'none');
  });

  it('keeps an explicitly empty saved journal empty without changing its pending events', () => {
    const journal: JournalState = { entries: [], currentSessionNumber: 3, currentPageNumber: 5, pendingEvents: [] };
    const before = JSON.stringify(journal);
    render(<JournalTab quests={[]} journal={journal} />);
    expect(screen.getByTestId('journal-spread')).toHaveAttribute('data-entry-id', 'none');
    expect(JSON.stringify(journal)).toBe(before);
  });

  it('forwards a provided journal entry to the spread', () => {
    // This save-backed entry proves the tab prefers real journal state over the
    // empty state once the campaign has recorded an actual journal page.
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
