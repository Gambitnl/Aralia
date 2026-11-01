/**
 * @file src/types/geminiLog.ts
 * Callback type that records one AI call in the Gemini interaction log.
 *
 * C11 (agora-9ed9.11): moved from hooks/actions/actionHandlerTypes.ts, which
 * re-exports it, so utils code no longer imports a hooks module.
 */
export type AddGeminiLogFn = (functionName: string, prompt: string, response: string) => void;
