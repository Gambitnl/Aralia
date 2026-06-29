import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOpeningSituation } from '../useOpeningSituation';
import { createMockGameState } from '../../utils/factories';
import { INITIAL_GAME_ENTRY_STATE, type OpeningSituation } from '../../systems/gameEntry/types';
import type { GameState } from '../../types';

const SITUATION: OpeningSituation = {
  setting: { place: 'the docks', timeOfDay: 'dusk', weather: 'a cold drizzle' },
  predicament: 'A brawl spills out of a tavern into your path.',
  npcs: [{ id: 'sit-1', name: 'Mara', role: 'panicked sailor', disposition: 'wary', goal: 'to escape' }],
  openingLine: { speakerId: 'sit-1', text: 'You there — help me!' },
};

function generatingState(): GameState {
  const pc = { name: 'Hero', race: { name: 'Human' }, class: { name: 'Fighter' }, background: 'soldier' } as never;
  return createMockGameState({
    party: [pc],
    gameEntry: { ...INITIAL_GAME_ENTRY_STATE, status: 'generating' },
  });
}

describe('useOpeningSituation — opening scene illustration', () => {
  it('fires the scene request after resolving and dispatches SUCCESS with the url', async () => {
    const dispatched: Array<{ type: string; payload?: unknown }> = [];
    const dispatch = (a: { type: string; payload?: unknown }) => { dispatched.push(a); };
    const generate = vi.fn().mockResolvedValue(SITUATION);
    const generateScene = vi.fn().mockResolvedValue('assets/images/scenes/generated/opening_1.png');

    renderHook(() =>
      useOpeningSituation(generatingState(), dispatch as never, { generate, generateScene, enableScene: true }),
    );

    await waitFor(() => {
      expect(dispatched.some(a => a.type === 'SCENE_IMAGE_REQUEST_SUCCESS')).toBe(true);
    });

    const types = dispatched.map(a => a.type);
    // The situation resolves and the scene request is kicked off after it.
    expect(types).toContain('RESOLVE_OPENING_SITUATION');
    expect(types).toContain('SCENE_IMAGE_REQUEST_START');
    expect(types.indexOf('SCENE_IMAGE_REQUEST_START')).toBeGreaterThan(types.indexOf('RESOLVE_OPENING_SITUATION'));

    const success = dispatched.find(a => a.type === 'SCENE_IMAGE_REQUEST_SUCCESS') as { payload: { url: string } };
    expect(success.payload.url).toBe('assets/images/scenes/generated/opening_1.png');
    expect(generateScene).toHaveBeenCalledOnce();
  });

  it('dispatches SCENE_IMAGE_REQUEST_ERROR honestly when generation throws (no fallback)', async () => {
    const dispatched: Array<{ type: string; payload?: unknown }> = [];
    const dispatch = (a: { type: string; payload?: unknown }) => { dispatched.push(a); };
    const generate = vi.fn().mockResolvedValue(SITUATION);
    const generateScene = vi.fn().mockRejectedValue(new Error('local-only feature'));

    renderHook(() =>
      useOpeningSituation(generatingState(), dispatch as never, { generate, generateScene, enableScene: true }),
    );

    await waitFor(() => {
      expect(dispatched.some(a => a.type === 'SCENE_IMAGE_REQUEST_ERROR')).toBe(true);
    });

    const err = dispatched.find(a => a.type === 'SCENE_IMAGE_REQUEST_ERROR') as { payload: { error: string } };
    expect(err.payload.error).toContain('local-only');
  });

  it('does not request a scene when the feature is disabled', async () => {
    const dispatched: Array<{ type: string; payload?: unknown }> = [];
    const dispatch = (a: { type: string; payload?: unknown }) => { dispatched.push(a); };
    const generate = vi.fn().mockResolvedValue(SITUATION);
    const generateScene = vi.fn().mockResolvedValue('x');

    renderHook(() =>
      useOpeningSituation(generatingState(), dispatch as never, { generate, generateScene, enableScene: false }),
    );

    await waitFor(() => {
      expect(dispatched.some(a => a.type === 'RESOLVE_OPENING_SITUATION')).toBe(true);
    });

    expect(generateScene).not.toHaveBeenCalled();
    expect(dispatched.some(a => a.type === 'SCENE_IMAGE_REQUEST_START')).toBe(false);
  });
});
