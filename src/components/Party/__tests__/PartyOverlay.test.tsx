/**
 * @file PartyOverlay.test.tsx
 *
 * Focused coverage for PartyOverlay footer behavior. The roster and window
 * shell are mocked so these tests can prove rest-action rules without pulling
 * in unrelated character-card rendering.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PartyOverlay from '../PartyOverlay';
import type { PlayerCharacter } from '../../../types';

vi.mock('../../ui/WindowFrame', () => ({
    WindowFrame: ({ title, children }: { title: string; children: React.ReactNode }) => (
        <section aria-label={title}>{children}</section>
    ),
}));

vi.mock('../PartyPane', () => ({
    default: () => <div data-testid="party-pane" />,
}));

vi.mock('../../ui/Tooltip', () => ({
    default: ({ content, children }: { content?: React.ReactNode; children: React.ReactNode }) => (
        <div data-testid="tooltip" data-content={String(content)}>{children}</div>
    ),
}));

vi.mock('../../Glossary/IconRegistry', () => ({
    GlossaryIcon: ({ name }: { name: string }) => <span aria-hidden="true">{name}</span>,
}));

const renderOverlay = (overrides: Record<string, unknown> = {}) => {
    const props = {
        isOpen: true,
        onClose: vi.fn(),
        party: [] as PlayerCharacter[],
        onViewCharacterSheet: vi.fn(),
        onFixMissingChoice: vi.fn(),
        onLongRest: vi.fn(),
        onShortRest: vi.fn(),
        shortRestTracker: { restsTakenToday: 1, lastRestDay: 12 },
        ...overrides,
    };

    render(<PartyOverlay {...props} />);

    return props;
};

describe('PartyOverlay rest footer', () => {
    it('blocks long and short rests while combat is active', () => {
        const props = renderOverlay({ isCombatActive: true });

        const longRestButton = screen.getByRole('button', { name: /Long Rest/i });
        const shortRestButton = screen.getByRole('button', { name: /Short Rest/i });

        expect(longRestButton).toBeDisabled();
        expect(shortRestButton).toBeDisabled();
        expect(screen.getByText('Resting is unavailable during active combat.')).toBeInTheDocument();
        expect(screen.getAllByTestId('tooltip')).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ dataset: expect.objectContaining({ content: 'Resting is unavailable during active combat.' }) }),
            ])
        );

        fireEvent.click(longRestButton);
        fireEvent.click(shortRestButton);

        expect(props.onLongRest).not.toHaveBeenCalled();
        expect(props.onShortRest).not.toHaveBeenCalled();
    });

    it('keeps rest callbacks available outside combat when rests remain', () => {
        const props = renderOverlay();

        fireEvent.click(screen.getByRole('button', { name: /Long Rest/i }));
        fireEvent.click(screen.getByRole('button', { name: /Short Rest/i }));

        expect(props.onLongRest).toHaveBeenCalledTimes(1);
        expect(props.onShortRest).toHaveBeenCalledTimes(1);
    });
});
