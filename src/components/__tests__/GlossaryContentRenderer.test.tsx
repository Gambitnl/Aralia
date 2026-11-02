import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GlossaryContentRenderer } from '../Glossary/GlossaryContentRenderer';

describe('GlossaryContentRenderer Security', () => {
  it('sanitizes malicious HTML content', () => {
    // Malicious markdown that produces an img tag with an onerror handler
    // Or direct HTML injection if marked allows it (which it often does by default)
    const directHtmlInjection = '<img src=x onerror=alert(1) />';

    const { container } = render(
      <GlossaryContentRenderer markdownContent={directHtmlInjection} />
    );

    // If unsanitized, the output might contain the onerror attribute.
    // We expect the sanitizer to strip it.
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).not.toHaveAttribute('onerror');
  });

  it('preserves safe HTML content', () => {
    const safeMarkdown = '**Bold Text** and *Italic*';
    const { container } = render(
      <GlossaryContentRenderer markdownContent={safeMarkdown} />
    );

    expect(container.innerHTML).toContain('<strong>Bold Text</strong>');
    expect(container.innerHTML).toContain('<em>Italic</em>');
  });
});

describe('GlossaryContentRenderer reading continuity', () => {
  it('keeps an opened explanation and keyboard focus through unrelated parent renders', () => {
    const markdownContent = '### Attacks Affected\nIncoming attacks have Advantage.\n\n### Automatic Critical Hits\nA hit within 5 feet is critical.';
    const { container, rerender } = render(
      <GlossaryContentRenderer markdownContent={markdownContent} onNavigate={vi.fn()} />
    );
    const card = container.querySelector('details')!;
    const summary = card.querySelector('summary')!;
    // A native details toggle changes the DOM without a React state update.
    card.open = true;
    fireEvent(card, new Event('toggle'));
    summary.focus();
    rerender(<GlossaryContentRenderer markdownContent={markdownContent} onNavigate={vi.fn()} />);
    expect(container.querySelector('details')).toBe(card);
    expect(card.open).toBe(true);
    expect(summary).toHaveFocus();
  });

  it('still replaces the displayed rules when their actual content changes', () => {
    const { container, rerender } = render(<GlossaryContentRenderer markdownContent="### Attacks\nOld explanation." />);
    rerender(<GlossaryContentRenderer markdownContent="### Attacks\nUpdated explanation." />);
    expect(container).toHaveTextContent('Updated explanation.');
    expect(container).not.toHaveTextContent('Old explanation.');
  });
});
