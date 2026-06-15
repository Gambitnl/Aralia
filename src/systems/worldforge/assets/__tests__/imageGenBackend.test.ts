/**
 * @file imageGenBackend.test.ts
 *
 * This file tests the image generation backend for the Worldforge asset pipeline.
 *
 * It validates:
 * 1. Prompt construction: Ensuring the generated prompt accurately reflects the key's kind,
 *    subject, and descriptors.
 * 2. Success mapping: Ensuring successful service responses are mapped into a valid ForgeAsset
 *    with a properly formatted base64 data URI.
 * 3. Error handling: Ensuring network transport failures correctly throw/reject as specified.
 * 4. Isolation: Mocks all HTTP traffic to ensure no live network calls are made.
 *
 * Test target: src/systems/worldforge/assets/imageGenBackend.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { createImageGenBackend } from '../imageGenBackend';

// ============================================================================
// Mock Data and Help Helpers
// ============================================================================
// Mocks for standard REST API success responses.
// ============================================================================

const mockSuccessResponse = {
  predictions: [
    {
      bytesBase64Encoded: 'dGVzdC1pbWFnZS1ieXRlcw==', // Base64 for "test-image-bytes"
    },
  ],
};

// ============================================================================
// Test Suite: Image Generation Backend
// ============================================================================

describe('createImageGenBackend', () => {
  it('correctly maps success response to ForgeAsset with data URI', async () => {
    // Inject a stub fetch that returns a successful mock response.
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response);

    const backend = createImageGenBackend({
      fetch: mockFetch,
      apiKey: 'test-key',
    });

    const asset = await backend.generate(
      'texture/wall/plaster/weathered/temperate',
    );

    // Validate request parameter mapping.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toContain('imagen-3.0-generate-002:predict');
    expect(calledInit.method).toBe('POST');
    expect(calledInit.headers).toEqual({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'test-key',
    });

    const requestBody = JSON.parse(calledInit.body as string);
    expect(requestBody.instances[0].prompt).toContain('texture of wall');
    expect(requestBody.instances[0].prompt).toContain('plaster, weathered, temperate');
    expect(requestBody.parameters.sampleCount).toBe(1);

    // Validate returned asset shape.
    expect(asset).not.toBeNull();
    expect(asset!.key).toBe('texture/wall/plaster/weathered/temperate');
    expect(asset!.source).toBe('generated');
    expect(asset!.imageUri).toBe('data:image/png;base64,dGVzdC1pbWFnZS1ieXRlcw==');
  });

  it('builds prompts correctly for different asset kinds (face, heraldry, default)', async () => {
    // Array of tests using the aggregate-counter style (checking results at the end, no expectations inside loops).
    const kindsToTest = [
      { key: 'face/elf/wizard', expectedWord: 'character portrait face' },
      { key: 'heraldry/kingdom-of-aralia/crest', expectedWord: 'heraldry design' },
      { key: 'other/sword/glowing', expectedWord: 'RPG illustration' },
    ];

    const generatedPrompts: string[] = [];

    // Stub fetch that records prompts.
    const mockFetch = vi.fn().mockImplementation(async (url, init) => {
      const body = JSON.parse(init.body);
      generatedPrompts.push(body.instances[0].prompt);
      return {
        ok: true,
        json: async () => mockSuccessResponse,
      } as Response;
    });

    const backend = createImageGenBackend({
      fetch: mockFetch,
      apiKey: 'test-key',
    });

    for (const testCase of kindsToTest) {
      await backend.generate(testCase.key);
    }

    // Verify all test cases using a aggregate check.
    expect(generatedPrompts).toHaveLength(kindsToTest.length);
    kindsToTest.forEach((testCase, idx) => {
      expect(generatedPrompts[idx]).toContain(testCase.expectedWord);
    });
  });

  it('throws/rejects on transport error (non-ok status)', async () => {
    // Inject a stub fetch that simulates an error status.
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const backend = createImageGenBackend({
      fetch: mockFetch,
      apiKey: 'test-key',
    });

    await expect(
      backend.generate('texture/wall/plaster'),
    ).rejects.toThrowError('500');
  });

  it('returns null if predictions are missing or empty', async () => {
    // Inject a stub fetch returning an empty predictions payload.
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ predictions: [] }),
    } as Response);

    const backend = createImageGenBackend({
      fetch: mockFetch,
      apiKey: 'test-key',
    });

    const asset = await backend.generate('texture/wall/plaster');
    expect(asset).toBeNull();
  });
});
