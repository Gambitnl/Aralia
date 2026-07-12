/**
 * This file verifies the transient companion-reaction bubble players see over
 * exploration and combat.
 *
 * It protects queue ordering, duplicate suppression, timed dismissal, and the
 * honest initials fallback used when an authored companion has no portrait
 * asset. The tests use fake time so they exercise the full display sequence
 * without slowing the suite down by real five-second waits.
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanionReaction } from './CompanionReaction';
import { createMockCompanion } from '../../utils/character/companionFactories';
import { GameMessage } from '../../types';
import { UI_ID } from '../../styles/uiIds';
import { COMPANIONS } from '../../data/companions';

// These helpers keep the test focused on bubble sequencing instead of bulky fixture setup.
const makeCompanion = (id: string, name: string) =>
  createMockCompanion({
    id,
    identity: {
      id,
      name,
      race: 'Human',
      class: 'Fighter',
      background: 'Soldier',
      sex: 'Unknown',
      age: 25,
      physicalDescription: `${name} placeholder`,
      avatarUrl: undefined,
    },
  });

const makeReaction = (id: number, companionId: string, text: string, timestampMs: number): GameMessage => ({
  id,
  text,
  sender: 'npc',
  timestamp: new Date(timestampMs),
  metadata: {
    companionId,
  },
});

describe('CompanionReaction', () => {
  beforeEach(() => {
    // Fake timers let the test prove the queue order without waiting for real timeouts.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('queues the next companion reaction until the active bubble expires', () => {
    const companions = {
      kaelen: makeCompanion('kaelen', 'Kaelen'),
      elara: makeCompanion('elara', 'Elara'),
    };
    const firstReaction = makeReaction(1, 'kaelen', 'Kaelen: "First reaction"', 1_000);
    const secondReaction = makeReaction(2, 'elara', 'Elara: "Second reaction"', 2_000);

    const { rerender } = render(<CompanionReaction companions={companions} latestMessage={firstReaction} />);

    expect(screen.getByTestId(UI_ID.COMPANION_REACTION)).toHaveTextContent('First reaction');

    act(() => {
      rerender(<CompanionReaction companions={companions} latestMessage={secondReaction} />);
    });

    // The new bubble should wait its turn instead of replacing the active one.
    expect(screen.getByTestId(UI_ID.COMPANION_REACTION)).toHaveTextContent('First reaction');
    expect(screen.queryByText('Second reaction')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.getByTestId(UI_ID.COMPANION_REACTION)).toHaveTextContent('Second reaction');

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.queryByTestId(UI_ID.COMPANION_REACTION)).not.toBeInTheDocument();
  });

  it('drops an immediate duplicate reaction from the same companion', () => {
    const companions = {
      kaelen: makeCompanion('kaelen', 'Kaelen'),
    };
    const firstReaction = makeReaction(3, 'kaelen', 'Kaelen: "Same burst"', 3_000);
    const duplicateReaction = makeReaction(4, 'kaelen', 'Kaelen: "Same burst"', 3_250);

    const { rerender } = render(<CompanionReaction companions={companions} latestMessage={firstReaction} />);

    expect(screen.getByTestId(UI_ID.COMPANION_REACTION)).toHaveTextContent('Same burst');

    act(() => {
      rerender(<CompanionReaction companions={companions} latestMessage={duplicateReaction} />);
    });

    // A near-identical follow-up from the same companion should be collapsed instead of resetting the bubble.
    expect(screen.getByTestId(UI_ID.COMPANION_REACTION)).toHaveTextContent('Same burst');

    act(() => {
      vi.advanceTimersByTime(5_001);
    });

    expect(screen.queryByTestId(UI_ID.COMPANION_REACTION)).not.toBeInTheDocument();
  });

  it('uses the initials fallback for a legacy companion carrying a retired portrait path', () => {
    // Existing saves can retain the old placeholder even after canonical data
    // stops advertising it, so exercise the persisted shape seen in live play.
    const legacyElara = {
      ...COMPANIONS.elara_vance,
      identity: {
        ...COMPANIONS.elara_vance.identity,
        avatarUrl: '/avatars/elara.png',
      },
    };
    const reaction = makeReaction(5, 'elara_vance', 'Elara Vance: "Stand firm."', 5_000);
    const { container } = render(
      <CompanionReaction companions={{ elara_vance: legacyElara }} latestMessage={reaction} />,
    );

    // Canonical data is clean and the render boundary also protects old saves.
    expect(COMPANIONS.elara_vance.identity.avatarUrl).toBeUndefined();
    expect(COMPANIONS.kaelen_thorne.identity.avatarUrl).toBeUndefined();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId(UI_ID.COMPANION_REACTION)).toHaveTextContent('Stand firm.');

    // Finish the bubble's timer inside React's update boundary so this proof
    // leaves no pending state update or warning for the next scenario.
    act(() => {
      vi.advanceTimersByTime(5_001);
    });
    expect(screen.queryByTestId(UI_ID.COMPANION_REACTION)).not.toBeInTheDocument();
  });
});
