import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GlossaryDisplay from '../GlossaryDisplay';
import { GlossaryDisplayItem } from '../../../types';

describe('GlossaryDisplay', () => {
  const items: GlossaryDisplayItem[] = [
    { icon: '🧭', meaning: 'Compass' },
    { icon: '🧭', meaning: 'Duplicate Compass' },
    { icon: '🏠', meaning: 'Village' },
  ];

  it('renders unique glossary items with default title', () => {
    render(<GlossaryDisplay items={items} />);

    expect(screen.getByText('Icon Glossary')).toBeInTheDocument();
    expect(screen.getByText('Compass')).toBeInTheDocument();
    expect(screen.getByText('Village')).toBeInTheDocument();
    expect(screen.queryByText('Duplicate Compass')).not.toBeInTheDocument();
  });

  it('returns null when given no items', () => {
    const { container } = render(<GlossaryDisplay items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
