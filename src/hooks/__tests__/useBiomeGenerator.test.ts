/**
 * @file src/hooks/__tests__/useBiomeGenerator.test.ts
 *
 * Guards the two contracts of the biome LLM hook:
 *
 *  1. (agora-79fa) The response schema is narrowed, not cast. Every field a
 *     model may omit or mistype lands on a validated BiomeDNA, and a reply that
 *     is not a JSON object fails with a message naming the provider.
 *  2. (agora-ceb0) The Gemini provider calls the real `gemini/core` service
 *     instead of returning a mock, and a Gemini error surfaces honestly with no
 *     silent retry on Ollama.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useBiomeGenerator,
  coerceScatterRules,
  parseBiomeResponse,
  toBiomeDNA,
} from '../useBiomeGenerator';

const generateTextMock = vi.fn();

vi.mock('@/services/gemini/core', () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
}));

vi.mock('@/services/ai/aiProviderSettings', () => ({
  resolveOllamaModel: () => 'test-biome-model',
}));

const FULL_RESPONSE = {
  name: 'Ashen Fen',
  primaryColor: '#2d5a27',
  secondaryColor: '#8b5a2b',
  roughness: 0.8,
  waterColor: '#123456',
  waterClarity: 0.1,
  waveIntensity: 0.2,
  fogDensity: 0.05,
  fogHeight: 14,
  weatherType: 'ash',
  weatherIntensity: 0.4,
  scatter: [{ id: 'fen_tree', assetType: 'tree', preset: 'dead', density: 0.1, scaleMean: 1.2, scaleVar: 0.3 }],
};

function mockFetchOk(payload: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ response: JSON.stringify(payload) }) })),
  );
}

beforeEach(() => {
  generateTextMock.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('coerceScatterRules', () => {
  it('keeps well-formed rules and coerces the optional numbers', () => {
    const rules = coerceScatterRules([
      { id: 'a', assetType: 'rock', density: 0.2, scaleMean: 2, scaleVar: 0.1, clusterScale: 0.05 },
    ]);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ id: 'a', assetType: 'rock', density: 0.2, scaleMean: 2, clusterScale: 0.05 });
    expect(rules[0].preset).toBeUndefined();
    expect(rules[0].minSlope).toBeUndefined();
  });

  it('drops non-objects, id-less entries, and falls back to tree for an unknown assetType', () => {
    const rules = coerceScatterRules([null, 'nope', 42, { assetType: 'tree' }, { id: 'b', assetType: 'dragon' }]);
    expect(rules).toEqual([
      expect.objectContaining({ id: 'b', assetType: 'tree', density: 0, scaleMean: 1, scaleVar: 0 }),
    ]);
  });

  it('accepts a numeric id and returns [] for a non-array', () => {
    expect(coerceScatterRules([{ id: 7, assetType: 'grass' }])[0].id).toBe('7');
    expect(coerceScatterRules({ id: 'x' })).toEqual([]);
    expect(coerceScatterRules(undefined)).toEqual([]);
  });
});

describe('parseBiomeResponse', () => {
  it('returns the parsed object for valid JSON', () => {
    expect(parseBiomeResponse('{"name":"Fen"}', 'Gemini')).toEqual({ name: 'Fen' });
  });

  it('names the provider and quotes the head of an unparseable reply', () => {
    expect(() => parseBiomeResponse('```json\n{"name":"Fen"}', 'Gemini')).toThrow(
      /Gemini did not return valid JSON\. Response began: ```json/,
    );
  });

  it('rejects a JSON array or scalar', () => {
    expect(() => parseBiomeResponse('[1,2]', 'Gemini')).toThrow(/Gemini returned an array/);
    expect(() => parseBiomeResponse('"text"', 'Ollama')).toThrow(/Ollama returned string/);
  });
});

describe('toBiomeDNA', () => {
  it('fills every default when the model omits the optional fields', () => {
    const dna = toBiomeDNA({}, 'a swamp', 'gen_1');
    expect(dna).toMatchObject({
      id: 'gen_1',
      name: 'Unknown Biome',
      descriptor: 'a swamp',
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
      roughness: 0.5,
      waterColor: '#1e3a8a',
      waterClarity: 0.6,
      waveIntensity: 0.3,
      fogDensity: 0.02,
      fogHeight: 10,
      weatherType: 'clear',
      weatherIntensity: 0,
      scatter: [],
    });
  });

  it('rejects an out-of-set weatherType and a stringified number', () => {
    const dna = toBiomeDNA({ weatherType: 'meteors', roughness: '0.9' }, 'p', 'gen_2');
    expect(dna.weatherType).toBe('clear');
    expect(dna.roughness).toBe(0.5);
  });

  it('keeps the descriptor from the user prompt, not the model', () => {
    expect(toBiomeDNA({ descriptor: 'model made this up' }, 'real prompt', 'gen_3').descriptor).toBe('real prompt');
  });
});

describe('useBiomeGenerator — Ollama provider', () => {
  it('parses a successful response into dna and reports success', async () => {
    mockFetchOk(FULL_RESPONSE);
    const { result } = renderHook(() => useBiomeGenerator());

    await act(async () => {
      await result.current.generate('a toxic fen');
    });

    expect(result.current.status).toBe('success');
    expect(result.current.error).toBeNull();
    expect(result.current.dna?.name).toBe('Ashen Fen');
    expect(result.current.dna?.weatherType).toBe('ash');
    expect(result.current.dna?.scatter).toHaveLength(1);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it('names the model in the error when the endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    const { result } = renderHook(() => useBiomeGenerator());

    await act(async () => {
      await result.current.generate('a toxic fen');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/test-biome-model" failed with 503/);
    expect(result.current.dna).toBeNull();
  });

  it('fails honestly when the envelope carries no response text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
    const { result } = renderHook(() => useBiomeGenerator());

    await act(async () => {
      await result.current.generate('a toxic fen');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/no "response" text/);
  });
});

describe('useBiomeGenerator — Gemini provider', () => {
  it('calls the real gemini/core service with the biome system prompt in JSON mode', async () => {
    generateTextMock.mockResolvedValue({ data: { text: JSON.stringify(FULL_RESPONSE) }, error: null });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { result } = renderHook(() => useBiomeGenerator());

    await act(async () => {
      await result.current.generate('a toxic fen', 'gemini');
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const [prompt, systemInstruction, expectJson] = generateTextMock.mock.calls[0];
    expect(prompt).toBe('Generate a biome based on: "a toxic fen"');
    expect(String(systemInstruction)).toContain('procedural generation engine');
    expect(expectJson).toBe(true);

    expect(result.current.status).toBe('success');
    expect(result.current.dna?.name).toBe('Ashen Fen');
    // The retired mock stamped every cloud biome with this name; it must be gone.
    expect(result.current.dna?.name).not.toMatch(/^Gemini /);
  });

  it('surfaces a Gemini error and does not fall back to Ollama', async () => {
    generateTextMock.mockResolvedValue({ data: null, error: 'Gemini API disabled (Missing API Key)' });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { result } = renderHook(() => useBiomeGenerator());

    await act(async () => {
      await result.current.generate('a toxic fen', 'gemini');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Gemini biome generation failed: Gemini API disabled (Missing API Key)');
    expect(result.current.dna).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
