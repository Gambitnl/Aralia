/**
 * @file src/services/ai/__tests__/textProviderRouter.test.ts
 * The router chooses the provider from the persisted setting, and the
 * OllamaClient delegates to Groq only when `groq` is selected. Also proves the
 * no-key path is honestly unavailable and logs through the central sink.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaClient } from '../../ollama/client';
import {
  setAiTextProvider,
  setGroqApiKey,
  setGroqKeyStorage,
  setGroqProxyUrl,
} from '../aiProviderSettings';
import { subscribeOllamaLog, type OllamaLogEvent } from '../../ollama/ollamaLogSink';

const SAMPLE_COMPLETION = {
  choices: [{ message: { role: 'assistant', content: 'cloud reply' } }],
};

describe('textProviderRouter via OllamaClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('routes generateForTask to Groq when the provider is groq + key present', async () => {
    setAiTextProvider('groq');
    setGroqApiKey('gsk_live');
    fetchMock.mockResolvedValue({ ok: true, json: async () => SAMPLE_COMPLETION } as Response);

    const client = new OllamaClient();
    const result = await client.generateForTask({ taskType: 'npc_dialogue', prompt: 'Hi' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.response).toBe('cloud reply');
      expect(result.model).toBe('llama-3.3-70b-versatile');
    }
    // The one call must be to Groq, not to the Ollama /api endpoints.
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('api.groq.com');
  });

  it('does NOT route to Groq when provider is ollama', async () => {
    setAiTextProvider('ollama');
    setGroqApiKey('gsk_live');
    // No installed models -> resolveModel returns null -> NO_MODEL (Ollama path).
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ models: [] }) } as Response);

    const client = new OllamaClient();
    const result = await client.generateForTask({ taskType: 'npc_dialogue', prompt: 'Hi' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('NO_MODEL');
    // Every fetch must have hit the local Ollama proxy, never Groq.
    for (const call of fetchMock.mock.calls) {
      expect(call[0] as string).not.toContain('api.groq.com');
    }
  });

  it('groq selected but no key -> honest unavailable (no network) + logged error', async () => {
    setAiTextProvider('groq');
    // no key set

    const events: OllamaLogEvent[] = [];
    const unsub = subscribeOllamaLog((e) => events.push(e));

    const client = new OllamaClient();
    const result = await client.chatForTask({
      taskType: 'npc_dialogue',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    unsub();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('NO_GROQ_KEY');
    expect(fetchMock).not.toHaveBeenCalled();

    // Central-sink logging still happened (start + error), same as the Ollama path.
    expect(events.some((e) => e.phase === 'start')).toBe(true);
    expect(events.some((e) => e.phase === 'error' && e.error === 'NO_GROQ_KEY')).toBe(true);
  });

  it('isAvailable reflects the Groq key when Groq is selected', async () => {
    setAiTextProvider('groq');
    const client = new OllamaClient();
    expect(await client.isAvailable()).toBe(false);
    setGroqApiKey('gsk_live');
    expect(await client.isAvailable()).toBe(true);
  });

  it('session mode: reads the key from sessionStorage and routes to Groq', async () => {
    setAiTextProvider('groq');
    setGroqKeyStorage('session');
    setGroqApiKey('gsk_session'); // goes to sessionStorage
    fetchMock.mockResolvedValue({ ok: true, json: async () => SAMPLE_COMPLETION } as Response);

    const client = new OllamaClient();
    const result = await client.generateForTask({ taskType: 'npc_dialogue', prompt: 'Hi' });

    expect(result.ok).toBe(true);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url as string).toContain('api.groq.com');
    expect((options as RequestInit).headers).toMatchObject({ Authorization: 'Bearer gsk_session' });
  });

  it('proxy mode: routes keyless to the proxy URL (no key in browser)', async () => {
    setAiTextProvider('groq');
    setGroqKeyStorage('proxy');
    setGroqProxyUrl('http://localhost:8787/v1');
    fetchMock.mockResolvedValue({ ok: true, json: async () => SAMPLE_COMPLETION } as Response);

    const client = new OllamaClient();
    const result = await client.chatForTask({
      taskType: 'npc_dialogue',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.ok).toBe(true);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url as string).toBe('http://localhost:8787/v1/chat/completions');
    expect(url as string).not.toContain('api.groq.com');
    const headers = (options as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('proxy mode makes the client available without any browser key', async () => {
    setAiTextProvider('groq');
    setGroqKeyStorage('proxy');
    const client = new OllamaClient();
    // No key set anywhere, yet proxy mode is available (proxy holds the key).
    expect(await client.isAvailable()).toBe(true);
  });
});
