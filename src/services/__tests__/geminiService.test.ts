import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as geminiService from '../geminiService';
import { ai } from '../aiClient';

// Mock the AI client
vi.mock('../aiClient', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
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

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateMerchantInventory', () => {
    it('should return fallback inventory when JSON parsing fails', async () => {
      const mockGenerateContent = ai.models.generateContent as any;
      mockGenerateContent.mockResolvedValue({
        text: 'This is not JSON',
      });

      const result = await geminiService.generateMerchantInventory(undefined, 'General Store');

      // Desired behavior: Data is not null, contains fallback items
      expect(result.data).not.toBeNull();
      expect(result.data?.inventory.length).toBeGreaterThan(0);
      expect(result.error).toContain('Failed to parse inventory JSON');
    });
  });

  describe('generateSocialCheckOutcome', () => {
    it('should return fallback outcome when JSON parsing fails', async () => {
      const mockGenerateContent = ai.models.generateContent as any;
      mockGenerateContent.mockResolvedValue({
        text: 'Invalid JSON',
      });

      const result = await geminiService.generateSocialCheckOutcome('Persuasion', 'Guard', true, 'Context');

      // Desired behavior: Data is not null, contains fallback text
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

      // Desired behavior: Data is not null, contains fallback actions
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

      // Desired behavior: Data is not null, contains empty or fallback items
      expect(result.data).not.toBeNull();
      expect(result.data?.items).toBeDefined();
      expect(result.error).toContain('Failed to parse harvest JSON');
    });
  });
});
