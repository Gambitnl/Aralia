
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as GeminiService from '../geminiService';
import { ai } from '../aiClient';

// Mock the AI client to prevent actual API calls
vi.mock('../aiClient', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
  isAiEnabled: vi.fn().mockReturnValue(true),
}));

// Mock logger to suppress console output during tests
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('GeminiService Context Integration', () => {
  const mockGenerateContent = ai.models.generateContent as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const richContextExample = `## PLAYER
Name: Hero (Human Fighter) | HP: 20/20 | Conditions: None

## LOCATION
Dark Forest (Forest) | Time: 11:30 PM (Night, Eerie silence)
Immediate Terrain: dense_trees | Feature: ancient_ruins

## NPCS
- Guide (Ranger): Friendly

## ACTIVE QUESTS
- **Find the Artifact**: Search the ruins.

## RECENT HISTORY
[System]: You entered the Dark Forest.
[Player]: Look around.`;

  it('generateLocationDescription should handle rich context and include it in the prompt', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'The ancient ruins loom in the darkness, illuminated only by the faint moonlight filtering through the dense canopy.',
    });

    const result = await GeminiService.generateLocationDescription(
      'Dark Forest',
      richContextExample,
      null
    );

    expect(result.data).toBeDefined();
    expect(result.data?.text).toContain('ancient ruins loom');

    // Verify the prompt sent to the AI includes the rich context
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptSent = callArgs.contents;

    expect(promptSent).toContain('## PLAYER');
    expect(promptSent).toContain('## LOCATION');
    expect(promptSent).toContain('Time: 11:30 PM');
    expect(promptSent).toContain('Find the Artifact');
  });

  it('generateWildernessLocationDescription should handle rich context and include it in the prompt', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Shadows dance among the trees as you approach the crumbling stone structures.',
    });

    const result = await GeminiService.generateWildernessLocationDescription(
      'Forest',
      { x: 10, y: 10 },
      { x: 5, y: 5 },
      richContextExample, // Passing rich context here
      'Tooltip info',
      null
    );

    expect(result.data).toBeDefined();

    // Verify the prompt sent to the AI includes the rich context logic
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptSent = callArgs.contents;

    expect(promptSent).toContain('Player enters a wilderness area.');
    expect(promptSent).toContain(richContextExample); // Should contain the full block
    expect(promptSent).toContain('Biome: Forest');
  });

  it('generateWildernessLocationDescription should fallback for legacy simple context', async () => {
     mockGenerateContent.mockResolvedValueOnce({
      text: 'A simple forest path.',
    });

    const simpleContext = "Hero, a Human Fighter";

    await GeminiService.generateWildernessLocationDescription(
      'Forest',
      { x: 10, y: 10 },
      { x: 5, y: 5 },
      simpleContext,
      'Tooltip info',
      null
    );

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptSent = callArgs.contents;

    // Should use the legacy prompt structure
    expect(promptSent).toContain('Player (Hero, a Human Fighter) has moved to a new spot.');
    expect(promptSent).not.toContain('## PLAYER');
  });
});
