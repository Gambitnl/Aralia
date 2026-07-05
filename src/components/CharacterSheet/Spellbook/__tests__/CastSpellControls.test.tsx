/**
 * @file CastSpellControls.test.tsx
 * Verifies the spellbook's out-of-combat Cast button: enabled/disabled state,
 * the party target picker, and the exact CAST_SPELL action it dispatches.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CastSpellControls from '../CastSpellControls';
import type { PlayerCharacter, Spell } from '../../../../types';

const cureWounds = {
    id: 'cure-wounds',
    name: 'Cure Wounds',
    level: 1,
    description:
        'A creature you touch regains a number of Hit Points equal to 2d8 plus your spellcasting ability modifier.',
    duration: { type: 'instantaneous', concentration: false },
    targeting: { type: 'single', range: 0, validTargets: ['creatures'] },
    effects: [
        {
            type: 'HEALING',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
            healing: { dice: '2d8', isTemporaryHp: false },
        },
    ],
} as unknown as Spell;

const fireBolt = {
    id: 'fire-bolt',
    name: 'Fire Bolt',
    level: 0,
    duration: { type: 'instantaneous', concentration: false },
    targeting: { type: 'single', range: 120, validTargets: ['creatures', 'objects'] },
    effects: [
        {
            type: 'DAMAGE',
            trigger: { type: 'immediate' },
            condition: { type: 'hit' },
            damage: { dice: '1d10', type: 'Fire' },
        },
    ],
} as unknown as Spell;

const detectMagic = {
    id: 'detect-magic',
    name: 'Detect Magic',
    level: 1,
    duration: { type: 'timed', value: 10, unit: 'minute', concentration: true },
    targeting: { type: 'area', range: 0, validTargets: ['self'] },
    effects: [
        {
            type: 'UTILITY',
            utilityType: 'sensory',
            description: 'Sense magic within 30 feet.',
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
        },
    ],
} as unknown as Spell;

const makeCharacter = (overrides: Record<string, unknown> = {}): PlayerCharacter =>
    ({
        id: 'pc-caster',
        name: 'Lyra',
        hp: 10,
        maxHp: 16,
        spellSlots: { level_1: { current: 2, max: 3 } },
        ...overrides,
    }) as unknown as PlayerCharacter;

const ally = {
    id: 'pc-ally',
    name: 'Bram',
    hp: 4,
    maxHp: 12,
} as unknown as PlayerCharacter;

describe('CastSpellControls', () => {
    it('casting a targeted spell opens the party picker, and picking dispatches CAST_SPELL', () => {
        const onAction = vi.fn();
        const caster = makeCharacter();
        render(
            <CastSpellControls
                spell={cureWounds}
                character={caster}
                party={[caster, ally]}
                isReadyToCast={true}
                onAction={onAction}
            />,
        );

        fireEvent.click(screen.getByTestId('cast-spell-button'));
        expect(onAction).not.toHaveBeenCalled();

        const picker = screen.getByTestId('cast-target-picker');
        expect(picker).toHaveTextContent('Bram (4/12 HP)');

        fireEvent.click(screen.getByText(/Bram/));
        expect(onAction).toHaveBeenCalledExactlyOnceWith({
            type: 'CAST_SPELL',
            label: 'Cast Cure Wounds',
            payload: {
                characterId: 'pc-caster',
                spellLevel: 1,
                spellId: 'cure-wounds',
                outOfCombat: { targetCharacterId: 'pc-ally' },
            },
        });
    });

    it('self/area utility spells cast directly without a picker', () => {
        const onAction = vi.fn();
        const caster = makeCharacter();
        render(
            <CastSpellControls
                spell={detectMagic}
                character={caster}
                party={[caster, ally]}
                isReadyToCast={true}
                onAction={onAction}
            />,
        );

        fireEvent.click(screen.getByTestId('cast-spell-button'));
        expect(screen.queryByTestId('cast-target-picker')).toBeNull();
        expect(onAction).toHaveBeenCalledExactlyOnceWith({
            type: 'CAST_SPELL',
            label: 'Cast Detect Magic',
            payload: {
                characterId: 'pc-caster',
                spellLevel: 1,
                spellId: 'detect-magic',
                outOfCombat: { targetCharacterId: 'pc-caster' },
            },
        });
    });

    it('disables the button with a clear reason when no slot of the level remains', () => {
        const onAction = vi.fn();
        const drained = makeCharacter({ spellSlots: { level_1: { current: 0, max: 3 } } });
        render(
            <CastSpellControls
                spell={cureWounds}
                character={drained}
                isReadyToCast={true}
                onAction={onAction}
            />,
        );

        const button = screen.getByTestId('cast-spell-button');
        expect(button).toBeDisabled();
        expect(screen.getByTestId('cast-disabled-reason')).toHaveTextContent(
            'No level 1+ spell slots remaining.',
        );
        fireEvent.click(button);
        expect(onAction).not.toHaveBeenCalled();
    });

    it('disables the button when the spell is not prepared', () => {
        const onAction = vi.fn();
        render(
            <CastSpellControls
                spell={cureWounds}
                character={makeCharacter()}
                isReadyToCast={false}
                notReadyReason="Not prepared."
                onAction={onAction}
            />,
        );

        expect(screen.getByTestId('cast-spell-button')).toBeDisabled();
        expect(screen.getByTestId('cast-disabled-reason')).toHaveTextContent('Not prepared.');
    });

    it('shows a combat-only note instead of a button for damage spells', () => {
        render(
            <CastSpellControls
                spell={fireBolt}
                character={makeCharacter()}
                isReadyToCast={true}
                onAction={vi.fn()}
            />,
        );

        expect(screen.queryByTestId('cast-spell-button')).toBeNull();
        expect(screen.getByTestId('cast-spell-controls')).toHaveTextContent(
            'Combat spell — cast it from the battle map.',
        );
    });
});
