import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompanionCard } from './CompanionCard';
import { createMockCompanion } from '../../utils/character/companionFactories';

describe('CompanionCard', () => {
  it('maps approval across the full runtime scale', () => {
    // The visual bar should use the same -500..500 contract as the relationship manager.
    const playerId = 'player-1';
    const makeCompanion = (approval: number) =>
      createMockCompanion({
        relationships: {
          [playerId]: {
            targetId: playerId,
            level: 'stranger',
            approval,
            history: [],
            unlocks: [],
          },
        },
      });

    const { rerender } = render(<CompanionCard companion={makeCompanion(-500)} playerId={playerId} />);
    const marker = screen.getByTestId('approval-marker');

    expect(marker).toHaveStyle({ left: '0%' });

    rerender(<CompanionCard companion={makeCompanion(0)} playerId={playerId} />);
    expect(marker).toHaveStyle({ left: '50%' });

    rerender(<CompanionCard companion={makeCompanion(500)} playerId={playerId} />);
    expect(marker).toHaveStyle({ left: '100%' });
  });
});
