import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AISpellInputModal from './AISpellInputModal';
import { Spell } from '../../types/spells';

/**
 * This file proves the spell-choice modal renders real structured choices.
 *
 * Command stores its five selectable command words on a Utility effect rather
 * than on the older `modeChoice` field. These tests render the real modal so
 * future UI changes cannot accidentally hide the Command choices or submit a
 * different value than the button label the player clicked.
 *
 * Called by: focused Vitest component checks.
 * Depends on: AISpellInputModal and Testing Library's rendered DOM queries.
 */

describe('AISpellInputModal', () => {
    it('renders Command control options as selectable structured buttons', () => {
        const commandSpell = {
            id: 'command',
            name: 'Command',
            description: 'Choose a one-word command.',
            targeting: { type: 'single', range: 60, validTargets: ['creatures'] },
            effects: [{
                type: 'UTILITY',
                utilityType: 'control',
                description: 'On a failed save, the target follows the selected command.',
                trigger: { type: 'immediate' },
                condition: { type: 'save' },
                controlOptions: [
                    { name: 'Approach', effect: 'approach', details: 'Move toward the caster.' },
                    { name: 'Drop', effect: 'drop', details: 'Drop what it is holding.' },
                    { name: 'Flee', effect: 'flee', details: 'Move away from the caster.' },
                    { name: 'Grovel', effect: 'grovel', details: 'Fall prone and end the turn.' },
                    { name: 'Halt', effect: 'halt', details: 'Take no actions.' }
                ]
            }]
        } as unknown as Spell;
        const onSubmit = vi.fn();

        render(
            <AISpellInputModal
                spell={commandSpell}
                isOpen={true}
                onSubmit={onSubmit}
                onCancel={vi.fn()}
            />
        );

        // The rendered modal should expose every real Command word as a button
        // instead of falling back to a free-form text area.
        for (const option of ['Approach', 'Drop', 'Flee', 'Grovel', 'Halt']) {
            expect(screen.getByRole('button', { name: new RegExp(option) })).toBeTruthy();
        }
        expect(screen.queryByPlaceholderText('Describe the desired effect...')).toBeNull();

        // Clicking a structured option should submit the exact label used by
        // the command factory/playerInput bridge.
        fireEvent.click(screen.getByRole('button', { name: /Flee/ }));
        expect(onSubmit).toHaveBeenCalledWith('Flee');
    });
});
