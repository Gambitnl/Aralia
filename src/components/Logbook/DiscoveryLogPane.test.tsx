import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DiscoveryLogPane from './DiscoveryLogPane';
import { DiscoveryEntry, DiscoveryType } from '../../types';

// Tooltip wraps unread markers in the production app. The test only needs the
// list behavior, so this lightweight mock keeps the rendered text simple.
vi.mock('../ui/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function createDiscoveryEntry(index: number, overrides: Partial<DiscoveryEntry> = {}): DiscoveryEntry {
  return {
    id: `entry-${index}`,
    timestamp: 1000 + index,
    gameTime: '2026-06-25T12:00:00.000Z',
    type: DiscoveryType.MISC_EVENT,
    title: `Entry ${index}`,
    content: `Discovery content ${index}`,
    source: { type: 'SYSTEM' },
    flags: [],
    isRead: true,
    ...overrides,
  };
}

describe('DiscoveryLogPane', () => {
  it('paginates long discovery lists and resets to the first page after search', () => {
    const entries = Array.from({ length: 30 }, (_, index) => createDiscoveryEntry(index + 1));

    render(
      <DiscoveryLogPane
        isOpen
        entries={entries}
        unreadCount={0}
        onClose={vi.fn()}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        npcMemory={{}}
        allNpcs={{}}
      />
    );

    const listPane = screen.getByTestId('discovery-log-entry-list');

    expect(within(listPane).getByText('Entry 30')).toBeInTheDocument();
    expect(within(listPane).queryByText('Entry 5')).not.toBeInTheDocument();
    expect(within(listPane).getByText('Page 1 of 2')).toBeInTheDocument();

    fireEvent.click(within(listPane).getByRole('button', { name: 'Next' }));

    expect(within(listPane).getByText('Entry 5')).toBeInTheDocument();
    expect(within(listPane).getByText('Page 2 of 2')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Entry 30' } });

    expect(within(listPane).getByText('Entry 30')).toBeInTheDocument();
    expect(within(listPane).queryByText('Page 2 of 2')).not.toBeInTheDocument();
  });
});
