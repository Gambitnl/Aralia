/**
 * Companion card rendering regressions.
 *
 * The card is a durable party surface, so these checks protect both its
 * relationship scale and the initials fallback required by legacy saves that
 * still contain retired placeholder portrait paths.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompanionCard } from './CompanionCard';
import { createMockCompanion } from '../../utils/character/companionFactories';
import { COMPANIONS } from '../../data/companions';

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

  it('renders initials instead of a retired legacy portrait', () => {
    const staleElara = {
      ...COMPANIONS.elara_vance,
      identity: {
        ...COMPANIONS.elara_vance.identity,
        avatarUrl: '/avatars/elara.png',
      },
    };

    const { container } = render(<CompanionCard companion={staleElara} />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('E')).toBeInTheDocument();
  });
});
