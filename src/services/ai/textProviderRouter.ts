/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ai/textProviderRouter.ts
 *
 * The provider router. Every task-aware text call (generateForTask /
 * chatForTask) consults this before doing Ollama work: if the player has
 * chosen `groq`, the call is served by the Groq provider instead — adapted to
 * the identical return shape so callers never change.
 *
 * Logging is CENTRAL: the Groq path emits the same start/success/error events
 * through the same `emitOllamaLog` sink the Ollama client uses, so the in-app
 * AI log viewer shows Groq calls exactly like local ones. Call sites do not log
 * (that would double-log).
 *
 * NO-FALLBACK: with `groq` selected, a Groq failure is returned honestly; this
 * router never falls back to Ollama on error.
 *
 * MODEL POOL (2026-10-31, Remy: "as many requests as possible"): each free-plan
 * Groq model has its own rate limits, so a rate-limit refusal (429) moves the
 * call to the next model of `GROQ_MODEL_POOL`. Only a 429 does this; any other
 * error is returned as it is. Every attempt is logged with its model, and the
 * model that answered is recorded for the AI settings pane.
 */

import type {
  OllamaGenerateResponse,
  OllamaChatResponse,
  ResponseFormat,
  ModelParams,
  TaskType,
} from '../../types/ollama';
import { emitOllamaLog } from '../ollama/ollamaLogSink';
import { generateId } from '../../utils/core/idGenerator';
import {
  getAiTextProvider,
  getGroqApiKey,
  getGroqModel,
  getGroqKeyStorage,
  getGroqProxyUrl,
} from './aiProviderSettings';
import { groqGenerateForTask, groqChatForTask } from './groqTextProvider';
import type { GroqCallContext } from './groqTextProvider';
import {
  GROQ_DEFAULT_REST_MS,
  getGroqPoolStatus,
  groqModelOrder,
  isGroqModelResting,
  markGroqModelAnswered,
  markGroqModelResting,
  parseGroqRetryAfterMs,
} from './groqModelPool';

/**
 * Start of the error when every pool model is at its rate limit. It is a plain
 * sentence because screens such as the opening gate show the error text as is.
 */
export const GROQ_ALL_MODELS_LIMITED = 'Every Groq model is at its free rate limit.';

/**
 * Run one Groq call through the model pool. Tries each model that is not
 * resting, in pool order. A 429 rests that model and moves on; success or any
 * other error ends the loop. When every model rests, returns an error that
 * names the soonest free time.
 */
async function callThroughPool<T extends { ok: true; model: string }>(
  base: GroqCallContext,
  logError: (model: string, error: string) => void,
  call: (ctx: GroqCallContext) => Promise<T | { ok: false; error: string; model?: string; statusCode?: number }>,
): Promise<T | { ok: false; error: string; model?: string; statusCode?: number }> {
  for (const model of groqModelOrder(base.model)) {
    if (isGroqModelResting(model)) continue;
    const result = await call({ ...base, model });
    if (result.ok) {
      markGroqModelAnswered(model);
      return result;
    }
    if (result.statusCode !== 429) return result;
    // Rate limit: log this attempt, rest the model, try the next one.
    logError(model, result.error);
    markGroqModelResting(model, parseGroqRetryAfterMs(result.error) ?? GROQ_DEFAULT_REST_MS);
  }
  const until = Object.values(getGroqPoolStatus().restingUntil);
  const soonest = until.length > 0 ? new Date(Math.min(...until)) : null;
  return {
    ok: false,
    error:
      GROQ_ALL_MODELS_LIMITED +
      (soonest ? ` The first one is free again at ${soonest.toLocaleTimeString()}.` : ''),
    model: base.model,
    statusCode: 429,
  };
}

/** True when the active provider is Groq (drives whether the client delegates). */
export function isGroqActive(): boolean {
  return getAiTextProvider() === 'groq';
}

/**
 * Build the Groq call context from the persisted key-handling settings, and
 * report the one missing prerequisite (if any) so the router can fail honestly
 * BEFORE any network call:
 *   - local/session — a key must be present, else `NO_GROQ_KEY`.
 *   - proxy         — no browser key is needed; a proxy URL must resolve, else
 *                     `NO_GROQ_PROXY_URL` (getGroqProxyUrl always returns a
 *                     default, so this is defensive only).
 */
function buildGroqContext(): { ctx: GroqCallContext; missing?: string } {
  const keyStorage = getGroqKeyStorage();
  const model = getGroqModel();
  if (keyStorage === 'proxy') {
    const proxyUrl = getGroqProxyUrl();
    return {
      ctx: { apiKey: '', model, keyStorage, proxyUrl },
      missing: proxyUrl ? undefined : 'NO_GROQ_PROXY_URL',
    };
  }
  const apiKey = getGroqApiKey();
  return {
    ctx: { apiKey, model, keyStorage },
    missing: apiKey ? undefined : 'NO_GROQ_KEY',
  };
}

/**
 * Route a task-aware generate. Emits central log events (start + success/error)
 * for the Groq path, mirroring what OllamaClient.generateForTask emits for the
 * local path, so the viewer never misses a Groq call.
 */
export async function routeGenerateForTask(options: {
  taskType: TaskType;
  prompt: string;
  format?: ResponseFormat;
  overrides?: ModelParams;
}): Promise<
  | { ok: true; data: OllamaGenerateResponse; model: string }
  | { ok: false; error: string; model?: string }
> {
  const logId = generateId();
  emitOllamaLog({ id: logId, phase: 'start', taskType: options.taskType, prompt: options.prompt });

  const { ctx, missing } = buildGroqContext();
  const model = ctx.model;
  if (missing) {
    emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, model, error: missing });
    return { ok: false, error: missing, model };
  }

  const result = await callThroughPool(
    ctx,
    (m, error) => emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, model: m, error }),
    (c) => groqGenerateForTask(c, options),
  );
  if (!result.ok) {
    emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, model: result.model ?? model, error: result.error });
    return result;
  }
  emitOllamaLog({ id: logId, phase: 'success', taskType: options.taskType, model: result.model, response: result.data.response });
  return result;
}

/**
 * Route a task-aware chat. Same central-logging contract as
 * routeGenerateForTask, including serializing the chat turns as the logged
 * prompt (matching OllamaClient.chatForTask).
 */
export async function routeChatForTask(options: {
  taskType: TaskType;
  messages: { role: string; content: string }[];
  format?: ResponseFormat;
  overrides?: ModelParams;
}): Promise<
  | { ok: true; data: OllamaChatResponse; model: string }
  | { ok: false; error: string; model?: string; statusCode?: number }
> {
  const logId = generateId();
  const promptForLog = options.messages.map((m) => `[${m.role}] ${m.content}`).join('\n\n');
  emitOllamaLog({ id: logId, phase: 'start', taskType: options.taskType, prompt: promptForLog });

  const { ctx, missing } = buildGroqContext();
  const model = ctx.model;
  if (missing) {
    emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, model, error: missing });
    return { ok: false, error: missing, model };
  }

  const result = await callThroughPool(
    ctx,
    (m, error) => emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, model: m, error }),
    (c) => groqChatForTask(c, options),
  );
  if (!result.ok) {
    emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, model: result.model ?? model, error: result.error });
    return result;
  }
  emitOllamaLog({ id: logId, phase: 'success', taskType: options.taskType, model: result.model, response: result.data.message?.content ?? '' });
  return result;
}
