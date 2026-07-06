import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiceRollerModal } from './DiceRollerModal';

vi.mock('../../hooks/useDiceBox', () => ({
    useDiceBox: () => ({
        isReady: true,
        isRolling: false,
        lastResult: null,
        error: null,
        roll: vi.fn(),
        clear: vi.fn(),
        resize: vi.fn(),
        updateScale: vi.fn(),
    }),
}));

vi.mock('../ui/WindowFrame', () => ({
    WindowFrame: ({ title, children }: { title: string; children: React.ReactNode }) => (
        <section role="dialog" aria-modal="true" aria-label={title} data-testid="window-dice-roller-window">
            {children}
        </section>
    ),
}));

vi.mock('./DiceScaleSlider', () => ({
    DiceScaleSlider: ({ value }: { value: number }) => <div data-testid="dice-scale-slider">Scale: {value}</div>,
}));

// Dice Roller owns a dense control panel, but WindowFrame owns the dialog
// semantics. This regression keeps assistive tech and browser tests pointed at
// one visible window instead of a hidden wrapper plus the real frame.
describe('DiceRollerModal', () => {
    it('renders one named dialog with wrapping controls', () => {
        render(<DiceRollerModal isOpen={true} onClose={vi.fn()} />);

        expect(screen.getAllByRole('dialog', { name: 'Dice Roller' })).toHaveLength(1);
        expect(screen.getByTestId('dice-roller-controls')).toBeDefined();
        expect(screen.getByRole('button', { name: /Roll/i })).toBeDefined();
    });
});
