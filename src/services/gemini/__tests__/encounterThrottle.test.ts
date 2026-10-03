/**
 * @file src/services/gemini/__tests__/encounterThrottle.test.ts
 * Proves generateEncounter goes through the shared throttle in core.ts, so two
 * back-to-back encounter calls are spaced by the configured minimum.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ai } from '../../aiClient';
import { MIN_REQUEST_SPACING_MS } from '../core';
import { generateEncounter } from '../encounters';
import { TempPartyMember } from '../../../types';

vi.mock('../../aiClient', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
  isAiEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock('../../../utils/core/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../config/geminiConfig', () => ({
  GEMINI_TEXT_MODEL_FALLBACK_CHAIN: ['gemini-test-model'],
  FAST_MODEL: 'gemini-test-model',
  COMPLEX_MODEL: 'gemini-test-model',
}));

type VitestMock = ReturnType<typeof vi.fn>;
const mockGenerateContent = ai.models.generateContent as unknown as VitestMock;

const party: TempPartyMember[] = [
  { level: 3, classId: 'fighter' } as unknown as TempPartyMember,
];

describe('generateEncounter throttling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('spaces two back-to-back encounter calls by the configured minimum', async () => {
    const callTimes: number[] = [];
    mockGenerateContent.mockImplementation(async () => {
      callTimes.push(Date.now());
      return { text: '[]' };
    });

    const first = generateEncounter(500, ['forest'], party);
    await vi.runAllTimersAsync();
    await first;

    const second = generateEncounter(500, ['forest'], party);
    await vi.runAllTimersAsync();
    await second;

    expect(callTimes).toHaveLength(2);
    expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(MIN_REQUEST_SPACING_MS);
  });

  it('routes the request through the shared helper with the same payload', async () => {
    mockGenerateContent.mockResolvedValue({ text: '[]' });

    const call = generateEncounter(500, ['swamp'], party);
    await vi.runAllTimersAsync();
    await call;

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-test-model' })
    );
  });
});
