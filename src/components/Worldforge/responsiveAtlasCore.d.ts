/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 22:08:03
 * Dependents: components/Worldforge/responsiveAtlasPreparation.ts, components/Worldforge/responsiveAtlasWorker.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { ResponsiveAtlasPrepared, ResponsiveAtlasRequest } from './responsiveAtlasProtocol';
export declare function prepareResponsiveAtlasNow(request: ResponsiveAtlasRequest): ResponsiveAtlasPrepared;
