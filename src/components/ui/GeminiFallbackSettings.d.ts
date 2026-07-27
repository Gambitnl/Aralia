/**
 * @file src/components/ui/GeminiFallbackSettings.tsx
 * @component-owner Narrative Team / Core UI
 * @status New
 *
 * Lets a player opt in to using Google Gemini for AI narration when local
 * Ollama is unavailable, authenticating with THEIR OWN credential:
 *   - a Google AI Studio API key they paste, or
 *   - an OAuth token from signing in with their own Google account.
 *
 * Nothing is baked into the app; the credential is stored only in the player's
 * browser (see src/services/ai/aiCredentials.ts). Rendered inside
 * OllamaDependencyModal.
 */
import React from 'react';
export declare const GeminiFallbackSettings: React.FC;
