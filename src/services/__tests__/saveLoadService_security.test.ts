// TODO(lint-intent): 'afterEach' is unused in this test; use it in the assertion path or remove it.
import { describe, it, expect, vi, beforeEach, afterEach as _afterEach } from 'vitest';
// TODO(lint-intent): 'saveGame' is unused in this test; use it in the assertion path or remove it.
import { loadGame, saveGame as _saveGame, getSaveSlots } from '../saveLoadService';
// TODO(lint-intent): 'SafeStorage' is unused in this test; use it in the assertion path or remove it.
import { SafeStorage as _SafeStorage } from '../../utils/storageUtils';
// TODO(lint-intent): 'GameState' is unused in this test; use it in the assertion path or remove it.
import { GameState as _GameState } from '../../types';

// Mock storage
const mockStorage: Record<string, string> = {};

vi.mock('../../utils/storageUtils', () => ({
  SafeStorage: {
    getItem: vi.fn((key: string) => mockStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
    removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
    getAllKeys: vi.fn(() => Object.keys(mockStorage)),
  },
  SafeSession: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
}));

describe('saveLoadService Security Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key in mockStorage) delete mockStorage[key];
  });

  it('should handle malformed JSON in save slot gracefully', async () => {
    mockStorage['aralia_rpg_default_save'] = '{ "invalid": "json", '; // Malformed

    const result = await loadGame();

    expect(result.success).toBe(false);
    expect(result.message).toContain('Save data corrupted');
  });

  it('should handle null/empty content in save slot', async () => {
    mockStorage['aralia_rpg_default_save'] = '';

    const result = await loadGame();

    expect(result.success).toBe(false);
    expect(result.message).toContain('No save game found');
  });

  it('should handle malformed JSON in slot index', () => {
    mockStorage['aralia_rpg_save_slots_index'] = 'NOT_JSON';

    const slots = getSaveSlots();

    // Should recover by ignoring the index and falling back to scanning slots (which are empty here)
    expect(Array.isArray(slots)).toBe(true);
    expect(slots.length).toBe(0);
  });
});
