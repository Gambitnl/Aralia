/**
 * @file src/components/Crafting/__tests__/SalvageModal.test.tsx
 * Focused coverage for the Salvage Workshop entry point (ui-features G1 / crafting-ui G8).
 *
 * What this proves (the acceptance path the task asks for):
 *   1. The inventory pane lists only salvageable equipment (raw reagents are filtered out).
 *   2. Selecting an item swaps the right-hand pane to that item's material preview,
 *      with the correct DC, scrap gold, and per-material yield ranges.
 *   3. The Dismantle button consumes the item, adds every previewed material id to the
 *      inventory, credits scrap gold, and advances world time.
 *   4. The result feedback log reports what was recovered.
 *
 * Why the seams are mocked: WindowFrame carries drag/persist behavior irrelevant here,
 * and crafterAdapter's roll is randomized. Both are stubbed so the assertions describe
 * the salvage pipeline itself rather than window chrome or dice luck. The material ids
 * asserted below are the real ones in src/data/craftingMaterials.ts, so a rename there
 * that would silently make ADD_ITEM drop the payload fails this test.
 */
import React from 'react';
import { ItemType } from '../../../types';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Item } from '../../../types';
import { CRAFTING_MATERIALS } from '../../../data/craftingMaterials';

const useGameStateMock = vi.fn();
const rollSkillMock = vi.fn();

vi.mock('../../../state/GameContext', () => ({
    useGameState: () => useGameStateMock(),
}));

// WindowFrame is replaced by a plain wrapper: this test is about the salvage
// pipeline, not the draggable window chrome or its localStorage persistence.
vi.mock('../../ui/WindowFrame', () => ({
    WindowFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../crafterAdapter', () => ({
    NO_CRAFTER_MESSAGE: 'No party member is available to craft. Recruit or create a character first.',
    resolveCraftingCrafter: () => ({
        status: 'resolved',
        crafter: {
            id: 'test-crafter',
            name: 'Test Crafter',
            inventory: [],
            rollSkill: (...args: unknown[]) => rollSkillMock(...args),
        },
        sourceCharacter: { id: 'test-crafter', name: 'Test Crafter' },
        sourceLabel: 'party_lead',
    }),
}));

import { SalvageModal, calculateSalvagePreview } from '../SalvageModal';

// A martial metal weapon: DC 12 Smith's Tools, 3 lb -> 1-2 Iron Scrap + 1 Leather Strip.
const longsword: Item = {
    id: 'inv-longsword',
    name: 'Longsword',
    description: 'A well-balanced blade.',
    type: ItemType.Weapon,
    category: 'Martial Melee Weapon',
    icon: '🗡️',
    weight: 3,
    value: 15,
    quantity: 1,
};

// Light armor: DC 11 Leatherworker's Tools -> Leather Strip primary.
const leatherArmor: Item = {
    id: 'inv-leather',
    name: 'Leather Armor',
    description: 'Supple boiled leather.',
    type: ItemType.Armor,
    category: 'Light Armor',
    armorCategory: 'Light',
    icon: '🛡️',
    weight: 10,
    value: 10,
    quantity: 1,
};

// Raw reagent: must NOT appear in the salvageable list.
const ironOre: Item = {
    id: 'inv-iron-ore',
    name: 'Iron Ore',
    description: 'A rough chunk of iron-bearing rock.',
    type: ItemType.Reagent,
    category: 'Raw Material',
    icon: '🪨',
    weight: 2,
    value: 2,
    quantity: 3,
};

const renderModal = () => {
    const dispatch = vi.fn();
    useGameStateMock.mockReturnValue({
        state: {
            inventory: [longsword, leatherArmor, ironOre],
            party: [{ id: 'test-crafter', name: 'Test Crafter' }],
            characterSheetModal: { isOpen: false, character: null },
        },
        dispatch,
    });
    const view = render(<SalvageModal onClose={vi.fn()} />);
    return { dispatch, view };
};

