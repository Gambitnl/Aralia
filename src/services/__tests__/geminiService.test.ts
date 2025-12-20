import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as geminiService from '../geminiService';
import { ai, isAiEnabled } from '../aiClient';

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
vi.mock('../utils/logger', () => ({
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

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAiEnabled).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateMerchantInventory', () => {
    it('should return fallback inventory when JSON parsing fails', async () => {
      const mockGenerateContent = ai.models.generateContent as any;
      mockGenerateContent.mockResolvedValue({
        text: 'This is not JSON',
      });

      const result = await geminiService.generateMerchantInventory(undefined, 'General Store');

      expect(result.data).not.toBeNull();
      expect(result.data?.inventory.length).toBeGreaterThan(0);
      expect(result.error).toContain('Failed to parse inventory JSON');
    });

    it('varies fallback inventory when a seed key is provided', async () => {
      const mockGenerateContent = ai.models.generateContent as any;
      mockGenerateContent.mockResolvedValue({
        text: 'This is not JSON',
      });

      const a = await geminiService.generateMerchantInventory(undefined, 'HOUSE_SMALL', null, 'seed-a');
      const b = await geminiService.generateMerchantInventory(undefined, 'HOUSE_SMALL', null, 'seed-b');

      const namesA = (a.data?.inventory ?? []).map(i => i.name);
      const namesB = (b.data?.inventory ?? []).map(i => i.name);

      expect(namesA.length).toBeGreaterThan(2);
      expect(namesB.length).toBeGreaterThan(2);
      expect(namesA.join('|')).not.toEqual(namesB.join('|'));
    });
  });

  describe('generateSocialCheckOutcome', () => {
    it('should return fallback outcome when JSON parsing fails', async () => {
      const mockGenerateContent = ai.models.generateContent as any;
      mockGenerateContent.mockResolvedValue({
        text: 'Invalid JSON',
      });

      const result = await geminiService.generateSocialCheckOutcome('Persuasion', 'Guard', true, 'Context');

      expect(result.data).not.toBeNull();
      expect(result.data?.outcomeText).toBeDefined();
      expect(result.data?.dispositionChange).toBeDefined();
      expect(result.error).toContain('Failed to parse social outcome JSON');
    });
  });

    describe('generateCustomActions', () => {
    it('should return fallback actions when JSON parsing fails', async () => {
      const mockGenerateContent = ai.models.generateContent as any;
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
      const mockGenerateContent = ai.models.generateContent as any;
      mockGenerateContent.mockResolvedValue({
        text: 'Invalid JSON',
      });

      const result = await geminiService.generateHarvestLoot('Bush', 'Forest', 15);

      expect(result.data).not.toBeNull();
      expect(result.data?.items).toBeDefined();
      expect(result.error).toContain('Failed to parse harvest JSON');
    });
  });

  describe('AI Disabled State', () => {
    it('should return error gracefully when AI is disabled', async () => {
      vi.mocked(isAiEnabled).mockReturnValue(false);

      const result = await geminiService.generateText('test');

      expect(result.data).toBeNull();
      expect(result.error).toContain('Gemini API disabled');
      expect(ai.models.generateContent).not.toHaveBeenCalled();
    });
  });

  // WARDEN - TIMEOUT TEST
  describe('Timeout Handling', () => {
    it('should time out if the API call takes too long', async () => {
        vi.useFakeTimers();
        const mockGenerateContent = ai.models.generateContent as any;

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
        // Because we mocked GEMINI_TEXT_MODEL_FALLBACK_CHAIN to have only 1 model,
        // this single advance should trigger the timeout for that model,
        // causing the loop to finish and the function to return the error.
        vi.advanceTimersByTime(21000);

        // Await the result
        const result = await promise;

        // Check that we got the timeout error message
        expect(result.error).toContain('Request timed out');
    });
  });
});
