/**
 * @file src/components/BattleMap/__tests__/CombatCommandToolbar.test.tsx
 *
 * Protects the Move / Attack pair after its move out of the battle map and into
 * the ACTIONS panel (Remy, 2026-08-16).
 *
 * These assertions came from BattleMap.commandToolbar.test.tsx, which owned them
 * while the buttons floated over the map. The behavior they guard is unchanged:
 * the attack button names the ability it will actually arm, a second press
 * cancels like the ability palette, and a character with no ready direct attack
 * gets a disabled button rather than a wrong one.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Ability } from '../../../types/combat';
import { CombatCommandToolbar } from '../CombatCommandToolbar';

const longsword = {
    id: 'longsword',
    name: 'Longsword',
    description: 'A reliable martial attack.',
    type: 'attack',
} as unknown as Ability;

function renderToolbar(overrides: Partial<React.ComponentProps<typeof CombatCommandToolbar>> = {}) {
    const onMove = vi.fn();
    const onAttack = vi.fn();
    render(
        <CombatCommandToolbar
            actionMode="move"
            onMove={onMove}
            onAttack={onAttack}
            quickAttack={longsword}
            quickAttackIsArmed={false}
            {...overrides}
        />,
    );
    return { onMove, onAttack };
}

describe('CombatCommandToolbar', () => {
    it('names the direct attack it will arm', () => {
        renderToolbar();
        // "Attack" alone would hide WHICH ability a press commits to.
        expect(screen.getByRole('button', { name: 'Attack with Longsword' })).toBeInTheDocument();
    });

    it('shows which mode is active', () => {
        renderToolbar();
        expect(screen.getByRole('button', { name: 'Move on the battle map' }))
            .toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Attack with Longsword' }))
            .toHaveAttribute('aria-pressed', 'false');
    });

    it('reports an attack press', () => {
        const { onAttack } = renderToolbar();
        fireEvent.click(screen.getByRole('button', { name: 'Attack with Longsword' }));
        expect(onAttack).toHaveBeenCalledTimes(1);
    });

    it('marks the attack pressed while it is armed, so a second press reads as cancel', () => {
        const { onAttack } = renderToolbar({ actionMode: 'ability', quickAttackIsArmed: true });
        const attack = screen.getByRole('button', { name: 'Attack with Longsword' });

        expect(attack).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(attack);
        expect(onAttack).toHaveBeenCalledTimes(1);
    });

    it('reports a move press', () => {
        const { onMove } = renderToolbar({ actionMode: 'ability' });
        fireEvent.click(screen.getByRole('button', { name: 'Move on the battle map' }));
        expect(onMove).toHaveBeenCalledTimes(1);
    });

    it('disables the attack when no direct attack is ready, instead of arming a wrong one', () => {
        const { onAttack } = renderToolbar({ quickAttack: null });
        const attack = screen.getByRole('button', { name: 'No direct attack available' });

        expect(attack).toBeDisabled();
        fireEvent.click(attack);
        expect(onAttack).not.toHaveBeenCalled();
    });

    it('carries no positioning of its own, so a parent decides where it sits', () => {
        renderToolbar();
        const toolbar = screen.getByTestId('battle-map-command-toolbar');
        // It used to be `absolute left-3 top-3` on the map's overlay layer.
        expect(toolbar.className).not.toContain('absolute');
    });
});
