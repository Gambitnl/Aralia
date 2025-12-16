/**
 * @file ttsService.ts
 * This service module handles interactions with the Google Gemini API for Text-to-Speech.
 * It provides functions to synthesize text into speech audio data.
 * It uses the centralized AI client from aiClient.ts.
 */
import { GenerateContentResponse } from '@google/genai';
import { ai, isAiEnabled } from './aiClient'; // Import the shared AI client
import { GEMINI_TEXT_MODEL_FALLBACK_CHAIN } from '../config/geminiConfig';

const DEFAULT_VOICE_NAME = 'Kore'; // A default Gemini TTS voice

// Define a specific type for the audio response modality
type AudioResponseModality = 'AUDIO';

/**
 * Synthesizes speech from text using the Gemini API's native TTS.
 * Includes a fallback mechanism to retry with different models on rate limit errors.
 * @param {string} text - The text to synthesize.
 * @param {string} [voiceName=DEFAULT_VOICE_NAME] - The name of the Gemini prebuilt voice to use (e.g., 'Kore', 'Puck').
 * @param {string | null} [devModelOverride=null] - An optional model name to override the default fallback chain.
 * @returns {Promise<{ audioData: string | null; error?: Error; rateLimitHit?: boolean }>} A promise that resolves to an object containing base64 audio, an error, or a rate limit flag.
 */
export async function synthesizeSpeech(
  text: string,
  voiceName: string = DEFAULT_VOICE_NAME,
  devModelOverride: string | null = null
): Promise<{ audioData: string | null; error?: Error; rateLimitHit?: boolean }> {
  if (!isAiEnabled()) {
    console.warn("Gemini API disabled: synthesizeSpeech skipped.");
    return {
      audioData: null,
      error: new Error("Gemini API disabled (Missing API Key)."),
      rateLimitHit: false,
    };
  }

  let lastError: any = null;
  let rateLimitHitInChain = false;

  const modelsToTry = devModelOverride ? [devModelOverride] : GEMINI_TEXT_MODEL_FALLBACK_CHAIN;

  for (const model of modelsToTry) {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: model,
        contents: text,
        config: {
          responseModalities: ['AUDIO' as AudioResponseModality],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName,
              },
            },
          },
        },
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (typeof audioData === 'string' && audioData.length > 0) {
        return { audioData, rateLimitHit: rateLimitHitInChain }; // Success
      } else {
        console.warn(`Gemini TTS with model ${model} returned invalid audio data. Trying next model. Response:`, JSON.stringify(response, null, 2));
      }
    } catch (error) {
      lastError = error;
      const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
      if (errorString.includes('"code":429') || errorString.includes('RESOURCE_EXHAUSTED')) {
        rateLimitHitInChain = true;
        console.warn(`Gemini TTS API rate limit error with model ${model}. Retrying with next model...`);
        continue; // Retry with the next model
      } else {
        console.warn(`Gemini TTS API error with model ${model} (may not support TTS):`, error);
      }
    }
  }

  // If the loop finishes, all models failed.
  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError || "None of the models in the fallback chain returned valid audio data.");
  console.error('Error in synthesizeSpeech with Gemini TTS after all retries:', errorMessage, lastError);
  return {
    audioData: null,
    error: new Error(`Gemini TTS synthesizeSpeech failed: ${errorMessage}`),
    rateLimitHit: rateLimitHitInChain,
  };
}