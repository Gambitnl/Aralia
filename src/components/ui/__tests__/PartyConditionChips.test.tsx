/**
 * @file PartyConditionChips.test.tsx
 * PRV6: party-wide conditions (starving / fatigued / poisoned) set by the
 * travel-provisioning gate were stored in state but rendered nowhere — the
 * player could suffer the gate's headline consequence with zero visible cue.
 * These tests pin the shared chip strip that now surfaces them.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConditionChips, CONDITION_INFO } from '../PartyConditionChips';
import GlossaryContext from '../../../context/GlossaryContext';
import type { GlossaryEntry } from '../../../types';

const POISONED_ENTRY = {
    id: 'poisoned_condition',
    title: 'Poisoned',
    category: 'Rules Glossary',
    excerpt: 'A poisoned creature has Disadvantage on attack rolls and ability checks.',
    filePath: '/data/glossary/entries/rules/conditions/poisoned_condition.json',
} as unknown as GlossaryEntry;

const withGlossary = (ui: React.ReactNode, entries: GlossaryEntry[] = [POISONED_ENTRY]) => (
    <GlossaryContext.Provider value={entries}>{ui}</GlossaryContext.Provider>
);

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

    it('links a condition that has a glossary entry, so its copy is not a stale hardcoded duplicate', () => {
        expect(CONDITION_INFO.poisoned?.glossaryTermId).toBe('poisoned_condition');
        render(withGlossary(<ConditionChips conditions={['poisoned']} />));
        // GlossaryTooltip marks the trigger as a link to the full entry.
        const chip = screen.getByText('Poisoned').closest('[role="link"]');
        expect(chip).not.toBeNull();
    });

    it('does NOT link homebrew travel conditions with no glossary entry', () => {
        render(withGlossary(<ConditionChips conditions={['starving', 'fatigued']} />));
        expect(screen.getByText('Starving').closest('[role="link"]')).toBeNull();
        expect(screen.getByText('Fatigued').closest('[role="link"]')).toBeNull();
    });

    it('navigates to the glossary entry when a linked chip is clicked', () => {
        const onNavigate = vi.fn();
        render(
            withGlossary(
                <ConditionChips conditions={['poisoned']} onNavigateToGlossary={onNavigate} />,
            ),
        );
        screen.getByText('Poisoned').closest('[role="link"]')!.dispatchEvent(
            new MouseEvent('click', { bubbles: true }),
        );
        expect(onNavigate).toHaveBeenCalledWith('poisoned_condition');
    });
});
