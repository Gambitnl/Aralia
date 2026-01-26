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
  "secondaryColor": "hex string (e.g. #8fbc8f)",
  "roughness": "number (0.0 to 1.0, where 0.0 is flat/smooth and 1.0 is jagged/chaotic)"
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
          roughness: 0.8
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
