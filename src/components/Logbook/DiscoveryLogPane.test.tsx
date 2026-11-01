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
  it('keeps the title and close control separated in compact headers', () => {
    render(
      <DiscoveryLogPane
        isOpen
        entries={[]}
        unreadCount={0}
        onClose={vi.fn()}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        npcMemory={{}}
        allNpcs={{}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Discovery Log' })).toHaveClass('min-w-0', 'flex-1', 'break-words');
    expect(screen.getByRole('button', { name: 'Close journal' })).toHaveClass('h-11', 'w-11', 'flex-shrink-0');
  });

  it('lets compact empty states keep readable height instead of clipping behind the footer', () => {
    render(
      <DiscoveryLogPane
        isOpen
        entries={[]}
        unreadCount={0}
        onClose={vi.fn()}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        npcMemory={{}}
        allNpcs={{}}
      />
    );

    expect(screen.getByTestId('discovery-log').firstElementChild).toHaveClass('overflow-hidden', 'h-[calc(100dvh-2rem)]');
    expect(screen.getByTestId('discovery-log-main')).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto');
    expect(screen.getByTestId('discovery-log-entry-list')).toHaveClass('min-h-28', 'md:min-h-0');
    expect(screen.getByLabelText('Search')).toHaveClass('min-h-11');
    expect(screen.getByLabelText('Filter by Type')).toHaveClass('min-h-11');
    expect(screen.getByLabelText('Sort by')).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Mark All as Read' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Close Log' })).toHaveClass('min-h-11', 'whitespace-nowrap');
  });

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
    expect(within(listPane).getByRole('button', { name: /Entry 30/ })).toHaveClass('min-h-11');
    expect(within(listPane).getByRole('button', { name: 'Next' })).toHaveClass('min-h-11');
    expect(within(listPane).getByRole('button', { name: 'Previous' })).toHaveClass('min-h-11');
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

describe('discovery accounts use the played game date',()=>{
  const show=(entry:DiscoveryEntry)=>render(<DiscoveryLogPane isOpen entries={[entry]} unreadCount={0} onClose={vi.fn()} onMarkRead={vi.fn()} onMarkAllRead={vi.fn()} npcMemory={{}} allNpcs={{}}/>);
  it('attributes a library account without exposing stored engine provenance as prose',()=>{
    const entry=createDiscoveryEntry(94,{id:'library-account:v1:1793432134128:40:56:works:502:abc',type:DiscoveryType.LORE_DISCOVERY,title:'Library account: Menina waterworks',content:'Ask locally in Menina.',source:{type:'LOCATION',id:'world:1793432134128:burg:40:library:56',name:'Grangengen library'},flags:[{key:'knowledgeKind',value:'library-account'},{key:'sourceWorldSeed',value:1793432134128},{key:'accountSitePath',value:'wf:2430771696/burg:502/dungeon:sewer'}]});
    const before=JSON.stringify(entry);show(entry);
    expect(screen.getByText('Read at:')).toBeVisible();
    expect(screen.getByText('Grangengen library',{exact:false})).toBeVisible();
    expect(screen.queryByText(/sourceWorldSeed|accountSitePath|knowledgeKind|ID: world:/)).toBeNull();
    expect(screen.getByText('Ask locally in Menina.')).toBeVisible();
    expect(JSON.stringify(entry)).toBe(before);
  });
  it('shows the heard year351 time in list and detail after a saved account round trip',()=>{
    const entry=createDiscoveryEntry(91,{timestamp:Date.UTC(2026,9,29,10,14,52),gameTime:'0351-01-03T16:15:19.000Z',title:'Directions from Hilda Fairbourne'});
    show(JSON.parse(JSON.stringify(entry)));
    expect(screen.getByTestId('discovery-log-entry-list').textContent).toContain('1/3/351');
    expect(screen.getByText(/4:15:19 PM/)).toBeVisible();
    expect(screen.queryByText('10/29/2026',{exact:false})).not.toBeInTheDocument();
    expect(screen.queryByText(/0351-01-03T/)).not.toBeInTheDocument();
  });
  it('shows a retained clock-only notice honestly without inventing a world date from the host receipt',()=>{
    const entry=createDiscoveryEntry(93,{timestamp:Date.UTC(2026,9,29,18,39,15),gameTime:'03:39 AM',title:'Town Routine'});
    const before=JSON.stringify(entry);show(JSON.parse(before));
    expect(screen.getByTestId('discovery-log-entry-list').textContent).toContain('Date not recorded');
    expect(screen.getByText('In-game time (date not recorded):')).toBeVisible();
    expect(screen.getByText('03:39 AM')).toBeVisible();
    expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
    expect(JSON.stringify(entry)).toBe(before);
  });
  it('keeps older accounts readable when no valid game clock was stored',()=>{
    show(createDiscoveryEntry(92,{timestamp:Date.UTC(2001,1,3,4,5,6),gameTime:'not-a-date'}));
    expect(screen.getByTestId('discovery-log-entry-list').textContent).toContain('2/3/2001');
    expect(screen.getByText(/4:05:06 AM/)).toBeVisible();
    expect(screen.queryByText(/not-a-date/)).not.toBeInTheDocument();
  });
});
