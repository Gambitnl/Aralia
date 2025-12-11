import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GlossaryContentRenderer } from '../Glossary/GlossaryContentRenderer';

describe('GlossaryContentRenderer Security', () => {
  it('sanitizes malicious HTML content', () => {
    // Malicious markdown that produces an img tag with an onerror handler
    const maliciousMarkdown = '![Malicious](x " onerror=alert(1)")';
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
