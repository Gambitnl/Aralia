import type { DocUsagePayload } from './types';
export declare function buildDocUsage(rootDir: string, opts?: {
    atlasPath?: string;
    ledgerPath?: string;
    now?: number;
}): DocUsagePayload;
