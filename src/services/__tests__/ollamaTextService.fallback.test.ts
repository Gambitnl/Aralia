import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Ollama client so we can force it "unavailable".
const generateForTask = vi.fn();
const prepareForTask = vi.fn();
vi.mock('../ollama/client', () => ({
  getDefaultClient: () => ({ generateForTask, prepareForTask }),
}));

// Mock the Gemini core text generator used by the fallback path.
const generateGeminiText = vi.fn();
vi.mock('../gemini/core', () => ({
  generateText: (...args: unknown[]) => generateGeminiText(...args),
}));

// Mock the readiness gate so tests control whether the fallback is active.
const isGeminiFallbackReady = vi.fn();
vi.mock('../ai/aiCredentials', () => ({
  isGeminiFallbackReady: () => isGeminiFallbackReady(),
}));

const isGroqActive = vi.fn();
vi.mock('../ai/textProviderRouter', () => ({ isGroqActive: () => isGroqActive() }));

import { generateActionOutcome, generateNPCResponse, prepareNPCResponse } from '../ollamaTextService';

describe('ollamaTextService Gemini fallback', () => {
  beforeEach(() => {
    generateForTask.mockReset();
    prepareForTask.mockReset();
    generateGeminiText.mockReset();
    isGeminiFallbackReady.mockReset();
    isGroqActive.mockReset();
  });

  it('prepares only the selected local NPC task and forwards cancellation to generation', async () => {
    const controller = new AbortController();
    const onStart = vi.fn();
    isGroqActive.mockReturnValue(false);
    prepareForTask.mockResolvedValue({ status: 'ready', model: 'selected' });
    generateForTask.mockResolvedValue({ ok: true, data: { response: 'A reply' }, model: 'selected' });

    await expect(prepareNPCResponse(controller.signal, onStart)).resolves.toEqual({ status: 'ready', model: 'selected' });
    await generateNPCResponse('A resident', 'Where is the market?', 'public facts', { signal: controller.signal });

    expect(prepareForTask).toHaveBeenCalledWith('npc_dialogue', { signal: controller.signal });
    expect(onStart).toHaveBeenCalledOnce();
    expect(generateForTask).toHaveBeenCalledWith(expect.objectContaining({ taskType: 'npc_dialogue', signal: controller.signal }));
  });

  it('skips local preparation for the already selected remote provider', async () => {
    const onStart = vi.fn();
    isGroqActive.mockReturnValue(true);
    await expect(prepareNPCResponse(undefined, onStart)).resolves.toEqual({ status: 'not-required', provider: 'groq' });
    expect(onStart).not.toHaveBeenCalled();
    expect(prepareForTask).not.toHaveBeenCalled();
  });

  it('does not start the configured remote fallback after the player cancels the request', async () => {
    const controller = new AbortController();
    controller.abort();
    generateForTask.mockResolvedValue({ ok: false, error: 'Request cancelled.' });
    isGeminiFallbackReady.mockReturnValue(true);

    const result = await generateNPCResponse('A resident', 'A canceled question', 'public facts', { signal: controller.signal });

    expect(result.success).toBe(false);
    expect(generateGeminiText).not.toHaveBeenCalled();
  });

  it('uses Ollama when it succeeds (no fallback)', async () => {
    generateForTask.mockResolvedValue({ ok: true, data: { response: 'local text' }, model: 'llama3' });
    isGeminiFallbackReady.mockReturnValue(true);

    const result = await generateActionOutcome('action', 'context');

    expect(result.success).toBe(true);
    expect(result.data?.text).toBe('local text');
    expect(generateGeminiText).not.toHaveBeenCalled();
  });

  it('redirects to Gemini when Ollama has no model and fallback is ready', async () => {
    generateForTask.mockResolvedValue({ ok: false, error: 'NO_MODEL' });
    isGeminiFallbackReady.mockReturnValue(true);
    generateGeminiText.mockResolvedValue({
      data: { text: 'gemini text', promptSent: 'p', rawResponse: 'raw', rateLimitHit: false },
      error: null,
    });

    const result = await generateActionOutcome('action', 'context');

    expect(result.success).toBe(true);
    expect(result.data?.text).toBe('gemini text');
    expect(generateGeminiText).toHaveBeenCalledTimes(1);
  });

  it('surfaces the Ollama error when fallback is NOT ready', async () => {
    generateForTask.mockResolvedValue({ ok: false, error: 'NO_MODEL' });
    isGeminiFallbackReady.mockReturnValue(false);

    const result = await generateActionOutcome('action', 'context');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No Ollama model available');
    expect(generateGeminiText).not.toHaveBeenCalled();
  });

  it('redirects to Gemini when the Ollama call throws (server unreachable)', async () => {
    generateForTask.mockRejectedValue(new Error('fetch failed'));
    isGeminiFallbackReady.mockReturnValue(true);
    generateGeminiText.mockResolvedValue({
      data: { text: 'gemini rescue', promptSent: 'p', rawResponse: 'raw', rateLimitHit: false },
      error: null,
    });

    const result = await generateActionOutcome('action', 'context');

    expect(result.success).toBe(true);
    expect(result.data?.text).toBe('gemini rescue');
  });

  it('falls back to the Ollama error when Gemini also fails', async () => {
    generateForTask.mockResolvedValue({ ok: false, error: 'NO_MODEL' });
    isGeminiFallbackReady.mockReturnValue(true);
    generateGeminiText.mockResolvedValue({
      data: null,
      error: 'Gemini API error',
      metadata: { promptSent: 'p', rawResponse: 'boom', rateLimitHit: false },
    });

    const result = await generateActionOutcome('action', 'context');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Gemini API error');
  });
});
