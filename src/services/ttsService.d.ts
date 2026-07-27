/**
 * Synthesizes speech from text using the Gemini API's native TTS.
 * Includes a fallback mechanism to retry with different models on rate limit errors.
 * @param {string} text - The text to synthesize.
 * @param {string} [voiceName=DEFAULT_VOICE_NAME] - The name of the Gemini prebuilt voice to use (e.g., 'Kore', 'Puck').
 * @param {string | null} [devModelOverride=null] - An optional model name to override the default fallback chain.
 * @returns {Promise<{ audioData: string | null; error?: Error; rateLimitHit?: boolean }>} A promise that resolves to an object containing base64 audio, an error, or a rate limit flag.
 */
export declare function synthesizeSpeech(text: string, voiceName?: string, devModelOverride?: string | null): Promise<{
    audioData: string | null;
    error?: Error;
    rateLimitHit?: boolean;
}>;
