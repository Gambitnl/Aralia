import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSkeleton, generateSoul, generateCompanion } from '../CompanionGenerator';
import { PlayerCharacter } from '../../types';
import * as characterGenerator from '../characterGenerator';

const mockSoul = {
    name: 'Kaelen',
    physicalDescription: 'A tall figure with sharp eyes and a cynical smirk always present.',
    personality: {
        values: ['survival', 'pragmatism', 'wealth'],
        fears: ['betrayal', 'confinement'],
        quirks: ['taps fingers when impatient', 'collects shiny rocks']
    },
    goals: [
        { description: 'Publicly, I seek to make a name for myself as a reliable sellsword.', isSecret: false },
        { description: 'Secretly, I need to pay off a massive debt to a dangerous thieves guild.', isSecret: true }
    ],
    reactionStyle: 'cynical' as const
};

vi.mock('../ollama/client', () => {
    return {
        OllamaClient: class MockOllamaClient {
            getModel() {
                return Promise.resolve('test-model');
            }
            generate() {
                // Simulate the JSON being embedded in the response string
                return Promise.resolve({ ok: true, data: { response: `\`\`\`json\n${JSON.stringify(mockSoul)}\n\`\`\`` } });
            }
        },
    };
});


describe('CompanionGenerator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateSkeleton', () => {
        it('should call generateCharacterFromConfig and return its result', () => {
            const mockSkeleton = { id: 'test-skeleton' } as PlayerCharacter;
            const spy = vi.spyOn(characterGenerator, 'generateCharacterFromConfig').mockReturnValue(mockSkeleton);

            const config = { level: 1, classId: 'fighter', raceId: 'human' };
            const result = generateSkeleton(config);

            expect(spy).toHaveBeenCalledWith({
                name: "Generated Character",
                raceId: 'human',
                classId: 'fighter'
            });
            expect(result).toBe(mockSkeleton);
        });
    });

    describe('generateSoul', () => {
        it('should return a valid soul after a successful API call', async () => {
            const skeleton = { race: { name: 'Human', id: 'human' }, class: { name: 'Fighter', id: 'fighter' } } as PlayerCharacter;
            const soul = await generateSoul(skeleton);
            expect(soul).toEqual(mockSoul);
        });
    });

    describe('generateCompanion', () => {
        it('should return a full companion by combining a skeleton and a soul', async () => {
            const mockSkeleton: PlayerCharacter = {
                id: 'skel-1',
                name: 'Generated Character',
                race: { id: 'human', name: 'Human', traits: [] } as any,
                class: { id: 'fighter', name: 'Fighter' } as any,
                abilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
                finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
                skills: [], hp: 10, maxHp: 10, armorClass: 10, speed: 30, darkvisionRange: 0, transportMode: 'foot',
                statusEffects: [], equippedItems: {},
            };
            vi.spyOn(characterGenerator, 'generateCharacterFromConfig').mockReturnValue(mockSkeleton);

            const config = { level: 1, classId: 'fighter', raceId: 'human' };
            const companion = await generateCompanion(config);

            expect(companion).not.toBeNull();
            expect(companion?.name).toBe(mockSoul.name);
            expect(companion?.soul).toEqual(mockSoul);
            // Check that skeleton properties are preserved
            expect(companion?.id).toBe('skel-1');
            expect(companion?.race.id).toBe('human');
            expect(companion?.class.id).toBe('fighter');
        });
    });
});
