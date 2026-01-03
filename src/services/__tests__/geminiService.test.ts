import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as geminiService from '../geminiService';
import { ai, isAiEnabled } from '../aiClient';
import { EconomyState, SuspicionLevel, VillageActionContext } from '../../types';
import type { NPCMemory } from '../../types/memory';

// Mock the AI client
vi.mock('../aiClient', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
  // Default to enabled for most tests
  isAiEnabled: vi.fn().mockReturnValue(true),
}));

// Mock logger to avoid noise
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock configuration to have a single model in the chain to simplify timeout testing
// Correct path relative to this test file: ../../config/geminiConfig
vi.mock('../../config/geminiConfig', () => ({
  GEMINI_TEXT_MODEL_FALLBACK_CHAIN: ['gemini-test-model'],
  FAST_MODEL: 'gemini-test-model',
  COMPLEX_MODEL: 'gemini-test-model',
}));

// TODO(2026-01-03 Codex-CLI): Centralize AI client mocks to a helper once more service tests are added.
type VitestMock = ReturnType<typeof vi.fn>;
const mockGenerateContent = ai.models.generateContent as unknown as VitestMock; 

const stubEconomy: EconomyState = {
  marketEvents: [],
  tradeRoutes: [],
  globalInflation: 0,
  regionalWealth: {},
  marketFactors: { scarcity: [], surplus: [] },
  buyMultiplier: 1,
  sellMultiplier: 1,
  activeEvents: [],
};

const stubNpcMemory: NPCMemory = {
  // TODO(2026-01-03 pass 2 Codex-CLI): NPCMemory is richer in runtime; minimal stub with cast keeps social checks testable.
  interactions: [],
  knownFacts: [],
  attitude: 'neutral' as any,
  discussedTopics: [],
  goals: [],
  lastInteractionDate: null as any,
  facts: [],
} as unknown as NPCMemory;

const stubVillageContext: VillageActionContext = {
  worldX: 0,
  worldY: 0,
  biomeId: 'plains',
  buildingType: 'house_small',
  description: 'Test village context',
  integrationProfileId: 'profile-test',
  integrationPrompt: '',
  integrationTagline: '',
  culturalSignature: '',
  encounterHooks: [],
};

// We need to mock withRetry to avoid its own timer logic interfering with the timeout test.
// We want to test the timeout in `generateText` in isolation from the retry logic.
vi.mock('../../utils/networkUtils', async () => {
  const mod = await vi.importActual<typeof import('../../utils/networkUtils')>('../../utils/networkUtils');
  return {
    // Keep original exports
    ...mod,
    // TODO(2026-01-03 pass 1 Codex-CLI): withRetry is overridden to drop timer logic for deterministic tests; restore real retry semantics once test harness can await them.
    withRetry: vi.fn().mockImplementation((fn, _options) => fn()),
  };
});


describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAiEnabled).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateMerchantInventory', () => {
    const mockContext = "World is at peace.";

    it('should return fallback inventory when JSON parsing fails', async () => {
      // TODO(2026-01-03 Codex-CLI): Replace any with typed StandardizedResult once gemini client mocks are formalized.
      mockGenerateContent.mockResolvedValue({
        text: 'This is not JSON',
      });

    const result = await geminiService.generateMerchantInventory('general', 'General Store', stubEconomy, mockContext);

      expect(result.data).not.toBeNull();
      expect(result.data?.inventory.length).toBeGreaterThan(0);
      expect(result.error).toContain('Failed to parse inventory JSON');
    });

    it('varies fallback inventory when a seed key is provided', async () => {
      // TODO(2026-01-03 Codex-CLI): Replace any with typed StandardizedResult once gemini client mocks are formalized.
      mockGenerateContent.mockResolvedValue({
        text: 'This is not JSON',
      });

      const a = await geminiService.generateMerchantInventory('general', 'HOUSE_SMALL', stubEconomy, mockContext, 'seed-a');
      const b = await geminiService.generateMerchantInventory('general', 'HOUSE_SMALL', stubEconomy, mockContext, 'seed-b');

      const namesA = (a.data?.inventory ?? []).map(i => i.name);
      const namesB = (b.data?.inventory ?? []).map(i => i.name);

      expect(namesA.length).toBeGreaterThan(2);
      expect(namesB.length).toBeGreaterThan(2);
      expect(namesA.join('|')).not.toEqual(namesB.join('|'));
    });
  });

  describe('generateSocialCheckOutcome', () => {
    it('should return fallback outcome when JSON parsing fails', async () => {
      // TODO(2026-01-03 Codex-CLI): Replace any with typed StandardizedResult once gemini client mocks are formalized.
      mockGenerateContent.mockResolvedValue({
        text: 'Invalid JSON',
      });

      const result = await geminiService.generateSocialCheckOutcome(stubNpcMemory, stubVillageContext, 'Guard', 'Context');

      expect(result.data).not.toBeNull();
      expect(result.data?.outcomeText).toBeDefined();
      expect(result.data?.dispositionChange).toBeDefined();
      expect(result.error).toContain('Failed to parse social outcome JSON');
    });
  });

    describe('generateCustomActions', () => {
    it('should return fallback actions when JSON parsing fails', async () => {
      // TODO(2026-01-03 Codex-CLI): Replace any with typed StandardizedResult once gemini client mocks are formalized.
      mockGenerateContent.mockResolvedValue({
        text: 'Invalid JSON',
      });

      const result = await geminiService.generateCustomActions('Scene', 'Context');

      expect(result.data).not.toBeNull();
      expect(result.data?.actions).toBeDefined();
      expect(result.data?.actions.length).toBeGreaterThan(0);
      expect(result.error).toContain('Failed to parse custom actions JSON');
    });
  });

    describe('generateHarvestLoot', () => {
    it('should return empty/fallback loot when JSON parsing fails', async () => {
      // TODO(2026-01-03 Codex-CLI): Replace any with typed StandardizedResult once gemini client mocks are formalized.
      mockGenerateContent.mockResolvedValue({
        text: 'Invalid JSON',
      });

      const result = await geminiService.generateHarvestLoot('Bush', 'Forest');

      expect(result.data).not.toBeNull();
      expect(result.data?.items).toBeDefined();
      expect(result.error).toContain('Failed to parse harvest JSON');
    });
  });

  describe('AI Disabled State', () => {
    it('should return error gracefully when AI is disabled', async () => {
      vi.mocked(isAiEnabled).mockReturnValue(false);

      const result = await geminiService.generateText('test', undefined, false, 'test-disabled');

      expect(result.data).toBeNull();
      expect(result.error).toContain('Gemini API disabled');
      expect(ai.models.generateContent).not.toHaveBeenCalled();
    });
  });

  // WARDEN - TIMEOUT TEST
  describe('Timeout Handling', () => {
    it('should time out if the API call takes too long', async () => {
        vi.useFakeTimers();
        // TODO(2026-01-03 Codex-CLI): Replace any with the minimal test shape so the behavior stays explicit.

        // Mock implementation that never resolves (hangs)
        mockGenerateContent.mockImplementation(() => new Promise(() => {}));

        // Start the call
        const promise = geminiService.generateText(
          'test prompt',
          undefined,
          false,
          'testTimeout'
        );

        // Fast-forward time past the 20s timeout.
        // Using the async version allows the promise rejection from the timeout
        // to be processed, preventing the test from hanging.
        await vi.advanceTimersByTimeAsync(21000);

        // Await the result
        const result = await promise;

        // Check that we got the exact timeout error message
        expect(result.error).toContain('Request timed out after 20000ms');
    });
  });
});
