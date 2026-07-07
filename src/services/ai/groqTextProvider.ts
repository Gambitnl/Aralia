/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ai/groqTextProvider.ts
 *
 * Groq (OpenAI-compatible cloud chat) text provider. It speaks the OpenAI
 * `/chat/completions` schema to Groq and ADAPTS every response back into the
 * exact shapes the OllamaClient's task-aware methods return, so the router can
 * swap it in without any caller changing.
 *
 * Returned shapes matched against the real OllamaClient interface:
 *   - generateForTask -> { ok: true; data: OllamaGenerateResponse; model }
 *                     |  { ok: false; error: string; model? }
 *   - chatForTask     -> { ok: true; data: OllamaChatResponse; model }
 *                     |  { ok: false; error: string; model?; statusCode? }
 *
 * NO-FALLBACK: when the player has chosen Groq, failures (missing key, 401,
 * rate limit, no network, unreachable proxy) surface honestly through the same
 * `{ ok: false }` error path — this module NEVER silently swaps back to Ollama.
 *
 * KEY-HANDLING MODES (chosen by the player, passed in via GroqCallContext):
 *   - local/session — the key comes from the browser store; we send it as
 *     `Authorization: Bearer <key>` to Groq's own endpoint.
 *   - proxy — the browser holds NO key; we POST keyless (no Authorization
 *     header) to a local OpenAI-compatible proxy URL, which injects the key
 *     server-side. XSS-proof for the key.
 *
 * SECURITY: the API key is passed in by the router from the browser store
 * (aiProviderSettings). It is never read from import.meta.env or the bundle,
 * and in proxy mode it never touches the browser at all.
 */

import type {
  OllamaGenerateResponse,
  OllamaChatResponse,
  ResponseFormat,
  ModelParams,
  TaskType,
} from '../../types/ollama';
import { getTaskProfile } from '../ollama/taskProfiles';

/** Groq's OpenAI-compatible chat completions endpoint. */
export const GROQ_CHAT_COMPLETIONS_URL =
  'https://api.groq.com/openai/v1/chat/completions';

/** Minimal shape of a successful OpenAI-compatible chat completion response. */
interface OpenAiChatCompletion {
  choices?: Array<{
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  error?: { message?: string; type?: string; code?: string };
}

export interface GroqCallContext {
  /**
   * The API key for `local`/`session` modes. In `proxy` mode this is empty and
   * unused — the proxy injects the real key server-side.
   */
  apiKey: string;
  model: string;
  timeoutMs?: number;
  /**
   * Key-handling mode. Defaults to a direct Bearer call when omitted (matching
   * the original behavior). `proxy` sends a keyless request to {@link proxyUrl}.
   */
  keyStorage?: 'local' | 'session' | 'proxy';
  /**
   * Base URL of the local OpenAI-compatible proxy, used only in `proxy` mode.
   * `/chat/completions` is appended.
   */
  proxyUrl?: string;
}

/** Default request timeout (mirrors DEFAULT_OLLAMA_CONFIG.timeoutMs). */
const DEFAULT_TIMEOUT_MS = 90000;

/**
 * Resolve the endpoint URL and request headers for a call, branching on the
 * key-handling mode:
 *   - proxy — `${proxyUrl}/chat/completions`, NO Authorization header.
 *   - local/session (or unset) — Groq's own endpoint with `Bearer <apiKey>`.
 * Returns an error string when a mode's prerequisite is missing (no key for a
 * key-bearing mode, or no proxy URL for proxy mode) so the caller can fail
 * honestly without a network round-trip.
 */
export function resolveEndpoint(
  ctx: GroqCallContext
): { ok: true; url: string; headers: Record<string, string> } | { ok: false; error: string } {
  const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ctx.keyStorage === 'proxy') {
    const proxyUrl = (ctx.proxyUrl ?? '').trim().replace(/\/+$/, '');
    if (!proxyUrl) {
      return { ok: false, error: 'NO_GROQ_PROXY_URL' };
    }
    return { ok: true, url: `${proxyUrl}/chat/completions`, headers: baseHeaders };
  }
  if (!ctx.apiKey) {
    return { ok: false, error: 'NO_GROQ_KEY' };
  }
  return {
    ok: true,
    url: GROQ_CHAT_COMPLETIONS_URL,
    headers: { ...baseHeaders, Authorization: `Bearer ${ctx.apiKey}` },
  };
}

/**
 * Extract the assistant text from an OpenAI-compatible completion. Exported so
 * the response-adaptation is independently unit-testable against a sample
 * payload.
 */
export function extractCompletionText(json: OpenAiChatCompletion): string {
  return json.choices?.[0]?.message?.content ?? '';
}

/**
 * Adapt an OpenAI-compatible completion into the OllamaGenerateResponse shape
 * ({ response: string }).
 */
export function adaptToGenerateResponse(
  json: OpenAiChatCompletion
): OllamaGenerateResponse {
  return { response: extractCompletionText(json) };
}

