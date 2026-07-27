/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 22:07:33
 * Dependents: components/Worldforge/responsiveAtlasCore.ts, components/Worldforge/responsiveAtlasPreparation.ts, components/Worldforge/responsiveAtlasWorker.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file defines the messages used to prepare the canonical world atlas away
 * from the browser interaction thread.
 *
 * The MapPane client and its worker share these plain-data shapes. Keeping the
 * contract in a side-effect-free file lets tests exercise the hand-off without
 * starting a real browser worker. The atlas and SVG model remain the existing
 * canonical structures; this file does not introduce a second world format.
 */
import type { FmgWorldResult } from '../../systems/worldforge/fmg/generateWorld';
import type { AtlasSvgModel } from './atlasSvg';
export interface ResponsiveAtlasRequest {
    seed: number;
    clearedDungeonPaths?: string[];
}
export interface ResponsiveAtlasPrepared {
    atlas: FmgWorldResult;
    model: AtlasSvgModel;
    /**
     * Non-index properties attached to FMG's precipitation typed array. Browser
     * structured clone copies typed values but drops such custom properties, so
     * the client restores them before publishing the canonical atlas.
     */
    transferProperties: {
        gridPrecipitation: Array<[string, number]>;
    };
}
export type ResponsiveAtlasResponse = Pick<ResponsiveAtlasPrepared, 'atlas' | 'transferProperties'> & {
    type: 'atlas';
} | Pick<ResponsiveAtlasPrepared, 'model'> & {
    type: 'model';
} | {
    type: 'error';
    message: string;
};