describe('calculateSalvagePreview', () => {
    it('breaks a martial metal weapon down into iron scrap and leather strips', () => {
        const preview = calculateSalvagePreview(longsword);

        expect(preview.dc).toBe(12);
        expect(preview.skillName).toBe("Smith's Tools");
        // Salvage gold is 20% of item value: 15 gp -> 3 gp.
        expect(preview.baseGoldValue).toBe(3);
        expect(preview.yields.map(y => y.itemId)).toEqual(['iron_scrap', 'leather_strip']);
    });

    it('breaks light armor down with leather strips as the primary yield', () => {
        const preview = calculateSalvagePreview(leatherArmor);

        expect(preview.dc).toBe(11);
        expect(preview.skillName).toBe("Leatherworker's Tools");
        expect(preview.yields[0].itemId).toBe('leather_strip');
    });

    it('only ever names material ids that exist in CRAFTING_MATERIALS', () => {
        // ADD_ITEM silently drops unknown ids, so an id drift here would make
        // salvage appear to succeed while granting nothing.
        for (const item of [longsword, leatherArmor]) {
            for (const y of calculateSalvagePreview(item).yields) {
                expect(CRAFTING_MATERIALS[y.itemId]).toBeDefined();
            }
        }
    });
});

describe('SalvageModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Roll 13 vs DC 12: a plain success, below the DC+5 masterwork threshold,
        // so yields stay at their un-multiplied rolled amount.
        rollSkillMock.mockReturnValue(13);
        // Random at 0 pins every yield roll to its minimum quantity.
        vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('lists salvageable equipment and filters out raw reagents', () => {
        renderModal();

        expect(screen.getByRole('button', { name: /Longsword/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Leather Armor/ })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Iron Ore/ })).toBeNull();
    });

    it('shows the material preview for the item the player selects', () => {
        renderModal();

        // The first salvageable item is auto-selected.
        expect(screen.getByText(/DC 12 Smith's Tools/)).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /Leather Armor/ }));

        expect(screen.getByText(/DC 11 Leatherworker's Tools/)).toBeTruthy();
        expect(screen.getByText('2 GP')).toBeTruthy();
        expect(screen.getAllByText('Leather Strip').length).toBeGreaterThan(0);
    });

    it('dismantles the selected item: consumes it, adds materials, and credits scrap gold', () => {
        const { dispatch } = renderModal();

        fireEvent.click(screen.getByRole('button', { name: /Longsword/ }));
        fireEvent.click(screen.getByRole('button', { name: /Dismantle/ }));

        expect(dispatch).toHaveBeenCalledWith({
            type: 'REMOVE_ITEM',
            payload: { itemId: 'inv-longsword', count: 1 },
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'ADD_ITEM',
            payload: { itemId: 'iron_scrap', count: 1 },
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'ADD_ITEM',
            payload: { itemId: 'leather_strip', count: 1 },
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'MODIFY_GOLD',
            payload: { amount: 3 },
        });
        // 20 minutes of workshop time for one martial weapon.
        expect(dispatch).toHaveBeenCalledWith({
            type: 'ADVANCE_TIME',
            payload: { seconds: 20 * 60 },
        });
    });

    it('reports the recovered materials in the salvage log', () => {
        renderModal();

        fireEvent.click(screen.getByRole('button', { name: /Longsword/ }));
        fireEvent.click(screen.getByRole('button', { name: /Dismantle/ }));

        const log = screen.getByText(/Recent Salvage Log/).parentElement as HTMLElement;
        expect(within(log).getByText(/Longsword \(Success\)/)).toBeTruthy();
        expect(within(log).getByText(/Roll 13 vs DC 12/)).toBeTruthy();
        expect(within(log).getByText(/1x Iron Scrap/)).toBeTruthy();
        expect(within(log).getByText(/\+ 3 GP/)).toBeTruthy();
    });

    it('records a partial salvage when the crafter fails the check', () => {
        rollSkillMock.mockReturnValue(5);
        const { dispatch } = renderModal();

        fireEvent.click(screen.getByRole('button', { name: /Longsword/ }));
        fireEvent.click(screen.getByRole('button', { name: /Dismantle/ }));

        // Failure still returns half the primary scrap, but no gold.
        expect(dispatch).toHaveBeenCalledWith({
            type: 'ADD_ITEM',
            payload: { itemId: 'iron_scrap', count: 1 },
        });
        expect(dispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'MODIFY_GOLD' }),
        );
        expect(screen.getByText(/Longsword \(Partial Salvage\)/)).toBeTruthy();
    });
});
