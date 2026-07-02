/**
 * @file PartyConditionChips.test.tsx
 * PRV6: party-wide conditions (starving / fatigued / poisoned) set by the
 * travel-provisioning gate were stored in state but rendered nowhere — the
 * player could suffer the gate's headline consequence with zero visible cue.
 * These tests pin the shared chip strip that now surfaces them.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConditionChips, CONDITION_INFO } from '../PartyConditionChips';

describe('ConditionChips (PRV6)', () => {
    it('renders a labeled chip per known condition', () => {
        render(<ConditionChips conditions={['starving', 'fatigued', 'poisoned']} />);
        expect(screen.getByText('Starving')).toBeInTheDocument();
        expect(screen.getByText('Fatigued')).toBeInTheDocument();
        expect(screen.getByText('Poisoned')).toBeInTheDocument();
    });

    it('renders nothing at all when there are no conditions', () => {
        const { container } = render(<ConditionChips conditions={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('still renders an unknown condition as a readable fallback chip', () => {
        render(<ConditionChips conditions={['cursed']} />);
        expect(screen.getByText('Cursed')).toBeInTheDocument();
    });

    it('exposes a plain-language explanation (incl. how to recover) on each chip', () => {
        render(<ConditionChips conditions={['starving']} />);
        // The explanation is the accessible title so it works without a hover lib.
        const chip = screen.getByText('Starving').closest('[title]');
        expect(chip).not.toBeNull();
        expect(chip!.getAttribute('title')).toMatch(/food|eat/i);
    });

    it('has copy for every condition the travel gate can apply', () => {
        for (const key of ['starving', 'fatigued', 'poisoned']) {
            expect(CONDITION_INFO[key]?.description).toBeTruthy();
        }
    });
});
