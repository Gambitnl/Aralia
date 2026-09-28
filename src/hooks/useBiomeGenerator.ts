// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:28:23
 * Dependents: PreviewBiome.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useState, useCallback } from 'react';
import type { BiomeDNA, ScatterRule } from '@/types/biome';
import { resolveOllamaModel } from '@/services/ai/aiProviderSettings';

// ============================================================================
// TYPES
// ============================================================================

type GeneratorStatus = 'idle' | 'generating' | 'success' | 'error';
type Provider = 'ollama' | 'gemini';

type AssetType = ScatterRule['assetType'];
type WeatherType = NonNullable<BiomeDNA['weatherType']>;

/**
 * The biome payload an LLM is asked to emit (see SYSTEM_PROMPT). Every field is
 * `unknown`: the model is free to omit a key, emit a string where a number was
 * asked for, or invent a value outside the allowed set. `toBiomeDNA` narrows
 * each field before it reaches `BiomeDNA`, so no `any` is needed to read them.
 */
interface RawBiomeResponse {
  name?: unknown;
  descriptor?: unknown;
  primaryColor?: unknown;
  secondaryColor?: unknown;
  roughness?: unknown;
  waterColor?: unknown;
  waterClarity?: unknown;
  waveIntensity?: unknown;
  fogDensity?: unknown;
  fogHeight?: unknown;
  weatherType?: unknown;
  weatherIntensity?: unknown;
  scatter?: unknown;
}

/** One entry of the `scatter` array as it arrives, before coercion. */
type RawScatterRule = Partial<Record<keyof ScatterRule, unknown>>;

/** The slice of the `/api/ollama/generate` envelope this hook reads. */
interface OllamaGenerateEnvelope {
  response?: unknown;
}

// ============================================================================
// RESPONSE NARROWING
// ============================================================================

const ASSET_TYPES: readonly AssetType[] = ['tree', 'rock', 'grass'];
const WEATHER_TYPES: readonly WeatherType[] = ['clear', 'rain', 'snow', 'ash', 'spores'];

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function asAssetType(value: unknown): AssetType {
  return ASSET_TYPES.find((t) => t === value) ?? 'tree';
}

function asWeatherType(value: unknown): WeatherType {
  return WEATHER_TYPES.find((w) => w === value) ?? 'clear';
}

/** Scatter ids may arrive as a number; anything else is dropped by the id filter. */
function asRuleId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

export function coerceScatterRules(raw: unknown): ScatterRule[] {
  if (!Array.isArray(raw)) return [];
  // Best-effort parsing: keep entries with the required fields and coerce numbers.
  return raw
    .filter((r): r is RawScatterRule => Boolean(r) && typeof r === 'object')
    .map((r) => ({
      id: asRuleId(r.id),
      assetType: asAssetType(r.assetType),
      preset: asOptionalString(r.preset),
      density: asNumber(r.density, 0),
      minSlope: asOptionalNumber(r.minSlope),
      maxSlope: asOptionalNumber(r.maxSlope),
      minHeight: asOptionalNumber(r.minHeight),
      maxHeight: asOptionalNumber(r.maxHeight),
      scaleMean: asNumber(r.scaleMean, 1),
      scaleVar: asNumber(r.scaleVar, 0),
      clusterScale: asOptionalNumber(r.clusterScale),
      clusterThreshold: asOptionalNumber(r.clusterThreshold),
    }))
    .filter((r) => r.id.length > 0);
}

/**
 * Parse the model's text as a biome object. There is ONE accepted shape; a
 * fenced, truncated or non-object reply fails honestly and names the provider
 * plus the head of what it actually said, so the error is diagnosable.
 */
export function parseBiomeResponse(text: string, source: string): RawBiomeResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${source} did not return valid JSON. Response began: ${text.slice(0, 120)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `${source} returned ${Array.isArray(parsed) ? 'an array' : typeof parsed} where a biome JSON object was expected.`,
    );
  }
  return parsed as RawBiomeResponse;
}

