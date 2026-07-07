/**
 * @file src/services/ai/__tests__/groqTextProvider.test.ts
 * Verifies the Groq provider adapts a real OpenAI-shaped response into the
 * Ollama client return shapes, and surfaces failures honestly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  adaptToGenerateResponse,
  adaptToChatResponse,
  extractCompletionText,
  groqGenerateForTask,
  groqChatForTask,
  GROQ_CHAT_COMPLETIONS_URL,
} from '../groqTextProvider';

const SAMPLE_COMPLETION = {
  id: 'chatcmpl-abc',
  object: 'chat.completion',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'The tavern door creaks open.' },
      finish_reason: 'stop',
    },
  ],
  usage: { total_tokens: 42 },
};

describe('groqTextProvider adapters', () => {
  it('extracts assistant text from an OpenAI completion', () => {
    expect(extractCompletionText(SAMPLE_COMPLETION)).toBe('The tavern door creaks open.');
  });

  it('adapts to the OllamaGenerateResponse shape', () => {
    expect(adaptToGenerateResponse(SAMPLE_COMPLETION)).toEqual({
      response: 'The tavern door creaks open.',
    });
  });

  it('adapts to the OllamaChatResponse shape', () => {
    expect(adaptToChatResponse(SAMPLE_COMPLETION)).toEqual({
      message: { role: 'assistant', content: 'The tavern door creaks open.' },
      done: true,
    });
  });

  it('tolerates an empty/missing choices array', () => {
    expect(adaptToGenerateResponse({})).toEqual({ response: '' });
    expect(adaptToChatResponse({})).toEqual({
      message: { role: 'assistant', content: '' },
      done: true,
    });
  });
});

describe('groqGenerateForTask / groqChatForTask (network)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generate: posts to Groq with Bearer auth and returns the adapted shape', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_COMPLETION,
    } as Response);

    const result = await groqGenerateForTask(
      { apiKey: 'gsk_live', model: 'llama-3.3-70b-versatile' },
      { taskType: 'npc_dialogue', prompt: 'Greet the player.' }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ response: 'The tavern door creaks open.' });
      expect(result.model).toBe('llama-3.3-70b-versatile');
    }

    // URL + auth header assertions.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(GROQ_CHAT_COMPLETIONS_URL);
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer gsk_live',
    });
  });

  it('chat: returns the adapted OllamaChatResponse shape', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_COMPLETION,
    } as Response);

    const result = await groqChatForTask(
      { apiKey: 'gsk_live', model: 'llama-3.3-70b-versatile' },
      { taskType: 'npc_dialogue', messages: [{ role: 'user', content: 'Hi' }] }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.message).toEqual({
        role: 'assistant',
        content: 'The tavern door creaks open.',
      });
      expect(result.data.done).toBe(true);
    }
  });

  it('surfaces a missing key honestly (no network call)', async () => {
    const result = await groqGenerateForTask(
      { apiKey: '', model: 'llama-3.3-70b-versatile' },
      { taskType: 'npc_dialogue', prompt: 'x' }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('NO_GROQ_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxy mode: POSTs keyless (no Authorization) to the proxy URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_COMPLETION,
    } as Response);

    const result = await groqGenerateForTask(
      {
        apiKey: '',
        model: 'llama-3.3-70b-versatile',
        keyStorage: 'proxy',
        proxyUrl: 'http://localhost:8787/v1',
      },
      { taskType: 'npc_dialogue', prompt: 'Greet the player.' }
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    // Hits the local proxy's /chat/completions, NOT Groq's own endpoint.
    expect(url).toBe('http://localhost:8787/v1/chat/completions');
    expect(url).not.toContain('api.groq.com');
    // No Authorization header — the proxy injects the key server-side.
    const headers = (options as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('proxy mode: trailing slashes on the proxy URL are normalized', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => SAMPLE_COMPLETION } as Response);
    await groqGenerateForTask(
      { apiKey: '', model: 'm', keyStorage: 'proxy', proxyUrl: 'http://localhost:8787/v1//' },
      { taskType: 'npc_dialogue', prompt: 'x' }
    );
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8787/v1/chat/completions');
  });

  it('proxy mode with no URL fails honestly (no network call)', async () => {
    const result = await groqGenerateForTask(
      { apiKey: '', model: 'm', keyStorage: 'proxy', proxyUrl: '' },
      { taskType: 'npc_dialogue', prompt: 'x' }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('NO_GROQ_PROXY_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('local/session mode still sends Bearer auth to Groq directly', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => SAMPLE_COMPLETION } as Response);
    await groqGenerateForTask(
      { apiKey: 'gsk_session', model: 'm', keyStorage: 'session' },
      { taskType: 'npc_dialogue', prompt: 'x' }
    );
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(GROQ_CHAT_COMPLETIONS_URL);
    expect((options as RequestInit).headers).toMatchObject({ Authorization: 'Bearer gsk_session' });
  });

  it('surfaces an HTTP error (401) honestly, never falling back', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Invalid API Key' } }),
    } as Response);

    const result = await groqChatForTask(
      { apiKey: 'gsk_bad', model: 'llama-3.3-70b-versatile' },
      { taskType: 'npc_dialogue', messages: [{ role: 'user', content: 'Hi' }] }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain('401');
      expect(result.error).toContain('Invalid API Key');
    }
  });
});
