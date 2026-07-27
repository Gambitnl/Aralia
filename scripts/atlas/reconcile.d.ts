import type { AtlasConfig, AtlasExport, ReconcileResult } from './types';
export declare function exportAtlasState(config: AtlasConfig): AtlasExport;
export declare function reconcileAtlas(config: AtlasConfig, options: {
    trigger: string;
}): ReconcileResult;