/**
 * Adapt an OpenAI-compatible completion into the OllamaChatResponse shape
 * ({ message: { role, content }, done: true }).
 */
export function adaptToChatResponse(
  json: OpenAiChatCompletion
): OllamaChatResponse {
  const choice = json.choices?.[0];
  return {
    message: {
      role: choice?.message?.role ?? 'assistant',
      content: choice?.message?.content ?? '',
    },
    done: true,
  };
}

/**
 * Translate an Ollama `format` hint into the OpenAI `response_format` field.
 * Groq accepts `{ type: 'json_object' }` for JSON mode; a schema object is
 * treated as JSON mode too (Groq does not take the raw Ollama schema, but JSON
 * mode is the closest honest equivalent).
 */
function toResponseFormat(
  format?: ResponseFormat
): { type: 'json_object' } | undefined {
  if (!format) return undefined;
  return { type: 'json_object' };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const startTime = Date.now();
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    const elapsed = Date.now() - startTime;
    if (error?.name === 'AbortError') {
      throw new Error(
        `Groq request timed out after ${elapsed}ms (timeout set to ${timeoutMs}ms).`
      );
    }
    throw error;
  }
}

/**
 * POST an OpenAI-compatible chat completion to Groq. Returns the parsed JSON on
 * success, or an error string. Shared by the generate/chat adapters below.
 */
async function postChatCompletion(
  ctx: GroqCallContext,
  messages: { role: string; content: string }[],
  params: ModelParams,
  format?: ResponseFormat
): Promise<
  | { ok: true; json: OpenAiChatCompletion }
  | { ok: false; error: string; statusCode?: number }
> {
  const endpoint = resolveEndpoint(ctx);
  if (!endpoint.ok) {
    return { ok: false, error: endpoint.error };
  }

  const body: Record<string, unknown> = {
    model: ctx.model,
    messages,
    stream: false,
  };
  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.numPredict !== undefined) body.max_tokens = params.numPredict;
  if (params.topP !== undefined) body.top_p = params.topP;
  const responseFormat = toResponseFormat(format);
  if (responseFormat) body.response_format = responseFormat;

  let res: Response;
  try {
    res = await fetchWithTimeout(
      endpoint.url,
      {
        method: 'POST',
        headers: endpoint.headers,
        body: JSON.stringify(body),
      },
      ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) };
  }

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = (await res.json()) as OpenAiChatCompletion;
      detail = errJson.error?.message ? `\n${errJson.error.message}` : '';
    } catch {
      /* body not JSON — status line alone is enough */
    }
    return {
      ok: false,
      error: `Groq error ${res.status}: ${res.statusText}${detail}`,
      statusCode: res.status,
    };
  }

  try {
    const json = (await res.json()) as OpenAiChatCompletion;
    return { ok: true, json };
  } catch (error: any) {
    return { ok: false, error: `Groq parse error: ${error?.message || String(error)}` };
  }
}

/**
 * Task-aware generate via Groq. Mirrors OllamaClient.generateForTask's return
 * contract exactly. The single-prompt Ollama call is expressed to Groq as one
 * user message (matching how generate() folds system+prompt into `prompt`).
 */
export async function groqGenerateForTask(
  ctx: GroqCallContext,
  options: { taskType: TaskType; prompt: string; format?: ResponseFormat; overrides?: ModelParams }
): Promise<
  | { ok: true; data: OllamaGenerateResponse; model: string }
  | { ok: false; error: string; model?: string }
> {
  const profile = getTaskProfile(options.taskType);
  const merged: ModelParams = { ...profile.params, ...(options.overrides ?? {}) };
  const result = await postChatCompletion(
    ctx,
    [{ role: 'user', content: options.prompt }],
    merged,
    options.format ?? profile.format
  );
  if (!result.ok) {
    return { ok: false, error: result.error, model: ctx.model };
  }
  return { ok: true, data: adaptToGenerateResponse(result.json), model: ctx.model };
}

/**
 * Task-aware chat via Groq. Mirrors OllamaClient.chatForTask's return contract
 * exactly, including the optional statusCode on failure.
 */
export async function groqChatForTask(
  ctx: GroqCallContext,
  options: {
    taskType: TaskType;
    messages: { role: string; content: string }[];
    format?: ResponseFormat;
    overrides?: ModelParams;
  }
): Promise<
  | { ok: true; data: OllamaChatResponse; model: string }
  | { ok: false; error: string; model?: string; statusCode?: number }
> {
  const profile = getTaskProfile(options.taskType);
  const merged: ModelParams = { ...profile.params, ...(options.overrides ?? {}) };
  const result = await postChatCompletion(
    ctx,
    options.messages,
    merged,
    options.format ?? profile.format
  );
  if (!result.ok) {
    return { ok: false, error: result.error, model: ctx.model, statusCode: result.statusCode };
  }
  return { ok: true, data: adaptToChatResponse(result.json), model: ctx.model };
}
