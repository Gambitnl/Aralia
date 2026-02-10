// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 * 
 * Last Sync: 04/02/2026, 14:13:59
 * Dependents: None (Orphan)
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useState, useCallback } from 'react';
import type { BiomeDNA, ScatterRule } from '@/types/biome';

// ============================================================================
// TYPES
// ============================================================================

type GeneratorStatus = 'idle' | 'generating' | 'success' | 'error';
type Provider = 'ollama' | 'gemini';

function coerceScatterRules(raw: unknown): ScatterRule[] {
  if (!Array.isArray(raw)) return [];
  // Best-effort parsing: keep entries with the required fields and coerce numbers.
  return raw
    .filter((r) => r && typeof r === 'object')
    .map((r: any) => ({
      id: String(r.id || ''),
      assetType: r.assetType === 'tree' || r.assetType === 'rock' || r.assetType === 'grass' ? r.assetType : 'tree',
      preset: typeof r.preset === 'string' ? r.preset : undefined,
      density: typeof r.density === 'number' ? r.density : 0,
      minSlope: typeof r.minSlope === 'number' ? r.minSlope : undefined,
      maxSlope: typeof r.maxSlope === 'number' ? r.maxSlope : undefined,
      minHeight: typeof r.minHeight === 'number' ? r.minHeight : undefined,
      maxHeight: typeof r.maxHeight === 'number' ? r.maxHeight : undefined,
      scaleMean: typeof r.scaleMean === 'number' ? r.scaleMean : 1,
      scaleVar: typeof r.scaleVar === 'number' ? r.scaleVar : 0,
      clusterScale: typeof r.clusterScale === 'number' ? r.clusterScale : undefined,
      clusterThreshold: typeof r.clusterThreshold === 'number' ? r.clusterThreshold : undefined,
    }))
    .filter((r) => r.id.length > 0);
}

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
  "weatherType": "string ('clear', 'rain', 'snow', 'ash', 'spores')",
  "weatherIntensity": "number (0.0 to 1.0)",
  "scatter": [
    {
      "id": "string",
      "assetType": "tree" | "rock" | "grass",
      "preset": "string (optional, for trees: 'pine', 'oak', 'willow', 'dead')",
      "density": "number (0.0 to 0.2 is reasonable for trees/rocks, up to 0.8 for grass)",
      "minSlope": "number (0.0 to 1.0, default 0)",
      "maxSlope": "number (0.0 to 1.0, default 1)",
      "scaleMean": "number (default 1.0)",
      "scaleVar": "number (0.0 to 0.5)",
      "clusterScale": "number (optional, 0.0 to 0.2)",
      "clusterThreshold": "number (optional, 0.0 to 0.8)"
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
        // Models to try in order based on actually installed list
        const models = ['mistral:instruct', 'phi4-mini:3.8b', 'gemma3:1b'];
        
        let response: Response | null = null;
        let usedModel = '';

        for (const model of models) {
            try {
                console.log(`Attempting generation with model: ${model}`);
                response = await fetch('/api/ollama/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model: model,
                    system: SYSTEM_PROMPT,
                    prompt: `Generate a biome based on: "${userPrompt}"`,
                    stream: false,
                    format: 'json', 
                    options: { temperature: 0.7 }
                  }),
                });

                if (response.ok) {
                    usedModel = model;
                    break;
                } else {
                    console.warn(`Model ${model} failed with ${response.status}`);
                }
            } catch (e) {
                console.warn(`Connection error with ${model}`, e);
            }
        }

        if (!response || !response.ok) {
          throw new Error(`Ollama API failed. Ensure you have 'mistral' or 'llama3' pulled via 'ollama pull mistral'.`);
        }

        const data = await response.json();
        console.log(`Success with model: ${usedModel}`);
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
        weatherType: ['clear', 'rain', 'snow', 'ash', 'spores'].includes(resultJSON.weatherType) ? resultJSON.weatherType : 'clear',
        weatherIntensity: typeof resultJSON.weatherIntensity === 'number' ? resultJSON.weatherIntensity : 0.0,
        scatter: coerceScatterRules(resultJSON.scatter),
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
