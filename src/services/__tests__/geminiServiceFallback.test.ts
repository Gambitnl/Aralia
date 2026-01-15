
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as GeminiService from '../geminiService';
import { ai } from '../aiClient';
import { TempPartyMember } from '../../types';
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
  // TODO(2026-01-03 pass 1 Codex-CLI): TempPartyMember minimal stub; expand with HP/equipment if encounter generation starts using them.
  const mockParty: TempPartyMember[] = [{
    id: '1',
    name: 'Test Fighter', // TempPartyMember requires a display name.
    level: 1,
    classId: 'fighter',
  }];

  const mockGenerateContent = ai.models.generateContent as unknown as ReturnType<typeof vi.fn>;
  const xpBudget = 100;
  const themeTags = ['goblinoid'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use fallback encounter when AI generation fails', async () => {    
    // Mock AI failure
    // TODO(2026-01-03 pass 2 Codex-CLI): Replace broad mocks with typed StandardizedResult once helpers exist.
    mockGenerateContent.mockRejectedValue(new Error('AI Service Down'));        
    const result = await GeminiService.generateEncounter(xpBudget, themeTags, mockParty);

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
    const meta = result.metadata as { rawResponse?: string } | undefined;
    // TODO(2026-01-03 pass 2 Codex-CLI): StandardizedResult metadata is typed loosely; cast until a shared test helper shapes it.
    expect(meta?.rawResponse).toContain('Fallback used');
  });

  it('should use fallback encounter when AI returns malformed JSON', async () => {
    // Mock AI returning bad JSON
    // TODO(2026-01-03 pass 2 Codex-CLI): Replace any with the minimal test shape so the behavior stays explicit.
    mockGenerateContent.mockResolvedValue({
      text: 'This is not JSON',
    });
    const result = await GeminiService.generateEncounter(xpBudget, themeTags, mockParty);

    expect(result.error).toBeNull();
    expect(result.data?.encounter).toBeDefined();
    expect(result.data?.encounter.length).toBeGreaterThan(0);
    const meta = result.metadata as { rawResponse?: string } | undefined;
    expect(meta?.rawResponse).toContain('Fallback used');
  });
});
