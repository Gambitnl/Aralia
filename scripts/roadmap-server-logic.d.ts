/**
 * Technical:
 * This wrapper keeps Vite config buildable even when local-only roadmap engine
 * files are intentionally absent from the repo (ignored and not on GitHub).
 *
 * Layman:
 * GitHub CI should not fail just because private/local roadmap tooling files are
 * missing. So this file provides safe fallback implementations for roadmap APIs.
 *
 * Why this exists:
 * - The project intentionally does not sync roadmap engine internals to GitHub.
 * - Vite config still references roadmap API handlers during config bundling.
 * - Static imports to missing local files break CI with "Could not resolve ..."
 * - These fallbacks keep the app buildable while local roadmap tooling remains optional.
 */
export type RoadmapNode = {
    id: string;
    label: string;
    type: 'root' | 'project' | 'milestone';
    status: 'planned' | 'active' | 'done';
    testFile?: string;
    lastTestRun?: {
        timestamp: string;
        status: 'pass' | 'fail' | 'unverified';
    };
    componentFiles?: string[];
    [key: string]: unknown;
};
export type RoadmapEdge = {
    from: string;
    to: string;
    type?: string;
};
export type RoadmapData = {
    version: string;
    root: string;
    nodes: RoadmapNode[];
    edges: RoadmapEdge[];
};
export type OpportunityScanTrigger = 'manual' | 'auto' | 'on-demand';
export type OpportunitySettings = {
    autoScanMinutes: number;
    staleDays: number;
    maxCrosslinkMatchesPerNode: number;
    maxSnapshotEntries: number;
    keepSnapshots: boolean;
};
export type OpportunityScanPayload = {
    version: string;
    scanId: string;
    generatedAt: string;
    trigger: OpportunityScanTrigger;
    settings: OpportunitySettings;
    summary: {
        totalNodes: number;
        flaggedDirectNodes: number;
        flaggedPropagatedNodes: number;
        flagTotals: Record<string, number>;
    };
    nodes: Array<Record<string, unknown>>;
};
export declare function generateRoadmapData(): RoadmapData;
export declare function loadLatestOpportunityScan(): OpportunityScanPayload | null;
export declare function readOpportunitySettings(): OpportunitySettings;
export declare function writeOpportunitySettings(input: unknown): OpportunitySettings;
export declare function scanRoadmapOpportunities(roadmap: RoadmapData, options?: {
    trigger?: OpportunityScanTrigger;
}): OpportunityScanPayload;
