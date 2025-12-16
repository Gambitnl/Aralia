
import { describe, it, expect } from 'vitest';
import { generateBattleSetup } from '../useBattleMapGeneration';
import { createMockCombatCharacter } from '../../utils/factories';

describe('useBattleMapGeneration', () => {
    it('should be deterministic when given the same seed', () => {
        const seed = 12345;
        const characters = [
            createMockCombatCharacter({ id: 'hero', team: 'player' }),
            createMockCombatCharacter({ id: 'enemy', team: 'enemy' })
        ];

        // Run 1
        const result1 = generateBattleSetup('forest', seed, characters);
        const positions1 = result1.positionedCharacters.map(c => c.position);

        // Run 2
        const result2 = generateBattleSetup('forest', seed, characters);
        const positions2 = result2.positionedCharacters.map(c => c.position);

        expect(positions1).toEqual(positions2);
    });

    it('should be deterministic across multiple runs with shuffle', () => {
        const seed = 67890;
        const characters = [
            createMockCombatCharacter({ id: 'p1', team: 'player' }),
            createMockCombatCharacter({ id: 'p2', team: 'player' }),
            createMockCombatCharacter({ id: 'e1', team: 'enemy' }),
            createMockCombatCharacter({ id: 'e2', team: 'enemy' })
        ];

        const results = new Set<string>();

        // Run 10 times, all should yield exactly the same positions
        for (let i = 0; i < 10; i++) {
            const result = generateBattleSetup('dungeon', seed, characters);
            const posString = JSON.stringify(result.positionedCharacters.map(c => c.position));
            results.add(posString);
        }

        expect(results.size).toBe(1);
    });
});
