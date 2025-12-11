/**
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
 * The shared GoogleGenAI client instance.
 */
export const ai = aiInstance as GoogleGenAI; // Cast to allow usage, but might be null if checked at runtime or if we mock it.
