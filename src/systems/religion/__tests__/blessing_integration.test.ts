// TODO(lint-intent): 'vi' is unused in this test; use it in the assertion path or remove it.
import { describe, it, expect, vi as _vi } from 'vitest';
import { religionReducer } from '../../../state/reducers/religionReducer';
// TODO(lint-intent): 'GameState' is unused in this test; use it in the assertion path or remove it.
import { GameState as _GameState } from '../../../types';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/factories';

describe('religionReducer - Blessings', () => {
    it('should grant a blessing and apply status effects when USE_TEMPLE_SERVICE is dispatched with a grant_blessing_ effect', () => {
        // Setup state
        const initialState = createMockGameState();
        const partyMember = createMockPlayerCharacter({ id: 'hero1' });
        initialState.party = [partyMember];
        initialState.gold = 1000;

        // Define action
        const action = {
            type: 'USE_TEMPLE_SERVICE' as const,
            payload: {
                templeId: 'temple_bahamut_generic',
                deityId: 'bahamut',
                cost: 25,
                effect: 'grant_blessing_scales_of_justice'
            }
        };

        // Execute reducer
        const newState = religionReducer(initialState, action);

        // Assertions

        // 1. Check Gold Deducted
        expect(newState.gold).toBe(975);

        // 2. Check Party Status Effect
        // The party member should now have a status effect
        const updatedParty = newState.party!;
        expect(updatedParty).toHaveLength(1);
        const hero = updatedParty[0];

        // Check that a status effect was added
        const blessingEffect = hero.statusEffects.find(e => e.name === 'Scales of Justice');
        expect(blessingEffect).toBeDefined();
        expect(blessingEffect?.type).toBe('buff');
        expect(blessingEffect?.effect.type).toBe('stat_modifier');
        expect(blessingEffect?.id).toContain('status_scales_of_justice');

        // 3. Check Favor History
        const favorRecord = newState.divineFavor?.bahamut;
        expect(favorRecord).toBeDefined();

        // Check that the blessing was added to the list
        const blessing = favorRecord?.blessings.find(b => b.id === 'blessing_scales_of_justice');
        expect(blessing).toBeDefined();
        expect(blessing?.name).toBe('Scales of Justice');

        // 4. Check Messages
        const messages = newState.messages || [];
        const lastMessage = messages[messages.length - 1];
        expect(lastMessage.text).toContain('You receive the blessing: Scales of Justice');
    });

    it('should handle generic minor blessing', () => {
         const initialState = createMockGameState();
        const partyMember = createMockPlayerCharacter({ id: 'hero1' });
        initialState.party = [partyMember];
        initialState.gold = 1000;

        const action = {
            type: 'USE_TEMPLE_SERVICE' as const,
            payload: {
                templeId: 'any_temple',
                deityId: 'bahamut', // Even generic needs a deity context for favor
                cost: 5,
                effect: 'grant_blessing_minor'
            }
        };

        const newState = religionReducer(initialState, action);

        const hero = newState.party![0];
        const effect = hero.statusEffects.find(e => e.name === 'Blessed');
        expect(effect).toBeDefined();
    });
});
