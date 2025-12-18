
import { describe, it, expect } from 'vitest';
import { createAlias, switchToPersona, donDisguise, getCurrentIdentity, getCurrentStandings, calculateDetectionRisk } from '../identityService';
import { PlayerIdentityState } from '../../types/identity';
import { PlayerFactionStanding } from '../../types/factions';

const mockIdentityState: PlayerIdentityState = {
    characterId: 'player',
    trueIdentity: {
        id: 'player_true',
        name: 'Hero',
        type: 'true',
        history: 'A hero.',
        fame: 10
    },
    activeDisguise: null,
    currentPersonaId: 'player_true',
    aliases: [],
    knownSecrets: [],
    exposedSecrets: []
};

const mockGlobalStandings: Record<string, PlayerFactionStanding> = {
    'faction_a': { factionId: 'faction_a', publicStanding: 50, secretStanding: 50, rankId: 'member', favorsOwed: 0, renown: 10 }
};

describe('IdentityService', () => {
    it('should create aliases correctly', () => {
        const alias = createAlias('alias_1', 'The Shadow', 'A mysterious rogue.');
        expect(alias.id).toBe('alias_1');
        expect(alias.name).toBe('The Shadow');
        expect(alias.standings).toEqual({});
        expect(alias.credibility).toBe(50);
    });

    it('should switch personas', () => {
        const alias = createAlias('alias_1', 'The Shadow', 'Backstory');
        const stateWithAlias = { ...mockIdentityState, aliases: [alias] };

        const newState = switchToPersona(stateWithAlias, 'alias_1');
        expect(newState.currentPersonaId).toBe('alias_1');

        const backToTrue = switchToPersona(newState, 'player_true');
        expect(backToTrue.currentPersonaId).toBe('player_true');
    });

    it('should fail gracefully when switching to invalid persona', () => {
        const newState = switchToPersona(mockIdentityState, 'non_existent_alias');
        expect(newState.currentPersonaId).toBe('player_true'); // Should remain unchanged
    });

    it('should don and doff disguises', () => {
        const disguise = { id: 'd1', targetAppearance: 'Guard', quality: 15, vulnerabilities: [] };
        const donned = donDisguise(mockIdentityState, disguise);
        expect(donned.activeDisguise).toEqual(disguise);
        expect(donned.activeDisguise?.targetAppearance).toBe('Guard');
    });

    it('should retrieve effective identity', () => {
        const alias = createAlias('alias_1', 'The Shadow', 'Backstory');
        const stateWithAlias = { ...mockIdentityState, aliases: [alias], currentPersonaId: 'alias_1' };

        const identity = getCurrentIdentity(stateWithAlias);
        expect(identity.name).toBe('The Shadow');
        expect(identity.type).toBe('alias');
    });

    it('should retrieve correct standings for persona', () => {
        // Setup alias with specific standing
        const alias = createAlias('alias_1', 'The Shadow', 'Backstory');
        alias.standings['faction_b'] = { factionId: 'faction_b', publicStanding: -20, secretStanding: -20, rankId: 'outsider', favorsOwed: 0, renown: 0 };

        const stateWithAlias = { ...mockIdentityState, aliases: [alias], currentPersonaId: 'alias_1' };

        // Test Alias Standings
        const aliasStandings = getCurrentStandings(stateWithAlias, mockGlobalStandings);
        expect(aliasStandings['faction_b'].publicStanding).toBe(-20);
        expect(aliasStandings['faction_a']).toBeUndefined(); // Alias doesn't know faction_a yet

        // Test True Identity Standings
        const stateTrue = { ...stateWithAlias, currentPersonaId: 'player_true' };
        const trueStandings = getCurrentStandings(stateTrue, mockGlobalStandings);
        expect(trueStandings['faction_a'].publicStanding).toBe(50);
        expect(trueStandings['faction_b']).toBeUndefined();
    });

    it('should calculate detection risk correctly', () => {
        const alias = createAlias('alias_1', 'The Shadow', 'Backstory', 50); // 50 credibility

        // Scenario 1: Alias with NO disguise (High Risk)
        let state = { ...mockIdentityState, aliases: [alias], currentPersonaId: 'alias_1' };
        let risk = calculateDetectionRisk(state);
        // Base 0.5 - (50/100 * 0.4) + 0.3 (no disguise) = 0.5 - 0.2 + 0.3 = 0.6
        expect(risk).toBeCloseTo(0.6);

        // Scenario 2: Alias WITH poor disguise
        const poorDisguise = { id: 'd1', targetAppearance: 'Peasant', quality: 5, vulnerabilities: [] };
        state = donDisguise(state, poorDisguise);
        risk = calculateDetectionRisk(state);
        // Base 0.5 - 0.2 (cred) - (5/50) (quality) = 0.5 - 0.2 - 0.1 = 0.2
        expect(risk).toBeCloseTo(0.2);

        // Scenario 3: True Identity (Zero Risk)
        state = { ...state, currentPersonaId: 'player_true' };
        risk = calculateDetectionRisk(state);
        expect(risk).toBe(0.0);
    });
});
