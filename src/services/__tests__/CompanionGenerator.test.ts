import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateSkeleton, generateSoul, generateCompanion } from '../CompanionGenerator';
import { PlayerCharacter } from '../../types';
import * as characterGenerator from '../characterGenerator';
import { RACE_NAMES } from '../../data/names/raceNames';

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

// agora-727a: lets the production-logging tests force a raw payload on the
// parse-failure path without re-mocking the module (soulCache is module-level,
// so each logging test also uses its own race-class cache key).
let overrideResponsePayload: string | null = null;

vi.mock('../ollama/client', () => {
    return {
        OllamaClient: class MockOllamaClient {
            getModel() {
                return Promise.resolve('test-model');
            }
            isAvailable() {
                return Promise.resolve(true);
            }
            generate() {
                if (overrideResponsePayload !== null) {
                    return Promise.resolve({ ok: true, data: { response: overrideResponsePayload } });
                }
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
        // agora-4c53: the skeleton is no longer built with the literal name
        // "Generated Character". generateNPC runs first and its race/gender-aware
        // name seeds the character config, so this asserts a real name from the
        // human name bank instead of the retired placeholder.
        it('should seed generateCharacterFromConfig with a race-appropriate name', () => {
            const mockSkeleton = { id: 'test-skeleton' } as PlayerCharacter;
            const spy = vi.spyOn(characterGenerator, 'generateCharacterFromConfig').mockReturnValue(mockSkeleton);

            const config = { level: 1, classId: 'fighter', raceId: 'human' };
            const result = generateSkeleton(config);

            expect(spy).toHaveBeenCalledTimes(1);
            const passedConfig = spy.mock.calls[0][0];
            expect(passedConfig.raceId).toBe('human');
            expect(passedConfig.classId).toBe('fighter');
            expect(passedConfig.name).not.toBe('Generated Character');

            const humanNames = RACE_NAMES.human;
            const [firstName, ...rest] = (passedConfig.name ?? '').split(' ');
            expect([...humanNames.male, ...humanNames.female]).toContain(firstName);
            expect(humanNames.surnames).toContain(rest.join(' '));

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

    // agora-727a: production must never log the raw companion model response
    // (user-specific generated text). The full dump is DEV-gated; these tests
    // stub import.meta.env.DEV=false and prove no log call carries response
    // content on either the success or the parse-failure path, while concise
    // attempt diagnostics still fire.
    describe('production response logging (agora-727a)', () => {
        let logSpy: ReturnType<typeof vi.spyOn>;
        let errorSpy: ReturnType<typeof vi.spyOn>;
        let alertSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            vi.stubEnv('DEV', false);
            logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        });

        afterEach(() => {
            vi.unstubAllEnvs();
            overrideResponsePayload = null;
            logSpy.mockRestore();
            errorSpy.mockRestore();
            alertSpy.mockRestore();
        });

        const loggedLines = () =>
            [...logSpy.mock.calls, ...errorSpy.mock.calls].map(call => call.map((arg: unknown) => String(arg)).join(' '));

        it('does not log raw response content on a successful generation', async () => {
            // Distinct cache key so the module-level soulCache cannot short-circuit the call.
            const skeleton = { race: { name: 'Dwarf', id: 'dwarf' }, class: { name: 'Cleric', id: 'cleric' } } as PlayerCharacter;
            const soul = await generateSoul(skeleton);
            expect(soul).toEqual(mockSoul); // behavior preserved
            const allLogged = loggedLines();
            expect(allLogged.some(line => line.includes('Raw Output'))).toBe(false);
            expect(allLogged.some(line => line.includes(mockSoul.physicalDescription))).toBe(false);
            expect(allLogged.some(line => line.includes(mockSoul.name))).toBe(false);
            // Concise attempt diagnostic is still emitted, bounded and content-free.
            expect(allLogged.some(line => /Attempt 1 received response \(\d+ chars\)/.test(line))).toBe(true);
        });

        it('does not log raw response content when parsing fails on every attempt', async () => {
            overrideResponsePayload = 'SECRET-SOUL-DUMP not json at all';
            const skeleton = { race: { name: 'Tiefling', id: 'tiefling' }, class: { name: 'Wizard', id: 'wizard' } } as PlayerCharacter;
            const soul = await generateSoul(skeleton);
            expect(soul).toBeNull();
            const allLogged = loggedLines();
            expect(allLogged.some(line => line.includes('SECRET-SOUL-DUMP'))).toBe(false);
            expect(allLogged.some(line => line.includes('Raw Output'))).toBe(false);
            // Retry behavior preserved: three attempts, each with concise diagnostics only.
            expect(alertSpy.mock.calls.length).toBe(3);
            expect(allLogged.filter(line => /JSON Parsing Failed/.test(line)).length).toBe(3);
        });
    });
});
