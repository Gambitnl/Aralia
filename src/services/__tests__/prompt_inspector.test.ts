import { describe, it, expect, vi } from 'vitest';
import * as geminiService from '../geminiService';
import { ai } from '../aiClient';
import { GameState, PlayerCharacter, Location } from '../../types';
import * as contextUtils from '../../utils/contextUtils';

// Mock the AI client
vi.mock('../aiClient', () => ({
  ai: {
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: 'Mocked AI response',
      }),
    },
  },
  isAiEnabled: vi.fn().mockReturnValue(true),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Prompt Inspection', () => {
  const mockPlayer: PlayerCharacter = {
    id: 'p1',
    name: 'Kaelen',
    race: { id: 'human', name: 'Human' } as unknown as PlayerCharacter['race'],
    class: { id: 'fighter', name: 'Fighter', hitDie: 10 } as unknown as PlayerCharacter['class'],
    hp: 10,
    maxHp: 10,
    abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    finalAbilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    skills: [],
    inventory: [],
    conditions: [],
    armorClass: 10,
  } as unknown as PlayerCharacter;

  const mockLocation: Location = {
    id: 'loc1',
    name: 'The Rusty Anchor',
    biomeId: 'city',
    baseDescription: 'A tavern.',
    exits: {},
  };

  const mockGameState: GameState = {
    id: 'g1',
    currentPlayerId: 'p1',
    players: { 'p1': mockPlayer },
    gameTime: new Date(1234567890000), // Fix: Use Date object
    activeRumors: [],
    questLog: [
      {
        id: 'q1',
        title: 'Find the spy',
        description: 'Locate the spy in the tavern.',
        status: 'Active',
        objectives: [
           { id: 'o1', description: 'Ask around The Rusty Anchor', isCompleted: false }
        ]
      }
    ],
    messages: [
      { id: 'm1', sender: 'system', text: 'Welcome.', timestamp: new Date(1000) },
      { id: 'm2', sender: 'player', text: 'I look around.', timestamp: new Date(2000) },
      { id: 'm3', sender: 'npc', text: 'What do you want?', timestamp: new Date(3000) },
    ]
  } as unknown as GameState;

  it('inspects generateActionOutcome prompt', async () => {
    const context = contextUtils.generateGeneralActionContext({
        gameState: mockGameState,
        playerCharacter: mockPlayer,
        currentLocation: mockLocation,
        npcsInLocation: []
    });

    const playerAction = 'I listen closely to the patrons.';

    await geminiService.generateActionOutcome(playerAction, context);
    const generateContentMock = ai.models.generateContent as unknown as ReturnType<typeof vi.fn>;
    const callArgs = generateContentMock.mock.calls[0][0];

    console.log('\n--- SYSTEM INSTRUCTION ---\n');
    console.log(JSON.stringify(callArgs.config.systemInstruction, null, 2));

    console.log('\n--- PROMPT CONTENT ---\n');
    console.log(callArgs.contents);

    expect(true).toBe(true);
  });
});
