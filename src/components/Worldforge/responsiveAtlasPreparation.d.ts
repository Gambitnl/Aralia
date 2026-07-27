/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 22:08:44
 * Dependents: components/MapPane.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { ResponsiveAtlasPrepared, ResponsiveAtlasRequest } from './responsiveAtlasProtocol';
type WorkerFactory = () => Worker;
export declare function responsiveAtlasPreparationKey(seed: number, clearedDungeonPaths?: readonly string[]): string;
export declare function canPrepareResponsiveAtlasOffThread(): boolean;
export declare function prepareResponsiveAtlasOnCurrentThread(request: ResponsiveAtlasRequest): ResponsiveAtlasPrepared;
export declare function prepareResponsiveAtlas(request: ResponsiveAtlasRequest, workerFactory?: WorkerFactory): Promise<ResponsiveAtlasPrepared>;
export declare function clearResponsiveAtlasPreparationCacheForTests(): void;
export { prepareResponsiveAtlasNow } from './responsiveAtlasCore';
