import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { synthesizeSpeech } from '../ttsService';

// agora-9890: mirror the established aiClient mock shape (see
// geminiServiceFallback.test.ts) so generateContent can be scripted per case.
vi.mock('../aiClient', () => ({
  ai: {
    models: {
      generateContent: vi.fn(),
    },
  },
  isAiEnabled: vi.fn(() => true),
}));

import { ai } from '../aiClient';

const SECRET_TEXT = 'SECRET-NARRATION-TEXT-THAT-MUST-NOT-LEAK';
const SECRET_AUDIO = 'SECRET-BASE64-AUDIO-BLOB-'.repeat(50);

const loggedAll = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls
    .flat()
    .map((arg: unknown) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
    .join('\n');

describe('ttsService failure diagnostics (agora-9890)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('omits generated text payloads from the invalid-audio warning', async () => {
    vi.mocked(ai.models.generateContent).mockResolvedValue({
      candidates: [
        {
          content: { parts: [{ text: SECRET_TEXT }] },
          finishReason: 'STOP',
        },
      ],
    } as never);

    // devModelOverride pins the chain to one model so the retry loop is exact.
    const result = await synthesizeSpeech('read me aloud', 'Kore', 'test-tts-model');

    // Retry/fail-over behavior preserved: no audio, an error is surfaced.
    expect(result.audioData).toBeNull();
    expect(result.error).toBeInstanceOf(Error);

    const logged = loggedAll(warnSpy);
    expect(logged).not.toContain(SECRET_TEXT);
    expect(logged).toContain('test-tts-model');
    // The bounded metadata keeps the failure diagnosable: shape, not content.
    expect(logged).toContain('textLength');
    expect(logged).toContain(String(SECRET_TEXT.length));
  });

  it('omits base64 audio payloads from the invalid-audio warning', async () => {
    vi.mocked(ai.models.generateContent).mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              { inlineData: { mimeType: 'audio/pcm', data: '' } },
              { text: SECRET_AUDIO },
            ],
          },
        },
      ],
    } as never);

    const result = await synthesizeSpeech('read me aloud', 'Kore', 'test-tts-model');

    expect(result.audioData).toBeNull();
    const logged = loggedAll(warnSpy);
    expect(logged).not.toContain(SECRET_AUDIO);
    expect(logged).toContain('audio/pcm'); // mime type is safe metadata
  });

  it('still returns audio unchanged on the success path', async () => {
    vi.mocked(ai.models.generateContent).mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { mimeType: 'audio/wav', data: 'QUJDRA==' } }],
          },
        },
      ],
    } as never);

    const result = await synthesizeSpeech('read me aloud', 'Kore', 'test-tts-model');
    expect(result.audioData).toBe('QUJDRA==');
    expect(result.error).toBeUndefined();
  });
});
