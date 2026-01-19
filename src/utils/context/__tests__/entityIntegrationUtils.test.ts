
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { resolveAndRegisterEntities } from '../entityIntegrationUtils';
import { EntityResolverService } from '../../../services/EntityResolverService';
// TODO(lint-intent): 'Faction' is unused in this test; use it in the assertion path or remove it.
import { GameState, Location, Faction as _Faction, NPC as _NPC } from '../../../types';

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
