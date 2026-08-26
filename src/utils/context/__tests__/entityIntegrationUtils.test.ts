
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { resolveAndRegisterEntities } from '../entityIntegrationUtils';
import { EntityResolverService } from '../../../services/EntityResolverService';
import { GameState, Location, NPC } from '../../../types';
import { worldReducer } from '../../../state/reducers/worldReducer';
import { npcReducer } from '../../../state/reducers/npcReducer';
import type { AppAction } from '../../../state/actionTypes';

// NOTE: Mock path matches the specifier used by entityIntegrationUtils.
vi.mock('../../../services/EntityResolverService');

describe('resolveAndRegisterEntities', () => {
    let mockDispatch: Mock;
    let mockAddGeminiLog: Mock;
    let mockGameState: GameState;

    beforeEach(() => {
        mockDispatch = vi.fn();
        mockAddGeminiLog = vi.fn();
        mockGameState = {
            factions: {},
            dynamicLocations: {},
        } as unknown as GameState;

        vi.clearAllMocks();
    });

    it('should scan text and register new entities', async () => {
        const text = "You see the tower of Zalthor.";

        // Mock EntityResolverService to return a missing entity
        vi.mocked(EntityResolverService.resolveEntitiesInText).mockReturnValue([
            { type: 'location', normalizedName: 'Zalthor', originalText: 'Zalthor', exists: false, confidence: 1 }
        ]);

        // Mock ensureEntityExists to return a created entity
        const mockLocation = { id: 'zalthor', name: 'Zalthor' } as Location;
        vi.mocked(EntityResolverService.ensureEntityExists).mockResolvedValue({
            created: true,
            entity: mockLocation,
            type: 'location'
        });

        await resolveAndRegisterEntities(text, mockGameState, mockDispatch, mockAddGeminiLog);

        expect(EntityResolverService.resolveEntitiesInText).toHaveBeenCalledWith(text, mockGameState);
        expect(EntityResolverService.ensureEntityExists).toHaveBeenCalledWith('location', 'Zalthor', mockGameState);

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'REGISTER_DYNAMIC_ENTITY',
            payload: { entityType: 'location', entity: mockLocation }
        });

        expect(mockAddGeminiLog).toHaveBeenCalledWith(
            'EntityResolver',
            expect.stringContaining('Created new location: Zalthor'),
            expect.any(String)
        );
    });

    it('puts a newly created NPC on the current location roster and seeds a neutral relationship', async () => {
        const text = "A grizzled smith named Harl waves you over.";

        mockGameState = {
            factions: {},
            dynamicLocations: {
                testville: {
                    id: 'testville',
                    name: 'Testville',
                    baseDescription: 'A test town.',
                    exits: {},
                    itemIds: [],
                    npcIds: [],
                } as unknown as Location,
            },
            dynamicNPCs: {},
            npcMemory: {},
            currentLocationId: 'testville',
        } as unknown as GameState;

        const mockNpc = { id: 'harl', name: 'Harl' } as NPC;
        vi.mocked(EntityResolverService.resolveEntitiesInText).mockReturnValue([
            { type: 'npc', normalizedName: 'Harl', originalText: 'Harl', exists: false, confidence: 1 }
        ]);
        vi.mocked(EntityResolverService.ensureEntityExists).mockResolvedValue({
            created: true,
            entity: mockNpc,
            type: 'npc'
        });

        await resolveAndRegisterEntities(text, mockGameState, mockDispatch, mockAddGeminiLog);

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'LINK_NPC_TO_LOCATION',
            payload: { locationId: 'testville', npcId: 'harl' }
        });

        // Run the dispatched actions through the real reducers, as the store does.
        let state = mockGameState;
        for (const action of mockDispatch.mock.calls.map((c) => c[0] as AppAction)) {
            state = { ...state, ...worldReducer(state, action) };
            state = { ...state, ...npcReducer(state, action) };
        }

        expect(state.dynamicLocations['testville'].npcIds).toContain('harl');
        expect(state.npcMemory['harl']).toBeDefined();
        expect(state.npcMemory['harl'].disposition).toBe(0);
    });

    it('should do nothing if no entities need resolution', async () => {
        const text = "You look around.";
        vi.mocked(EntityResolverService.resolveEntitiesInText).mockReturnValue([]);

        await resolveAndRegisterEntities(text, mockGameState, mockDispatch, mockAddGeminiLog);

        expect(EntityResolverService.resolveEntitiesInText).toHaveBeenCalled();
        expect(EntityResolverService.ensureEntityExists).not.toHaveBeenCalled();
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
        const text = "Error causes this.";
        vi.mocked(EntityResolverService.resolveEntitiesInText).mockImplementation(() => {
            throw new Error("Test Error");
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await resolveAndRegisterEntities(text, mockGameState, mockDispatch, mockAddGeminiLog);

        expect(consoleSpy).toHaveBeenCalledWith("Entity Resolution Error:", expect.any(Error));
        expect(mockDispatch).not.toHaveBeenCalled();
    });
});
