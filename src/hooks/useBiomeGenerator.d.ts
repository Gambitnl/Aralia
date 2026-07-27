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
import type { BiomeDNA } from '@/types/biome';
type GeneratorStatus = 'idle' | 'generating' | 'success' | 'error';
type Provider = 'ollama' | 'gemini';
interface UseBiomeGeneratorResult {
    generate: (prompt: string, provider?: Provider) => Promise<void>;
    status: GeneratorStatus;
    dna: BiomeDNA | null;
    error: string | null;
}
export declare const useBiomeGenerator: () => UseBiomeGeneratorResult;
export {};