/** Build the validated BiomeDNA the preview renders from a narrowed response. */
export function toBiomeDNA(result: RawBiomeResponse, userPrompt: string, id: string): BiomeDNA {
  return {
    id,
    name: asString(result.name, 'Unknown Biome'),
    descriptor: userPrompt,
    primaryColor: asString(result.primaryColor, '#000000'),
    secondaryColor: asString(result.secondaryColor, '#ffffff'),
    roughness: asNumber(result.roughness, 0.5),
    waterColor: asString(result.waterColor, '#1e3a8a'),
    waterClarity: asNumber(result.waterClarity, 0.6),
    waveIntensity: asNumber(result.waveIntensity, 0.3),
    fogDensity: asNumber(result.fogDensity, 0.02),
    fogHeight: asNumber(result.fogHeight, 10.0),
    weatherType: asWeatherType(result.weatherType),
    weatherIntensity: asNumber(result.weatherIntensity, 0.0),
    scatter: coerceScatterRules(result.scatter),
  };
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

/** The user turn sent to either provider. Kept identical so the two agree. */
function buildUserPrompt(userPrompt: string): string {
  return `Generate a biome based on: "${userPrompt}"`;
}

// ============================================================================
// PROVIDER CALLS
// ============================================================================

/** Local Ollama, one model: the player's choice or the biome default (agora-d1c7.1). */
async function generateViaOllama(userPrompt: string): Promise<RawBiomeResponse> {
  // A failure names the model; nothing else is tried.
  const usedModel = resolveOllamaModel('biome');
  const response = await fetch('/api/ollama/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: usedModel,
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(userPrompt),
      stream: false,
      format: 'json',
      options: { temperature: 0.7 }
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama model "${usedModel}" failed with ${response.status}. Pick an installed model in AI settings or run: ollama pull ${usedModel}`);
  }

  const data: OllamaGenerateEnvelope = await response.json();
  if (typeof data.response !== 'string') {
    throw new Error(`Ollama model "${usedModel}" returned an envelope with no "response" text.`);
  }
  console.log(`Success with model: ${usedModel}`);
  return parseBiomeResponse(data.response, `Ollama model "${usedModel}"`);
}

/**
 * Gemini cloud provider. Goes through the shared `gemini/core` service so this
 * call inherits the app's credential resolution (the player's own API key or
 * Google sign-in — never a key stored in this file), the rate-limit cooldown,
 * and the JSON response mode.
 *
 * The service module is imported lazily so choosing Ollama never pulls the
 * Gemini SDK (and its client construction) into the biome preview bundle.
 *
 * NO-FALLBACK: a Gemini error is reported as-is; the hook does not retry on
 * Ollama behind the player's back.
 */
async function generateViaGemini(userPrompt: string): Promise<RawBiomeResponse> {
  const { generateText } = await import('@/services/gemini/core');
  const result = await generateText(
    buildUserPrompt(userPrompt),
    SYSTEM_PROMPT,
    true,
    'useBiomeGenerator.generate',
  );

  if (result.error || !result.data) {
    throw new Error(`Gemini biome generation failed: ${result.error ?? 'no data returned'}`);
  }
  return parseBiomeResponse(result.data.text.trim(), 'Gemini');
}

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
      const resultJSON: RawBiomeResponse =
        provider === 'ollama'
          ? await generateViaOllama(userPrompt)
          : await generateViaGemini(userPrompt);

      // ------------------------------------------------------------------
      // VALIDATION & CLEANUP
      // ------------------------------------------------------------------
      setDna(toBiomeDNA(resultJSON, userPrompt, `gen_${Date.now()}`));
      setStatus('success');

    } catch (err: unknown) {
      console.error('Biome Generation Failed:', err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, []);

  return { generate, status, dna, error };
};
