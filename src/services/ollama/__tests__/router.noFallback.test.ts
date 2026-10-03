import { describe, it, expect, beforeEach } from 'vitest';
import { resolveModelForTask, resetRouterCache, OllamaModelNotInstalledError } from '../router';
import { setOllamaModelChoice, resolveOllamaModel } from '../../ai/aiProviderSettings';
import { OLLAMA_CATEGORY_DEFAULT_MODEL } from '../../../config/llmProviderConfig';
import type { OllamaClient } from '../client';

// agora-d1c7.1 (2026-09-13): one model per category, no fallback walk.
const clientWith = (names: string[] | null) => ({
  listModels: async () => (names ? names.map((name) => ({ name })) : null),
}) as unknown as OllamaClient;

describe('resolveModelForTask — one model, no fallback', () => {
  beforeEach(() => {
    resetRouterCache();
    window.localStorage.clear();
  });

  it('returns the category default when it is installed and nothing is chosen', async () => {
    const def = OLLAMA_CATEGORY_DEFAULT_MODEL.dialogue;
    const model = await resolveModelForTask(clientWith([def, 'other:latest']), 'npc_dialogue');
    expect(model).toBe(def);
  });

  it('returns the player choice when it is installed', async () => {
    setOllamaModelChoice('dialogue', 'other');
    expect(resolveOllamaModel('dialogue')).toBe('other');
    const model = await resolveModelForTask(clientWith(['other:latest', OLLAMA_CATEGORY_DEFAULT_MODEL.dialogue]), 'npc_dialogue');
    expect(model).toBe('other:latest');
  });

  it('throws naming the model when the chosen model is not installed, and does NOT fall back', async () => {
    setOllamaModelChoice('dialogue', 'ghost-model');
    await expect(resolveModelForTask(clientWith(['some-installed:latest']), 'npc_dialogue'))
      .rejects.toBeInstanceOf(OllamaModelNotInstalledError);
    await expect(resolveModelForTask(clientWith(['some-installed:latest']), 'npc_dialogue'))
      .rejects.toThrow(/ghost-model/);
  });

  it('returns null only when the server lists nothing', async () => {
    expect(await resolveModelForTask(clientWith(null), 'npc_dialogue')).toBeNull();
    expect(await resolveModelForTask(clientWith([]), 'npc_dialogue')).toBeNull();
  });

  it('clearing the choice restores the default', () => {
    setOllamaModelChoice('prose', 'x');
    setOllamaModelChoice('prose', null);
    expect(resolveOllamaModel('prose')).toBe(OLLAMA_CATEGORY_DEFAULT_MODEL.prose);
  });
});
