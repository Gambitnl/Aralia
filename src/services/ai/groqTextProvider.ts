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
 * rate limit, no network) surface honestly through the same `{ ok: false }`
 * error path — this module NEVER silently swaps back to Ollama.
 *
 * SECURITY: the API key is passed in by the router from localStorage
 * (aiProviderSettings). It is never read from import.meta.env or the bundle.
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
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

/** Default request timeout (mirrors DEFAULT_OLLAMA_CONFIG.timeoutMs). */
const DEFAULT_TIMEOUT_MS = 90000;

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
  if (!ctx.apiKey) {
    return { ok: false, error: 'NO_GROQ_KEY' };
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
      GROQ_CHAT_COMPLETIONS_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.apiKey}`,
        },
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
