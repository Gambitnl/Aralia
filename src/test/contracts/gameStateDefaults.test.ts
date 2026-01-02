import { describe, it, expect } from 'vitest';
import { createMockGameState } from '@/utils/core/factories';

describe('contract: game state defaults', () => {
  it('mock game state includes required flags and logs', () => {
    const state = createMockGameState();

    expect(typeof state.isOllamaLogViewerVisible).toBe('boolean');
    expect(Array.isArray(state.ollamaInteractionLog)).toBe(true);
    expect(state.devModelOverride === null || typeof state.devModelOverride === 'string').toBe(true);
    expect(state.economy).toBeDefined();
    expect(state.religion).toBeDefined();
    expect(state.environment).toBeDefined();
    expect(state.banterCooldowns).toBeDefined();
  });
});
