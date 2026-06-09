import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JournalTab } from '../JournalTab';
import { QuestStatus, type Quest } from '../../../../types';
import { type JournalEntry, type JournalState } from '../../../../types/journal';

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

describe('JournalTab', () => {
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
});
