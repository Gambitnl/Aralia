/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/services/ai/oauthGeminiClient.ts
 *
 * Minimal REST adapter that lets the app call the Gemini (Generative Language)
 * API with an OAuth bearer token instead of an API key.
 *
 * WHY THIS EXISTS: the @google/genai browser SDK hard-requires an `apiKey` in
 * its constructor, so it cannot be used for the "Sign in with Google" path
 * where the player authenticates with their own OAuth token. This adapter
 * exposes just the surface the app consumes — `client.models.generateContent`
 * — so it can be dropped in wherever the SDK client is used (see aiClient.ts).
 *
 * It translates the SDK-style request `{ model, contents, config }` into the
 * REST body the endpoint expects, sends the token as `Authorization: Bearer`,
 * and returns a response object shaped like the SDK's GenerateContentResponse
 * (exposing `.text` plus the raw `candidates`) so existing callers work
 * unchanged.
 */

const GENAI_BASE_URL = 'https://generativelanguage.googleapis.com';
const GENAI_API_VERSION = 'v1beta';

/** The subset of an SDK generateContent request that callers in this app use. */
interface GenerateContentArgs {
  model: string;
  // The SDK accepts string | Content | Content[]; this app passes a string.
  contents: unknown;
  config?: Record<string, unknown>;
}

/** Response wrapper mirroring the fields the app reads off the SDK response. */
interface AdapterResponse {
  readonly text: string | undefined;
  candidates?: unknown;
  promptFeedback?: unknown;
  usageMetadata?: unknown;
}

/** Config keys that belong under REST `generationConfig` rather than top-level. */
const GENERATION_CONFIG_KEYS = new Set([
  'temperature',
  'topK',
  'topP',
  'candidateCount',
  'maxOutputTokens',
  'stopSequences',
  'responseMimeType',
  'responseSchema',
  'thinkingConfig',
  'responseModalities',
  'speechConfig',
  'seed',
  'presencePenalty',
  'frequencyPenalty',
]);

function normalizeContents(contents: unknown): unknown {
  if (typeof contents === 'string') {
    return [{ role: 'user', parts: [{ text: contents }] }];
  }
  // Already a Content or Content[]; pass through and let the API validate.
  return Array.isArray(contents) ? contents : [contents];
}

function normalizeSystemInstruction(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    return { parts: [{ text: value }] };
  }
  return value;
}

function buildRequestBody(args: GenerateContentArgs): Record<string, unknown> {
  const body: Record<string, unknown> = {
    contents: normalizeContents(args.contents),
  };

  const config = args.config ?? {};
  const generationConfig: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(config)) {
    if (val === undefined) continue;
    if (key === 'systemInstruction') {
      const sys = normalizeSystemInstruction(val);
      if (sys) body.systemInstruction = sys;
    } else if (key === 'tools' || key === 'toolConfig' || key === 'safetySettings') {
      body[key] = val;
    } else if (GENERATION_CONFIG_KEYS.has(key)) {
      generationConfig[key] = val;
    }
    // Unknown keys are dropped rather than risking a 400 from the REST API.
  }

  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig;
  }
  return body;
}

function extractText(json: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string | undefined {
  const parts = json.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) return undefined;
  const text = parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('');
  return text.length > 0 ? text : undefined;
}

/**
 * Build a minimal client that calls Gemini with an OAuth bearer token.
 * @param getAccessToken Lazily returns the current token, so token refreshes
 *   are picked up without rebuilding the client.
 */
export function createOAuthGeminiClient(getAccessToken: () => string) {
  async function generateContent(args: GenerateContentArgs): Promise<AdapterResponse> {
    const token = getAccessToken();
    if (!token) {
      throw new Error('No Google OAuth token available. Please sign in with Google again.');
    }

    const url = `${GENAI_BASE_URL}/${GENAI_API_VERSION}/models/${args.model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildRequestBody(args)),
    });

    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch {
        /* ignore */
      }
      // Preserve the HTTP status code in the message so the shared Gemini error
      // handling (which sniffs for "429"/"503") keeps working via OAuth too.
      const err = new Error(`Gemini API error ${res.status}: ${res.statusText}${detail ? ` — ${detail}` : ''}`);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      promptFeedback?: unknown;
      usageMetadata?: unknown;
    };

    const text = extractText(json);
    return {
      text,
      candidates: json.candidates,
      promptFeedback: json.promptFeedback,
      usageMetadata: json.usageMetadata,
    };
  }

  return {
    models: { generateContent },
  };
}

export type OAuthGeminiClient = ReturnType<typeof createOAuthGeminiClient>;
