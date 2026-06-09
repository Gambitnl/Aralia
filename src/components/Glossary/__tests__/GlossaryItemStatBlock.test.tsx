import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GlossaryItemStatBlock } from '../GlossaryItemStatBlock';

// This test stays close to the metadata rendering path so the UI contract for
// item stats is checked where the badge and stat text actually render.
describe('GlossaryItemStatBlock', () => {
  it('hides the placeholder None rarity while preserving the other stats', () => {
    render(
      <GlossaryItemStatBlock
        metadata={{
          type: 'Adventuring Gear',
          rarity: 'None',
          cost: 50,
          weight: 1,
        }}
      />
    );

    expect(screen.queryByText('None')).not.toBeInTheDocument();
    expect(screen.getByText('Adventuring Gear')).toBeInTheDocument();
    expect(screen.getByText('50 gp')).toBeInTheDocument();
    expect(screen.getByText('1 lb.')).toBeInTheDocument();
  });

  it('still shows a real rarity badge when the source has one', () => {
    render(
      <GlossaryItemStatBlock
        metadata={{
          type: 'Wand',
          rarity: 'Rare',
          tier: 'Major',
        }}
      />
    );

    expect(screen.getByText('Rare (Major)')).toBeInTheDocument();
  });
});
