/**
 * @file src/services/gemini/__tests__/geminiRedaction.test.ts
 * Proves user-provided text is masked before it is stored in GeminiMetadata.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redactUserText } from '../../../utils/core/securityUtils';
import { generateText } from '../core';
import { ai } from '../../aiClient';

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

describe('redactUserText', () => {
  it('masks email addresses', () => {
    expect(redactUserText('write to remy.smith+rpg@example.co.uk now')).toBe(
      'write to [REDACTED_EMAIL] now'
    );
  });

  it('masks long digit runs', () => {
    expect(redactUserText('call 555-867-5309 please')).toBe('call [REDACTED_NUMBER] please');
  });

  it('keeps short numbers intact', () => {
    expect(redactUserText('you deal 12 damage on a 1d20')).toBe('you deal 12 damage on a 1d20');
  });

  it('masks anything inside <user> tags', () => {
    expect(redactUserText('ctx <user>my secret backstory</user> end')).toBe(
      'ctx <user>[REDACTED_USER_TEXT]</user> end'
    );
  });

  it('returns an empty string for empty input', () => {
    expect(redactUserText('')).toBe('');
  });
});

describe('generateText metadata redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('masks an email in the prompt before it reaches the stored metadata', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'The tavern is quiet.' });

    const result = await generateText(
      'The player says: contact me at remy@example.com about the quest.',
      'You are a narrator.',
      false,
      'testRedaction'
    );

    expect(result.error).toBeNull();
    const promptSent = result.data?.promptSent ?? '';
    expect(promptSent).not.toContain('remy@example.com');
    expect(promptSent).toContain('[REDACTED_EMAIL]');
    // The scaffolding stays diagnosable.
    expect(promptSent).toContain('User Prompt:');

    // The real prompt reaching the model is NOT redacted.
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: 'The player says: contact me at remy@example.com about the quest.',
      })
    );
  });

  it('masks an email echoed back in the raw response', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'Noted, remy@example.com.' });

    const result = await generateText('hello there friend of mine', undefined, false, 'testEcho');

    expect(result.data?.rawResponse).not.toContain('remy@example.com');
    expect(result.data?.rawResponse).toContain('[REDACTED_EMAIL]');
  });
});
