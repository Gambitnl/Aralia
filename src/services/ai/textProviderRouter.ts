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

  const result = await groqGenerateForTask(ctx, options);
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

  const result = await groqChatForTask(ctx, options);
  if (!result.ok) {
    emitOllamaLog({ id: logId, phase: 'error', taskType: options.taskType, model: result.model ?? model, error: result.error });
    return result;
  }
  emitOllamaLog({ id: logId, phase: 'success', taskType: options.taskType, model: result.model, response: result.data.message?.content ?? '' });
  return result;
}
