/**
 * @file src/services/ai/__tests__/groqModelPool.test.ts
 * The Groq model pool: a rate-limit refusal (429) moves the call to the next
 * free-plan model, other errors do not, and an all-limited pool fails with a
 * message that names when a model is free again.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { routeGenerateForTask, GROQ_ALL_MODELS_LIMITED } from '../textProviderRouter';
import { setAiTextProvider, setGroqApiKey } from '../aiProviderSettings';
import {
  GROQ_MODEL_POOL,
  getGroqPoolStatus,
  groqModelOrder,
  isGroqModelResting,
  parseGroqRetryAfterMs,
  resetGroqPool,
} from '../groqModelPool';

const OK = (text: string) => ({ ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: text } }] }) }) as Response;
const LIMITED = (wait: string) =>
  ({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    json: async () => ({ error: { message: `Rate limit reached for model on requests per day (RPD). Please try again in ${wait}.` } }),
  }) as Response;
const modelOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string).model as string;

describe('parseGroqRetryAfterMs', () => {
  it('reads minutes, seconds, hours and milliseconds', () => {
    expect(parseGroqRetryAfterMs('Please try again in 1m26.4s.')).toBe(86_400);
    expect(parseGroqRetryAfterMs('Please try again in 850ms.')).toBe(850);
    expect(parseGroqRetryAfterMs('Please try again in 2h3m.')).toBe(7_380_000);
    expect(parseGroqRetryAfterMs('no wait time here')).toBeNull();
  });
});

describe('Groq model pool through the router', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    resetGroqPool();
    setAiTextProvider('groq');
    setGroqApiKey('gsk_live');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('puts the chosen model first and keeps the rest in pool order', () => {
    expect(groqModelOrder(GROQ_MODEL_POOL[1])).toEqual([GROQ_MODEL_POOL[1], GROQ_MODEL_POOL[0], GROQ_MODEL_POOL[2]]);
  });

  it('moves to the next model on a 429 and records which model answered', async () => {
    fetchMock.mockResolvedValueOnce(LIMITED('5m0s')).mockResolvedValueOnce(OK('from the second model'));
    const result = await routeGenerateForTask({ taskType: 'npc_dialogue', prompt: 'Hi' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.response).toBe('from the second model');
      expect(result.model).toBe(GROQ_MODEL_POOL[1]);
    }
    expect(fetchMock.mock.calls.map(modelOf)).toEqual([GROQ_MODEL_POOL[0], GROQ_MODEL_POOL[1]]);
    expect(getGroqPoolStatus().lastAnsweredBy).toBe(GROQ_MODEL_POOL[1]);
    expect(isGroqModelResting(GROQ_MODEL_POOL[0])).toBe(true);
  });

  it('skips a resting model on the next call', async () => {
    fetchMock.mockResolvedValueOnce(LIMITED('5m0s')).mockResolvedValue(OK('ok'));
    await routeGenerateForTask({ taskType: 'npc_dialogue', prompt: 'Hi' });
    fetchMock.mockClear();
    await routeGenerateForTask({ taskType: 'npc_dialogue', prompt: 'Hi again' });
    expect(fetchMock.mock.calls.map(modelOf)).toEqual([GROQ_MODEL_POOL[1]]);
  });

  it('does not move on for errors other than a rate limit', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Invalid API Key' } }),
    } as Response);
    const result = await routeGenerateForTask({ taskType: 'npc_dialogue', prompt: 'Hi' });
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails honestly, naming the free-again time, when every model is limited', async () => {
    fetchMock.mockResolvedValue(LIMITED('10m0s'));
    const result = await routeGenerateForTask({ taskType: 'npc_dialogue', prompt: 'Hi' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(GROQ_ALL_MODELS_LIMITED);
      expect(result.error).toContain('free again at');
    }
    expect(fetchMock).toHaveBeenCalledTimes(GROQ_MODEL_POOL.length);

    // While all rest, a new call makes no network request at all.
    fetchMock.mockClear();
    await routeGenerateForTask({ taskType: 'npc_dialogue', prompt: 'Hi' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
