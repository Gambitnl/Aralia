import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('aiClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize aiInstance when API_KEY is present', async () => {
    // Mock the env module relative to the TEST file
    vi.doMock('../../config/env', () => ({
      ENV: {
        API_KEY: 'test-api-key',
        BASE_URL: '/',
        DEV: true
      }
    }));

    // Import the module dynamically
    const aiClient = await import('../aiClient');

    expect(aiClient.isAiEnabled()).toBe(true);
    expect(() => aiClient.getAiClient()).not.toThrow();
    expect(aiClient.ai).toBeDefined();
  });

  it('should NOT initialize aiInstance when API_KEY is missing', async () => {
    vi.doMock('../../config/env', () => ({
      ENV: {
        API_KEY: '',
        BASE_URL: '/',
        DEV: true
      }
    }));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const aiClient = await import('../aiClient');

    expect(aiClient.isAiEnabled()).toBe(false);
    expect(() => aiClient.getAiClient()).toThrow("AI client is not initialized");
    expect(() => (aiClient.ai as unknown as { getGenerativeModel: () => void }).getGenerativeModel()).toThrow(/Gemini API Client accessed but not initialized/);

    consoleSpy.mockRestore();
  });
});
