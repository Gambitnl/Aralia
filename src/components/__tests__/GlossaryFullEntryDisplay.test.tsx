import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FullEntryDisplay } from '../Glossary/FullEntryDisplay';
import { GlossaryEntry } from '../../types';

const rendererSpy = vi.fn();

vi.mock('../Glossary/GlossaryContentRenderer', () => ({
  GlossaryContentRenderer: (props: { markdownContent: string; onNavigate?: (id: string) => void }) => {
    rendererSpy(props);
    return <div data-testid="content">{props.markdownContent}</div>;
  },
}));

describe('FullEntryDisplay', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    rendererSpy.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const entry: GlossaryEntry = {
    id: 'test-entry',
    title: 'Test Entry',
    category: 'Spells',
    filePath: '/entries/test-entry.md',
    seeAlso: ['related-term'],
  };

  it('renders fetched markdown without frontmatter and wires see-also navigation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve('---\nid: test-entry\ntags: [level 3]\n---\n\n# Heading\nContent body'),
    } as any);
    global.fetch = fetchMock as any;

    const onNavigate = vi.fn();
    render(<FullEntryDisplay entry={entry} onNavigate={onNavigate} />);

    await waitFor(() => expect(screen.getByTestId('content')).toBeInTheDocument());
    const content = screen.getByTestId('content').textContent || '';
    expect(content).toContain('# Heading');
    expect(content).toContain('Content body');
    expect(content).not.toContain('id: test-entry');
    expect(content).not.toContain('tags: [level 3]');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('entries/test-entry.md'));

    fireEvent.click(screen.getByText('related-term'));
    expect(onNavigate).toHaveBeenCalledWith('related-term');
  });

  it('shows an error message when fetch fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: () => Promise.resolve(''),
    } as any);
    global.fetch = fetchMock as any;

    render(<FullEntryDisplay entry={entry} />);

    await waitFor(() => expect(screen.getByText(/Error loading content/)).toBeInTheDocument());
  });
});
