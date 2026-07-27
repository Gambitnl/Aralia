/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:35:34
 * Dependents: secretGenerator.ts, world/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Secret } from '../../types/identity';
declare const SECRET_TEMPLATES: {
    political: string[];
    military: string[];
    personal: string[];
    financial: string[];
    magical: string[];
};
export interface SecretGenerationOptions {
    seed?: number;
    subjectId: string;
    subjectName?: string;
    category?: keyof typeof SECRET_TEMPLATES;
    minValue?: number;
    maxValue?: number;
}
export declare function generateSecret(options: SecretGenerationOptions): Secret;
export {};
