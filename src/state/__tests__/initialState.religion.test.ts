import { describe, expect, it } from 'vitest';
import { initialGameState } from '../initialState';

/**
 * This file checks the religion defaults that every new game starts with.
 *
 * The religion migration keeps a canonical `state.religion` slice while older
 * systems still know about root-level favor records. This test guards the startup
 * contract so fresh games begin with both locations aligned and no surprise
 * discovered deities or blessings.
 *
 * Called by: Vitest initial-state checks
 * Depends on: initialState.ts
 */

describe('initialGameState religion defaults', () => {
    it('keeps canonical and legacy favor maps aligned on a fresh load', () => {
        expect(initialGameState.religion.divineFavor).toEqual(initialGameState.divineFavor);
        expect(initialGameState.religion.discoveredDeities).toEqual([]);
        expect(initialGameState.religion.activeBlessings).toEqual([]);
    });
});
