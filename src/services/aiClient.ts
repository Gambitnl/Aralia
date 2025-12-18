/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file aiClient.ts
 * This service module centralizes the initialization of the GoogleGenAI client.
 * It ensures the API key is present and exports a single, shared AI client instance
 * for use by other services (geminiService, ttsService).
 */
import { GoogleGenAI } from "@google/genai";
import { ENV } from "../config/env";

// Ensure API_KEY is available from the environment.
let aiInstance: GoogleGenAI | null = null;

if (!ENV.API_KEY) {
  const errorMessage =
    "Gemini API Key (API_KEY) is not set in the environment. " +
    "AI features will not work, and the application cannot initialize the AI client.";
  console.error(errorMessage);
  // Do not throw here to prevent app crash. Instead, aiInstance remains null.
} else {
    aiInstance = new GoogleGenAI({ apiKey: ENV.API_KEY });
}

/**
 * Checks if the AI client is initialized and available for use.
 * @returns {boolean} True if the AI client is ready, false otherwise.
 */
export const isAiEnabled = (): boolean => {
  return !!aiInstance;
};

/**
 * Returns the initialized AI client, or throws an error if it is not available.
 * Use this for safe access to the client.
 * @returns {GoogleGenAI} The initialized GoogleGenAI client.
 * @throws {Error} If the AI client is not initialized (e.g., missing API key).
 */
export const getAiClient = (): GoogleGenAI => {
  if (!aiInstance) {
    throw new Error("AI client is not initialized. Check your API_KEY configuration.");
  }
  return aiInstance;
};

/**
 * The shared GoogleGenAI client instance.
 * Protected by a Proxy to throw descriptive errors if accessed when uninitialized,
 * preventing 'Cannot read properties of null' runtime crashes.
 */
export const ai = new Proxy({} as GoogleGenAI, {
  get: (target, prop) => {
    if (aiInstance) {
      return Reflect.get(aiInstance, prop);
    }
    // Allow checking constructor/prototype without throwing, sometimes used by testing/frameworks
    if (prop === 'constructor' || prop === 'prototype') {
      return Reflect.get(target, prop);
    }

    // Throw descriptive error for any property access if not initialized
    throw new Error(`Gemini API Client accessed but not initialized. Accessing '${String(prop)}' failed. Check API_KEY.`);
  }
});
