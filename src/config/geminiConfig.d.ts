/**
 * @file src/config/geminiConfig.ts
 * Centralizes configuration for Gemini API model selection and fallbacks.
 */
export declare const FAST_MODEL = "gemini-2.5-flash-lite";
export declare const COMPLEX_MODEL = "gemini-3-pro-preview";
/**
 * Defines the models to be used for Gemini API text generation calls, with a fallback chain.
 * The primary model is the first in the array. If it fails with a rate-limit error,
 * the service will automatically retry with the next model in the chain.
 * The order is optimized for success, starting with the default and falling back to models
 * with higher rate limits.
 */
export declare const GEMINI_TEXT_MODEL_FALLBACK_CHAIN: string[];
