import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useActionGeneration } from '../../../hooks/useActionGeneration';
import { Location, NPC, Item } from '../../../types';

describe('useActionGeneration', () => {
    const mockLocation: Location = {
        id: 'loc_1',
        name: 'Test Location',
        description: 'A test location.',
        exits: {
            North: 'loc_2',
            East: { targetId: 'loc_3', isHidden: false }
        },
        biomeId: 'plains',
        mapCoordinates: { x: 0, y: 0 }
    };

    const mockNPCs: NPC[] = [
        { id: 'npc_1', name: 'Bob', type: 'human', locationId: 'loc_1' } as any
    ];

    const mockItems: Item[] = [
        { id: 'item_1', name: 'Sword', type: 'weapon', locationId: 'loc_1' } as any
    ];

    it('generates talk actions for NPCs', () => {
        const { result } = renderHook(() => useActionGeneration({
            currentLocation: mockLocation,
            npcsInLocation: mockNPCs,
            itemsInLocation: [],
        }));

        const talkAction = result.current.find(a => a.type === 'talk');
        expect(talkAction).toBeDefined();
        expect(talkAction?.label).toContain('Bob');
        expect(talkAction?.targetId).toBe('npc_1');
    });

    it('generates take actions for items', () => {
        const { result } = renderHook(() => useActionGeneration({
            currentLocation: mockLocation,
            npcsInLocation: [],
            itemsInLocation: mockItems,
        }));

        const takeAction = result.current.find(a => a.type === 'take_item');
        expect(takeAction).toBeDefined();
        expect(takeAction?.label).toContain('Sword');
        expect(takeAction?.targetId).toBe('item_1');
    });

    it('generates move actions for special exits', () => {
        const locationWithSpecialExit: Location = {
            ...mockLocation,
            exits: {
                ...mockLocation.exits,
                'Secret Passage': 'loc_secret'
            }
        };

        const { result } = renderHook(() => useActionGeneration({
            currentLocation: locationWithSpecialExit,
            npcsInLocation: [],
            itemsInLocation: [],
        }));

        const moveAction = result.current.find(a => a.label === 'Go Secret Passage');
        expect(moveAction).toBeDefined();
        expect(moveAction?.targetId).toBe('loc_secret');
    });

    it('generates village entry actions for Town locations', () => {
        const townLocation: Location = {
            ...mockLocation,
            name: 'Small Town',
            id: 'town_1'
        };

        const { result } = renderHook(() => useActionGeneration({
            currentLocation: townLocation,
            npcsInLocation: [],
            itemsInLocation: [],
        }));

        expect(result.current.some(a => a.type === 'ENTER_VILLAGE')).toBe(true);
        expect(result.current.some(a => a.type === 'OBSERVE_TOWN')).toBe(true);
    });
});
