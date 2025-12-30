
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as GeminiService from '../geminiService';
import { ai } from '../aiClient';
// TODO(lint-intent): 'getFallbackEncounter' is unused in this test; use it in the assertion path or remove it.
import { getFallbackEncounter as _getFallbackEncounter } from '../geminiServiceFallback';
import { MONSTERS_DATA } from '../../constants';

// Mock the AI client
vi.mock('../aiClient', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
  isAiEnabled: vi.fn(() => true),
}));

// Mock logger to avoid console spam
vi.mock('../../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('GeminiService - generateEncounter Fallback', () => {
  const mockParty = [{ id: '1', level: 1, classId: 'fighter' }];
  const xpBudget = 100;
  const themeTags = ['goblinoid'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use fallback encounter when AI generation fails', async () => {
    // Mock AI failure
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    (ai.models.generateContent as unknown).mockRejectedValue(new Error('AI Service Down'));
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    const result = await GeminiService.generateEncounter(xpBudget, themeTags, mockParty as unknown);

    // Verify fallback mechanism was used
    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data?.encounter).toBeDefined();
    expect(result.data?.encounter.length).toBeGreaterThan(0);

    // Check if the returned monster is one of the valid goblinoids (Orc, Goblin, Bugbear)
    // We check against the names in MONSTERS_DATA which have 'goblinoid' tag.
    const validNames = Object.values(MONSTERS_DATA)
        .filter(m => m.tags?.includes('goblinoid'))
        .map(m => m.name.toLowerCase());

    const returnedMonsterName = result.data?.encounter[0].name.toLowerCase();

    // Note: The fallback logic might return "Orc" even if we wanted "Goblin" because "Orc" fits the XP budget.
    // So we just verify it returned a valid fallback option.
    const isKnownGoblinoid = validNames.some(name => returnedMonsterName?.includes(name));

    expect(isKnownGoblinoid).toBe(true);

    // Check metadata indicates fallback
    expect(result.metadata?.rawResponse).toContain('Fallback used');
  });

  it('should use fallback encounter when AI returns malformed JSON', async () => {
    // Mock AI returning bad JSON
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    (ai.models.generateContent as unknown).mockResolvedValue({
      text: 'This is not JSON',
    });
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    const result = await GeminiService.generateEncounter(xpBudget, themeTags, mockParty as unknown);

    expect(result.error).toBeNull();
    expect(result.data?.encounter).toBeDefined();
    expect(result.data?.encounter.length).toBeGreaterThan(0);
    expect(result.metadata?.rawResponse).toContain('Fallback used');
  });
});
