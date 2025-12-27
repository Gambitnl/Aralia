
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadGame, saveGame, getSaveSlots } from '../saveLoadService';
import { SafeStorage } from '../../utils/storageUtils';
import { GameState } from '../../types';

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
