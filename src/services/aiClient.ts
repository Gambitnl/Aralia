/**
 * @file aiClient.ts
 * This service module centralizes the initialization of the GoogleGenAI client.
 * It ensures the API key is present and exports a single, shared AI client instance
 * for use by other services (geminiService, ttsService).
 */
import { GoogleGenAI } from "@google/genai";

// Ensure API_KEY is available from the environment.
if (!process.env.API_KEY) {
  const errorMessage =
    "Gemini API Key (API_KEY) is not set in the environment. " +
    "AI features will not work, and the application cannot initialize the AI client.";
  console.error(errorMessage);
  // This error will halt further script execution if the key is missing,
  // preventing the services from attempting to use an uninitialized client.
  throw new Error(errorMessage);
}

/**
 * The shared GoogleGenAI client instance.
 */
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
