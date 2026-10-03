/**
 * This file verifies how the spell card renders referenced-rule chips (agora-9833).
 *
 * A rule the enrichment dataset resolved becomes a real glossary link. A rule
 * with no destination used to render the same button, which looked clickable and
 * did nothing; it now renders an inert span that says why it cannot be opened.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SpellCardTemplate, { type SpellData } from '../SpellCardTemplate';

// The real tooltip has its own glossary context and hover behavior. This
// stand-in keeps the navigation contract visible without that machinery.
vi.mock('../GlossaryTooltip', () => ({
  default: ({
    termId,
    onNavigateToGlossary,
    children,
  }: {
    termId: string;
    onNavigateToGlossary?: (termId: string) => void;
    children: React.ReactNode;
  }) => (
    <span data-testid={`tooltip-${termId}`} onClick={() => onNavigateToGlossary?.(termId)}>
      {children}
    </span>
  ),
}));

const spell: SpellData = {
  id: 'fireball',
  name: 'Fireball',
  level: 3,
  school: 'Evocation',
  description: 'Each creature in a 20-foot-radius Sphere must make a Dexterity saving throw.',
  tags: ['damage'],
};

describe('SpellCardTemplate referenced-rule chips', () => {
  it('links a resolved rule in the prose and in the tag row, and routes navigation out', () => {
    const onNavigateToGlossary = vi.fn();

    render(
      <SpellCardTemplate
        spell={spell}
        referencedRules={[{ label: 'Sphere', description: 'An area of effect.', glossaryTermId: 'sphere_area' }]}
        onNavigateToGlossary={onNavigateToGlossary}
      />
    );

    // One chip inside the description prose, one in the spell tag row.
    const tooltips = screen.getAllByTestId('tooltip-sphere_area');
    expect(tooltips).toHaveLength(2);

    // The tag row marks an area destination so the row reads as a shape, not a
    // bare noun, while the prose keeps the sentence intact.
    expect(screen.getByRole('button', { name: 'Area: Sphere' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sphere' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Area: Sphere' }));
    expect(onNavigateToGlossary).toHaveBeenCalledWith('sphere_area');
  });

  it('renders an unresolved rule as an inert labeled chip instead of a dead button', () => {
    render(
      <SpellCardTemplate
        spell={spell}
        referencedRules={[{ label: 'Sphere', description: 'An area of effect.' }]}
      />
    );

    expect(screen.queryByRole('button', { name: 'Sphere' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('tooltip-sphere_area')).not.toBeInTheDocument();

    const inertChips = screen.getAllByTitle('This rule has no glossary entry yet, so it cannot be opened.');
    expect(inertChips).toHaveLength(2);
    expect(inertChips.map((chip) => chip.textContent)).toEqual(['Sphere', 'Sphere']);
  });

  it('leaves the description untouched when no rules are referenced', () => {
    render(<SpellCardTemplate spell={spell} referencedRules={[]} />);

    expect(screen.getByText(spell.description)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sphere' })).not.toBeInTheDocument();
  });
});
