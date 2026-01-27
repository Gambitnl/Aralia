// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 27/01/2026, 01:42:11
 * Dependents: PreviewBiome.tsx
 * Imports: 1 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useState, useCallback } from 'react';
import { BiomeDNA } from '@/components/DesignPreview/steps/PreviewBiome';

// ============================================================================
// TYPES
// ============================================================================

type GeneratorStatus = 'idle' | 'generating' | 'success' | 'error';
type Provider = 'ollama' | 'gemini';

interface UseBiomeGeneratorResult {
  generate: (prompt: string, provider?: Provider) => Promise<void>;
  status: GeneratorStatus;
  dna: BiomeDNA | null;
  error: string | null;
}

// ============================================================================
// PROMPT ENGINEERING
// ============================================================================

const SYSTEM_PROMPT = `
You are a procedural generation engine for a fantasy RPG.
Your goal is to interpret a user's short biome description into specific visual parameters.

Output strictly valid JSON with NO markdown formatting, NO explanation, and NO trailing commas.
The JSON must match this schema:

{
  "name": "string (A creative name for this biome)",
  "descriptor": "string (The original user prompt)",
  "primaryColor": "hex string (e.g. #2d5a27)",
  "secondaryColor": "hex string (e.g. #8b5a2b)",
  "roughness": "number (0.0 to 1.0, where 0.0 is flat/smooth and 1.0 is jagged/chaotic)",
  "waterColor": "hex string (e.g. #1e3a8a)",
  "waterClarity": "number (0.0 to 1.0)",
  "waveIntensity": "number (0.0 to 1.0)",
  "fogDensity": "number (0.0 to 0.1)",
  "fogHeight": "number (0.0 to 20.0, higher means the fog layer is deeper)",
  "scatter": [
    {
      "id": "string",
      "assetType": "tree" | "rock" | "grass",
      "preset": "string (optional, for trees: 'pine', 'oak', 'willow', 'dead')",
      "density": "number (0.0 to 0.2 is reasonable for trees/rocks, up to 0.8 for grass)",
      "minSlope": "number (0.0 to 1.0, default 0)",
      "maxSlope": "number (0.0 to 1.0, default 1)",
      "scaleMean": "number (default 1.0)",
      "scaleVar": "number (0.0 to 0.5)"
    }
  ]
}
`;

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export const useBiomeGenerator = (): UseBiomeGeneratorResult => {
  const [status, setStatus] = useState<GeneratorStatus>('idle');
  const [dna, setDna] = useState<BiomeDNA | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (userPrompt: string, provider: Provider = 'ollama') => {
    setStatus('generating');
    setError(null);

    try {
      let resultJSON: any;

      if (provider === 'ollama') {
        // ------------------------------------------------------------------
        // OLLAMA (Local)
        // ------------------------------------------------------------------
        // We use the 'generate' endpoint which is good for one-off completions.
        // We force 'json' format if the model supports it (Llama3, Mistral usually do).
        
        const response = await fetch('/api/ollama/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'mistral', // Fallback to 'llama3' or 'phi3' if needed; mistral is a good default
            system: SYSTEM_PROMPT,
            prompt: `Generate a biome based on: "${userPrompt}"`,
            stream: false,
            format: 'json', 
            options: {
              temperature: 0.7 // Creativity allowed, but grounded
            }
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama API failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        // Ollama returns the string in 'response' field
        resultJSON = JSON.parse(data.response);

      } else {
        // ------------------------------------------------------------------
        // GEMINI (Cloud Fallback)
        // ------------------------------------------------------------------
        // Placeholder for Gemini implementation.
        // For now, we simulate a delay and return mock data to prove the UI flows.
        await new Promise(r => setTimeout(r, 1500));
        
        // Mock response for now until Gemini SDK is wired if specifically requested.
        resultJSON = {
          name: `Gemini ${userPrompt.substring(0, 10)}...`,
          descriptor: userPrompt,
          primaryColor: '#4b0082',
          secondaryColor: '#dda0dd',
          roughness: 0.8,
          scatter: [
            { id: 'gemini_tree', assetType: 'tree', preset: 'pine', density: 0.1, scaleMean: 1.2, scaleVar: 0.3 }
          ]
        };
      }

      // ------------------------------------------------------------------
      // VALIDATION & CLEANUP
      // ------------------------------------------------------------------
      
      const newDna: BiomeDNA = {
        id: `gen_${Date.now()}`,
        name: resultJSON.name || 'Unknown Biome',
        descriptor: userPrompt,
        primaryColor: resultJSON.primaryColor || '#000000',
        secondaryColor: resultJSON.secondaryColor || '#ffffff',
        roughness: typeof resultJSON.roughness === 'number' ? resultJSON.roughness : 0.5,
        waterColor: resultJSON.waterColor || '#1e3a8a',
        waterClarity: typeof resultJSON.waterClarity === 'number' ? resultJSON.waterClarity : 0.6,
        waveIntensity: typeof resultJSON.waveIntensity === 'number' ? resultJSON.waveIntensity : 0.3,
        fogDensity: typeof resultJSON.fogDensity === 'number' ? resultJSON.fogDensity : 0.02,
        fogHeight: typeof resultJSON.fogHeight === 'number' ? resultJSON.fogHeight : 10.0,
        scatter: Array.isArray(resultJSON.scatter) ? resultJSON.scatter : []
      };

      setDna(newDna);
      setStatus('success');

    } catch (err: any) {
      console.error('Biome Generation Failed:', err);
      setError(err.message || 'Unknown error occurred');
      setStatus('error');
    }
  }, []);

  return { generate, status, dna, error };
};
